/**
 * SQLite adapter for the platform store port.
 *
 * `node:sqlite` is the Node built-in driver, so this slice adds no database
 * dependency. It is an adapter, not part of the domain: services depend on the
 * `PlatformStore` port, and replacing this with a managed database means
 * writing a new adapter rather than changing authorization or data shaping.
 *
 * The module imports `node:sqlite` at load time and is therefore loaded
 * lazily through `container.ts`, so building or statically rendering the site
 * never opens a database.
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { DatabaseSync, type StatementSync } from "node:sqlite";

import {
  PROJECT_INTAKE_COLUMNS,
  PROJECT_INTAKE_FIELDS,
  emptyProjectIntakeAnswers,
  type AuditEvent,
  type AuthenticationChallenge,
  type FounderDecision,
  type InternalCapabilityGrant,
  type InternalCapabilityName,
  type InternalQualificationState,
  type Membership,
  type Organization,
  type Person,
  type PersonId,
  type ProjectAccess,
  type ProjectId,
  type ProjectIntake,
  type ProjectIntakeField,
  type ProjectInternal,
  type ProposalId,
  type ProposalInternal,
  type ProposalVersionId,
  type ProposalVersionInternal,
  type Session,
} from "./domain";
import type {
  PlatformStore,
  RateLimitDecision,
  RateLimitWindow,
  SubmittedIntakeProject,
} from "./ports";

type Row = Record<string, unknown>;

function text(row: Row, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`Expected a text value in column "${column}".`);
  }
  return value;
}

function nullableText(row: Row, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected a text or null value in column "${column}".`);
  }
  return value;
}

function int(row: Row, column: string): number {
  const value = row[column];
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  throw new Error(`Expected an integer value in column "${column}".`);
}

function nullableInt(row: Row, column: string): number | null {
  const value = row[column];
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  throw new Error(`Expected an integer or null value in column "${column}".`);
}

function changesOf(result: { changes: number | bigint }): number {
  return typeof result.changes === "bigint" ? Number(result.changes) : result.changes;
}

const INTAKE_ANSWER_COLUMNS = PROJECT_INTAKE_FIELDS.map(
  (field) => `${PROJECT_INTAKE_COLUMNS[field]} TEXT`,
).join(",\n    ");

/**
 * Applied on every open, so it must be idempotent: the development server loads
 * the platform module separately per route bundle, and more than one connection
 * may open the same file over the lifetime of a process.
 *
 * The global uniqueness index on projects.reference is deliberately absent here.
 * It is created by assertGloballyUniqueProjectReferences() instead, because it
 * can legitimately fail on an existing database and has to do so with a message
 * explaining what to do about it, rather than a bare SQLite constraint error.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_hash TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- One membership per person is what prevents a repeated sign-in or a retried
-- organization-creation request from producing a second organization.
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL UNIQUE REFERENCES people(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS memberships_by_organization ON memberships (organization_id);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  -- SHA-256 of the one-time secret. The secret itself is never stored.
  secret_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS auth_challenges_by_email ON auth_challenges (email_hash, consumed_at);

-- The id column is the SHA-256 of the cookie value. A copy of this table cannot
-- be replayed as a set of browser sessions.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id),
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS sessions_by_person ON sessions (person_id);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  reference TEXT NOT NULL,
  title TEXT NOT NULL,
  created_by_person_id TEXT NOT NULL REFERENCES people(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- Set only by the explicit Founder Start Review action. While it is null the
  -- customer-facing stage stays at "Information submitted", which is why merely
  -- opening the internal review page cannot change what a customer sees.
  review_started_at INTEGER,
  -- Internal business state. Never selected into a customer response; see
  -- views.ts, which builds customer objects field by field.
  qualification_state TEXT NOT NULL DEFAULT 'unreviewed',
  internal_notes TEXT,
  founder_decision TEXT,
  internal_next_action TEXT,
  -- Makes "Start Your Project" idempotent so a double submit or a refresh
  -- cannot create two projects for one action.
  idempotency_key TEXT,
  UNIQUE (organization_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS projects_by_organization ON projects (organization_id, created_at);

CREATE TABLE IF NOT EXISTS project_access (
  project_id TEXT NOT NULL REFERENCES projects(id),
  person_id TEXT NOT NULL REFERENCES people(id),
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER,
  PRIMARY KEY (project_id, person_id)
);
CREATE INDEX IF NOT EXISTS project_access_by_person ON project_access (person_id);

CREATE TABLE IF NOT EXISTS project_intake (
  id TEXT PRIMARY KEY,
  -- One intake per project for the life of the project: intake progress stays
  -- attached to the same stable project record.
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted')),
  schema_version INTEGER NOT NULL,
  ${INTAKE_ANSWER_COLUMNS},
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_saved_at INTEGER NOT NULL,
  submitted_at INTEGER
);

-- Internal capabilities are deliberately a separate concept from organization
-- membership: a Founder is not an owner, admin, or member of a customer
-- organization, and membership can never imply internal access.
CREATE TABLE IF NOT EXISTS internal_capabilities (
  person_id TEXT NOT NULL REFERENCES people(id),
  capability TEXT NOT NULL,
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER,
  PRIMARY KEY (person_id, capability)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  person_id TEXT,
  project_id TEXT,
  type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS audit_events_by_project ON audit_events (project_id, occurred_at);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
  created_by_person_id TEXT NOT NULL REFERENCES people(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS proposals_by_project ON proposals (project_id);

CREATE TABLE IF NOT EXISTS proposal_versions (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES proposals(id),
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  summary TEXT NOT NULL,
  scope_included TEXT NOT NULL,
  scope_excluded TEXT NOT NULL,
  deliverables TEXT NOT NULL,
  timeline TEXT NOT NULL,
  assumptions TEXT NOT NULL,
  commercial_terms TEXT NOT NULL,
  valid_until INTEGER,
  created_by_person_id TEXT NOT NULL REFERENCES people(id),
  created_at INTEGER NOT NULL,
  published_at INTEGER,
  UNIQUE (proposal_id, version_number)
);
CREATE INDEX IF NOT EXISTS proposal_versions_by_proposal ON proposal_versions (proposal_id, version_number);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
`;

export class SqlitePlatformStore implements PlatformStore {
  private readonly db: DatabaseSync;
  private transactionDepth = 0;
  private closed = false;
  private readonly statementCache = new Map<string, StatementSync>();

  constructor(databasePath: string) {
    const isInMemory = databasePath === ":memory:";
    if (!isInMemory) {
      // Create the containing directory rather than failing with an opaque
      // "unable to open database" on first run.
      mkdirSync(dirname(resolve(databasePath)), { recursive: true });
    }

    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA foreign_keys = ON;");
    // WAL keeps readers from blocking on the writer. Not meaningful for an
    // in-memory database, and harmless there.
    if (!isInMemory) {
      this.db.exec("PRAGMA journal_mode = WAL;");
    }
    this.db.exec(SCHEMA);
    // `CREATE TABLE IF NOT EXISTS` leaves an already-existing table alone, so a
    // database file created before a column was introduced would not gain it.
    // Adding columns here keeps an existing local file working without a
    // separate migration tool; the check makes it idempotent.
    this.addColumnIfMissing("projects", "review_started_at", "INTEGER");
    this.assertGloballyUniqueProjectReferences();
  }

  /**
   * Enforces that project references are unique across the whole platform.
   *
   * A project reference is customer-visible, so it has to identify exactly one
   * project. An organization-scoped constraint is not enough: two organizations
   * could otherwise hold the same reference, and any lookup not scoped to one
   * organization would then have no single right answer. This index is the
   * guarantee; the allocation pre-check only avoids reaching it.
   *
   * Existing databases keep their original organization-scoped constraint, which
   * this index makes redundant without disturbing.
   *
   * Creating it fails on a database that already contains references duplicated
   * across organizations. That failure is the correct outcome and is re-thrown
   * with an explanation rather than absorbed: those references are customer-visible
   * data, and quietly rewriting or deduplicating them would change what customers
   * are shown. A database in that state is never opened, so no lookup can return an
   * arbitrary project.
   */
  private assertGloballyUniqueProjectReferences(): void {
    try {
      this.db.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS projects_reference_unique ON projects (reference);",
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        "Could not enforce globally unique project references because this database already " +
          "contains project references that are used by more than one organization. " +
          "No project reference was changed. Resolve those duplicates explicitly, or point " +
          `CUSTOMER_PLATFORM_DATABASE_PATH at a fresh database. Database error: ${detail}`,
      );
    }
  }

  /**
   * Adds a column only when it is absent.
   *
   * Runs on every open, so it must be a no-op once the column exists.
   */
  private addColumnIfMissing(table: string, column: string, type: string): void {
    const existing = this.all(`PRAGMA table_info(${table})`);
    const present = existing.some((row) => row.name === column);
    if (!present) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }

  // --- infrastructure ------------------------------------------------------

  private prepare(sql: string): StatementSync {
    const cached = this.statementCache.get(sql);
    if (cached) return cached;
    const statement = this.db.prepare(sql);
    this.statementCache.set(sql, statement);
    return statement;
  }

  private run(sql: string, ...params: (string | number | null)[]) {
    return this.prepare(sql).run(...params);
  }

  private get(sql: string, ...params: (string | number | null)[]): Row | undefined {
    return this.prepare(sql).get(...params) as Row | undefined;
  }

  private all(sql: string, ...params: (string | number | null)[]): Row[] {
    return this.prepare(sql).all(...params) as Row[];
  }

  transaction<T>(fn: (store: PlatformStore) => T): T {
    if (this.transactionDepth > 0) {
      return fn(this);
    }
    this.db.exec("BEGIN IMMEDIATE;");
    this.transactionDepth += 1;
    try {
      const result = fn(this);
      this.db.exec("COMMIT;");
      return result;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK;");
      } catch {
        // The transaction was already rolled back by SQLite; keep the original
        // failure, which is the one worth surfacing.
      }
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  close(): void {
    // Idempotent: a second close is a no-op rather than an error, so a shutdown
    // path that closes twice cannot mask the real failure that led to it.
    if (this.closed) return;
    this.closed = true;
    this.statementCache.clear();
    this.db.close();
  }

  // --- rate limiting -------------------------------------------------------

  /**
   * Reads, decides, and writes in one transaction.
   *
   * `BEGIN IMMEDIATE` takes the write lock before the first read, so a second
   * process cannot read the same pre-increment count. Within one process
   * `node:sqlite` is synchronous, so the statements cannot interleave either.
   */
  consumeRateLimit(
    bucket: string,
    input: { now: number; windowMs: number; limit: number },
  ): RateLimitDecision {
    return this.transaction(() => {
      const existing = this.readRateLimitWindow(bucket);
      const withinWindow =
        existing !== null && input.now - existing.windowStart < input.windowMs;
      const windowStart = withinWindow ? (existing as RateLimitWindow).windowStart : input.now;
      const count = withinWindow ? (existing as RateLimitWindow).count : 0;

      if (count >= input.limit) {
        const retryAfterMs = Math.max(1, windowStart + input.windowMs - input.now);
        return {
          windowStart,
          count,
          allowed: false,
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        };
      }

      this.writeRateLimitWindow(bucket, { windowStart, count: count + 1 });
      return { windowStart, count: count + 1, allowed: true, retryAfterSeconds: 0 };
    });
  }

  private readRateLimitWindow(bucket: string): RateLimitWindow | null {
    const row = this.get(
      "SELECT window_start, count FROM rate_limits WHERE bucket = ?",
      bucket,
    );
    if (!row) return null;
    return { windowStart: int(row, "window_start"), count: int(row, "count") };
  }

  private writeRateLimitWindow(bucket: string, window: RateLimitWindow): void {
    this.run(
      `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?, ?, ?)
       ON CONFLICT (bucket) DO UPDATE SET window_start = excluded.window_start, count = excluded.count`,
      bucket,
      window.windowStart,
      window.count,
    );
  }

  // --- people --------------------------------------------------------------

  private toPerson(row: Row): Person {
    return {
      id: text(row, "id"),
      email: text(row, "email"),
      emailHash: text(row, "email_hash"),
      displayName: nullableText(row, "display_name"),
      createdAt: int(row, "created_at"),
      updatedAt: int(row, "updated_at"),
    };
  }

  findPersonByEmailHash(emailHash: string): Person | null {
    const row = this.get(
      "SELECT * FROM people WHERE email_hash = ?",
      emailHash,
    );
    return row ? this.toPerson(row) : null;
  }

  findPersonById(id: string): Person | null {
    const row = this.get("SELECT * FROM people WHERE id = ?", id);
    return row ? this.toPerson(row) : null;
  }

  createPerson(input: {
    id: string;
    email: string;
    emailHash: string;
    displayName: string | null;
    now: number;
  }): Person {
    this.run(
      `INSERT INTO people (id, email, email_hash, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.id,
      input.email,
      input.emailHash,
      input.displayName,
      input.now,
      input.now,
    );
    const person = this.findPersonByEmailHash(input.emailHash);
    if (!person) {
      throw new Error("Person was not readable immediately after creation.");
    }
    return person;
  }

  // --- authentication challenges ------------------------------------------

  private toChallenge(row: Row): AuthenticationChallenge {
    return {
      id: text(row, "id"),
      email: text(row, "email"),
      emailHash: text(row, "email_hash"),
      secretHash: text(row, "secret_hash"),
      createdAt: int(row, "created_at"),
      expiresAt: int(row, "expires_at"),
      consumedAt: nullableInt(row, "consumed_at"),
    };
  }

  createChallenge(challenge: AuthenticationChallenge): void {
    this.run(
      `INSERT INTO auth_challenges
         (id, email, email_hash, secret_hash, created_at, expires_at, consumed_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      challenge.id,
      challenge.email,
      challenge.emailHash,
      challenge.secretHash,
      challenge.createdAt,
      challenge.expiresAt,
    );
  }

  findChallenge(id: string): AuthenticationChallenge | null {
    const row = this.get("SELECT * FROM auth_challenges WHERE id = ?", id);
    return row ? this.toChallenge(row) : null;
  }

  consumeChallenge(input: { id: string; now: number }): AuthenticationChallenge | null {
    // The guard lives in the UPDATE's WHERE clause, so the check-and-consume is
    // one atomic step: a second verification of the same link changes zero rows.
    const result = this.run(
      `UPDATE auth_challenges SET consumed_at = ?
       WHERE id = ? AND consumed_at IS NULL AND expires_at > ?`,
      input.now,
      input.id,
      input.now,
    );
    if (changesOf(result) === 0) {
      return null;
    }
    const row = this.get("SELECT * FROM auth_challenges WHERE id = ?", input.id);
    return row ? this.toChallenge(row) : null;
  }

  // --- sessions ------------------------------------------------------------

  private toSession(row: Row): Session {
    return {
      id: text(row, "id"),
      personId: text(row, "person_id"),
      createdAt: int(row, "created_at"),
      lastUsedAt: int(row, "last_used_at"),
      expiresAt: int(row, "expires_at"),
      revokedAt: nullableInt(row, "revoked_at"),
    };
  }

  createSession(session: Session): void {
    this.run(
      `INSERT INTO sessions (id, person_id, created_at, last_used_at, expires_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      session.id,
      session.personId,
      session.createdAt,
      session.lastUsedAt,
      session.expiresAt,
    );
  }

  findSessionById(sessionId: string): Session | null {
    const row = this.get("SELECT * FROM sessions WHERE id = ?", sessionId);
    return row ? this.toSession(row) : null;
  }

  touchSession(input: { id: string; now: number }): void {
    this.run("UPDATE sessions SET last_used_at = ? WHERE id = ?", input.now, input.id);
  }

  revokeSession(input: { id: string; now: number }): boolean {
    const result = this.run(
      "UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
      input.now,
      input.id,
    );
    return changesOf(result) > 0;
  }

  // --- organizations -------------------------------------------------------

  private toOrganization(row: Row): Organization {
    return {
      id: text(row, "id"),
      name: text(row, "name"),
      createdAt: int(row, "created_at"),
    };
  }

  private toMembership(row: Row): Membership {
    return {
      id: text(row, "id"),
      personId: text(row, "person_id"),
      organizationId: text(row, "organization_id"),
      role: text(row, "role") as Membership["role"],
      createdAt: int(row, "created_at"),
    };
  }

  findOrganization(id: string): Organization | null {
    const row = this.get("SELECT * FROM organizations WHERE id = ?", id);
    return row ? this.toOrganization(row) : null;
  }

  createOrganization(input: { id: string; name: string; now: number }): Organization {
    this.run(
      "INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)",
      input.id,
      input.name,
      input.now,
    );
    const organization = this.findOrganization(input.id);
    if (!organization) {
      throw new Error("Organization was not readable immediately after creation.");
    }
    return organization;
  }

  findMembershipByPerson(personId: string): Membership | null {
    const row = this.get("SELECT * FROM memberships WHERE person_id = ?", personId);
    return row ? this.toMembership(row) : null;
  }

  findMembership(input: {
    personId: string;
    organizationId: string;
  }): Membership | null {
    const row = this.get(
      "SELECT * FROM memberships WHERE person_id = ? AND organization_id = ?",
      input.personId,
      input.organizationId,
    );
    return row ? this.toMembership(row) : null;
  }

  listMembershipsByOrganization(organizationId: string): Membership[] {
    return this.all(
      "SELECT * FROM memberships WHERE organization_id = ? ORDER BY created_at ASC",
      organizationId,
    ).map((row) => this.toMembership(row));
  }

  createMembership(input: {
    id: string;
    personId: string;
    organizationId: string;
    role: Membership["role"];
    now: number;
  }): Membership {
    this.run(
      `INSERT INTO memberships (id, person_id, organization_id, role, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      input.id,
      input.personId,
      input.organizationId,
      input.role,
      input.now,
    );
    const membership = this.findMembershipByPerson(input.personId);
    if (!membership) {
      throw new Error("Membership was not readable immediately after creation.");
    }
    return membership;
  }

  // --- projects ------------------------------------------------------------

  private toProject(row: Row): ProjectInternal {
    return {
      id: text(row, "id"),
      organizationId: text(row, "organization_id"),
      reference: text(row, "reference"),
      title: text(row, "title"),
      createdByPersonId: text(row, "created_by_person_id"),
      createdAt: int(row, "created_at"),
      updatedAt: int(row, "updated_at"),
      reviewStartedAt: nullableInt(row, "review_started_at"),
      qualificationState: text(row, "qualification_state") as ProjectInternal["qualificationState"],
      internalNotes: nullableText(row, "internal_notes"),
      founderDecision: nullableText(row, "founder_decision") as FounderDecision | null,
      internalNextAction: nullableText(row, "internal_next_action"),
    };
  }

  /**
   * Writes internal-only project state.
   *
   * Only keys present in the patch appear in the SET clause, so recording an
   * internal note cannot clear the qualification state or the Founder decision.
   * Column names come from a fixed map defined here and every value is bound as
   * a parameter, so no caller-supplied text becomes SQL.
   */
  saveProjectInternal(input: {
    id: string;
    patch: {
      qualificationState?: InternalQualificationState;
      internalNotes?: string | null;
      founderDecision?: FounderDecision | null;
      internalNextAction?: string | null;
      reviewStartedAt?: number | null;
    };
    now: number;
  }): ProjectInternal {
    const COLUMNS = {
      qualificationState: "qualification_state",
      internalNotes: "internal_notes",
      founderDecision: "founder_decision",
      internalNextAction: "internal_next_action",
      reviewStartedAt: "review_started_at",
    } as const;
    type PatchKey = keyof typeof COLUMNS;

    const assignments: string[] = [];
    const params: (string | number | null)[] = [];
    for (const key of Object.keys(COLUMNS) as PatchKey[]) {
      if (!Object.prototype.hasOwnProperty.call(input.patch, key)) continue;
      assignments.push(`${COLUMNS[key]} = ?`);
      params.push(input.patch[key] ?? null);
    }
    assignments.push("updated_at = ?");
    params.push(input.now);

    this.run(
      `UPDATE projects SET ${assignments.join(", ")} WHERE id = ?`,
      ...params,
      input.id,
    );

    const stored = this.findProject(input.id);
    if (!stored) {
      throw new Error("Project was not readable immediately after being updated.");
    }
    return stored;
  }

  createProject(input: {
    project: ProjectInternal;
    idempotencyKey: string | null;
  }): ProjectInternal {
    const project = input.project;
    this.run(
      `INSERT INTO projects
         (id, organization_id, reference, title, created_by_person_id, created_at, updated_at,
          qualification_state, internal_notes, founder_decision, internal_next_action, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      project.id,
      project.organizationId,
      project.reference,
      project.title,
      project.createdByPersonId,
      project.createdAt,
      project.updatedAt,
      project.qualificationState,
      project.internalNotes,
      project.founderDecision,
      project.internalNextAction,
      // The uniqueness check is enforced by the database, not by a
      // read-then-write in the service, so it holds under concurrency too.
      input.idempotencyKey,
    );
    const stored = this.findProject(project.id);
    if (!stored) {
      throw new Error("Project was not readable immediately after creation.");
    }
    return stored;
  }

  findProject(id: ProjectId): ProjectInternal | null {
    const row = this.get("SELECT * FROM projects WHERE id = ?", id);
    return row ? this.toProject(row) : null;
  }

  findProjectByReference(
    organizationId: string,
    reference: string,
  ): ProjectInternal | null {
    const row = this.get(
      "SELECT * FROM projects WHERE organization_id = ? AND reference = ?",
      organizationId,
      reference,
    );
    return row ? this.toProject(row) : null;
  }

  findProjectByReferenceGlobal(reference: string): ProjectInternal | null {
    // Returns at most one row because `projects.reference` is globally unique;
    // `LIMIT 1` states that dependency rather than relying on it silently.
    const row = this.get("SELECT * FROM projects WHERE reference = ? LIMIT 1", reference);
    return row ? this.toProject(row) : null;
  }

  findProjectByIdempotencyKey(
    organizationId: string,
    idempotencyKey: string,
  ): ProjectInternal | null {
    const row = this.get(
      "SELECT * FROM projects WHERE organization_id = ? AND idempotency_key = ?",
      organizationId,
      idempotencyKey,
    );
    return row ? this.toProject(row) : null;
  }

  listProjectsByOrganization(organizationId: string): ProjectInternal[] {
    return this.all(
      "SELECT * FROM projects WHERE organization_id = ? ORDER BY created_at ASC, id ASC",
      organizationId,
    ).map((row) => this.toProject(row));
  }

  listSubmittedIntakeProjects(limit: number): SubmittedIntakeProject[] {
    const bounded = Math.max(1, Math.min(limit, 200));
    // One query, so nothing is read twice and the ordering cannot drift out of
    // step with the rows. The draft filter is in the WHERE clause, so an
    // unfinished intake is never materialized at all, and the organization name
    // is joined in rather than looked up once per project.
    return this.all(
      `SELECT p.*, i.submitted_at AS intake_submitted_at, o.name AS organization_name
         FROM projects p
         JOIN project_intake i ON i.project_id = p.id
         JOIN organizations o ON o.id = p.organization_id
        WHERE i.status = 'submitted' AND i.submitted_at IS NOT NULL
        ORDER BY i.submitted_at DESC, p.reference ASC
        LIMIT ?`,
      bounded,
    ).map((row) => ({
      project: this.toProject(row),
      organizationName: text(row, "organization_name"),
      submittedAt: int(row, "intake_submitted_at"),
    }));
  }

  // --- proposals -----------------------------------------------------------

  private toProposal(row: Row): ProposalInternal {
    return {
      id: text(row, "id"),
      projectId: text(row, "project_id"),
      createdByPersonId: text(row, "created_by_person_id"),
      createdAt: int(row, "created_at"),
      updatedAt: int(row, "updated_at"),
    };
  }

  private toProposalVersion(row: Row): ProposalVersionInternal {
    return {
      id: text(row, "id"),
      proposalId: text(row, "proposal_id"),
      versionNumber: int(row, "version_number"),
      status: text(row, "status") as ProposalVersionInternal["status"],
      summary: text(row, "summary"),
      scopeIncluded: text(row, "scope_included"),
      scopeExcluded: text(row, "scope_excluded"),
      deliverables: text(row, "deliverables"),
      timeline: text(row, "timeline"),
      assumptions: text(row, "assumptions"),
      commercialTerms: text(row, "commercial_terms"),
      validUntil: nullableInt(row, "valid_until"),
      createdByPersonId: text(row, "created_by_person_id"),
      createdAt: int(row, "created_at"),
      publishedAt: nullableInt(row, "published_at"),
    };
  }

  findProposalByProject(projectId: ProjectId): ProposalInternal | null {
    const row = this.get("SELECT * FROM proposals WHERE project_id = ?", projectId);
    return row ? this.toProposal(row) : null;
  }

  findProposalById(id: ProposalId): ProposalInternal | null {
    const row = this.get("SELECT * FROM proposals WHERE id = ?", id);
    return row ? this.toProposal(row) : null;
  }

  /**
   * Versions in creation order, oldest first.
   *
   * The ordering is fixed here rather than in the caller so every reader agrees
   * on what "the proposal's history" is. `version_number` is unique per proposal,
   * which is what makes the ordering total.
   */
  listProposalVersions(proposalId: ProposalId): ProposalVersionInternal[] {
    return this.all(
      "SELECT * FROM proposal_versions WHERE proposal_id = ? ORDER BY version_number ASC",
      proposalId,
    ).map((row) => this.toProposalVersion(row));
  }

  findProposalVersionById(id: ProposalVersionId): ProposalVersionInternal | null {
    const row = this.get("SELECT * FROM proposal_versions WHERE id = ?", id);
    return row ? this.toProposalVersion(row) : null;
  }

  /**
   * Existence check for the customer dashboard's `hasPublishedProposal` signal.
   *
   * One indexed lookup joined through `proposals`, so the customer listing does
   * not have to load proposal content to answer a boolean question.
   *
   * Requires both the published status and a recorded publication instant, which
   * is the same invariant `selectCurrentPublishedVersion` applies before a
   * version is shown to a customer. A row marked published without an instant is
   * therefore reported as not published here too, so the dashboard signal and the
   * customer read cannot disagree.
   */
  hasPublishedProposalVersion(projectId: ProjectId): boolean {
    const row = this.get(
      "SELECT 1 AS present FROM proposal_versions v " +
        "JOIN proposals p ON p.id = v.proposal_id " +
        "WHERE p.project_id = ? AND v.status = 'published' AND v.published_at IS NOT NULL " +
        "LIMIT 1",
      projectId,
    );
    return row !== undefined;
  }

  createProposal(input: {
    id: string;
    projectId: ProjectId;
    createdByPersonId: PersonId;
    createdAt: number;
    updatedAt: number;
  }): ProposalInternal {
    this.run(
      "INSERT INTO proposals (id, project_id, created_by_person_id, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?)",
      input.id,
      input.projectId,
      input.createdByPersonId,
      input.createdAt,
      input.updatedAt,
    );
    const stored = this.findProposalById(input.id);
    if (!stored) {
      throw new Error("Proposal was not readable immediately after creation.");
    }
    return stored;
  }

  createProposalVersion(input: {
    id: string;
    proposalId: ProposalId;
    versionNumber: number;
    status: ProposalVersionInternal["status"];
    summary: string;
    scopeIncluded: string;
    scopeExcluded: string;
    deliverables: string;
    timeline: string;
    assumptions: string;
    commercialTerms: string;
    validUntil: number | null;
    createdByPersonId: PersonId;
    createdAt: number;
    publishedAt: number | null;
  }): ProposalVersionInternal {
    this.run(
      "INSERT INTO proposal_versions " +
        "(id, proposal_id, version_number, status, summary, scope_included, scope_excluded, " +
        "deliverables, timeline, assumptions, commercial_terms, valid_until, " +
        "created_by_person_id, created_at, published_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.proposalId,
      input.versionNumber,
      input.status,
      input.summary,
      input.scopeIncluded,
      input.scopeExcluded,
      input.deliverables,
      input.timeline,
      input.assumptions,
      input.commercialTerms,
      input.validUntil,
      input.createdByPersonId,
      input.createdAt,
      input.publishedAt,
    );
    const stored = this.findProposalVersionById(input.id);
    if (!stored) {
      throw new Error("Proposal version was not readable immediately after creation.");
    }
    return stored;
  }

  /**
   * Marks an unpublished version as published.
   *
   * The `published_at IS NULL` condition lives in the UPDATE, so publishing is
   * idempotent and two concurrent publishes cannot both stamp the row: the second
   * one changes nothing. A version that is already published keeps its original
   * instant rather than being rewritten.
   */
  publishProposalVersion(input: { id: ProposalVersionId; now: number }): void {
    this.run(
      "UPDATE proposal_versions SET published_at = ?, status = 'published' " +
        "WHERE id = ? AND published_at IS NULL",
      input.now,
      input.id,
    );
  }

  // --- internal capabilities ------------------------------------------------

  private toInternalCapability(row: Row): InternalCapabilityGrant {
    return {
      personId: text(row, "person_id"),
      capability: text(row, "capability") as InternalCapabilityName,
      grantedAt: int(row, "granted_at"),
      revokedAt: nullableInt(row, "revoked_at"),
    };
  }

  grantInternalCapability(grant: InternalCapabilityGrant): InternalCapabilityGrant {
    // Re-granting clears a previous revocation, exactly as a project grant does.
    this.run(
      `INSERT INTO internal_capabilities (person_id, capability, granted_at, revoked_at)
       VALUES (?, ?, ?, NULL)
       ON CONFLICT (person_id, capability)
       DO UPDATE SET granted_at = excluded.granted_at, revoked_at = NULL`,
      grant.personId,
      grant.capability,
      grant.grantedAt,
    );
    const stored = this.findInternalCapability(grant.personId, grant.capability);
    if (!stored) {
      throw new Error("The internal capability was not readable immediately after being granted.");
    }
    return stored;
  }

  revokeInternalCapability(input: {
    personId: string;
    capability: InternalCapabilityName;
    now: number;
  }): boolean {
    const result = this.run(
      "UPDATE internal_capabilities SET revoked_at = ? WHERE person_id = ? AND capability = ? AND revoked_at IS NULL",
      input.now,
      input.personId,
      input.capability,
    );
    return changesOf(result) > 0;
  }

  findInternalCapability(
    personId: string,
    capability: InternalCapabilityName,
  ): InternalCapabilityGrant | null {
    const row = this.get(
      "SELECT * FROM internal_capabilities WHERE person_id = ? AND capability = ?",
      personId,
      capability,
    );
    return row ? this.toInternalCapability(row) : null;
  }

  listActiveInternalCapabilities(personId: string): InternalCapabilityGrant[] {
    return this.all(
      "SELECT * FROM internal_capabilities WHERE person_id = ? AND revoked_at IS NULL ORDER BY capability ASC",
      personId,
    ).map((row) => this.toInternalCapability(row));
  }

  // --- project access ------------------------------------------------------

  private toProjectAccess(row: Row): ProjectAccess {
    return {
      projectId: text(row, "project_id"),
      personId: text(row, "person_id"),
      grantedAt: int(row, "granted_at"),
      revokedAt: nullableInt(row, "revoked_at"),
    };
  }

  findProjectAccess(projectId: ProjectId, personId: string): ProjectAccess | null {
    const row = this.get(
      "SELECT * FROM project_access WHERE project_id = ? AND person_id = ?",
      projectId,
      personId,
    );
    return row ? this.toProjectAccess(row) : null;
  }

  grantProjectAccess(access: ProjectAccess): ProjectAccess {
    // Re-granting an existing row clears a previous revocation, so access can be
    // restored without duplicating the grant.
    this.run(
      `INSERT INTO project_access (project_id, person_id, granted_at, revoked_at)
       VALUES (?, ?, ?, NULL)
       ON CONFLICT (project_id, person_id)
       DO UPDATE SET granted_at = excluded.granted_at, revoked_at = NULL`,
      access.projectId,
      access.personId,
      access.grantedAt,
    );
    const stored = this.findProjectAccess(access.projectId, access.personId);
    if (!stored) {
      throw new Error("Project access was not readable immediately after being granted.");
    }
    return stored;
  }

  revokeProjectAccess(input: {
    projectId: ProjectId;
    personId: string;
    now: number;
  }): boolean {
    const result = this.run(
      `UPDATE project_access SET revoked_at = ?
       WHERE project_id = ? AND person_id = ? AND revoked_at IS NULL`,
      input.now,
      input.projectId,
      input.personId,
    );
    return changesOf(result) > 0;
  }

  listActiveProjectAccess(projectId: ProjectId): ProjectAccess[] {
    return this.all(
      "SELECT * FROM project_access WHERE project_id = ? AND revoked_at IS NULL ORDER BY granted_at ASC",
      projectId,
    ).map((row) => this.toProjectAccess(row));
  }

  // --- project intake ------------------------------------------------------

  private toProjectIntake(row: Row): ProjectIntake {
    const answers = emptyProjectIntakeAnswers();
    for (const field of PROJECT_INTAKE_FIELDS) {
      answers[field] = nullableText(row, PROJECT_INTAKE_COLUMNS[field]);
    }
    return {
      id: text(row, "id"),
      projectId: text(row, "project_id"),
      status: text(row, "status") as ProjectIntake["status"],
      schemaVersion: int(row, "schema_version"),
      answers,
      createdAt: int(row, "created_at"),
      updatedAt: int(row, "updated_at"),
      lastSavedAt: int(row, "last_saved_at"),
      submittedAt: nullableInt(row, "submitted_at"),
    };
  }

  createProjectIntake(intake: ProjectIntake): ProjectIntake {
    const columns = PROJECT_INTAKE_FIELDS.map((field) => PROJECT_INTAKE_COLUMNS[field]);
    this.run(
      `INSERT INTO project_intake
         (id, project_id, status, schema_version, ${columns.join(", ")},
          created_at, updated_at, last_saved_at, submitted_at)
       VALUES (?, ?, ?, ?, ${PROJECT_INTAKE_FIELDS.map(() => "?").join(", ")},
               ?, ?, ?, ?)`,
      intake.id,
      intake.projectId,
      intake.status,
      intake.schemaVersion,
      ...PROJECT_INTAKE_FIELDS.map((field) => intake.answers[field]),
      intake.createdAt,
      intake.updatedAt,
      intake.lastSavedAt,
      intake.submittedAt,
    );
    const stored = this.findProjectIntakeByProject(intake.projectId);
    if (!stored) {
      throw new Error("Project intake was not readable immediately after creation.");
    }
    return stored;
  }

  findProjectIntakeByProject(projectId: ProjectId): ProjectIntake | null {
    const row = this.get("SELECT * FROM project_intake WHERE project_id = ?", projectId);
    return row ? this.toProjectIntake(row) : null;
  }

  saveProjectIntake(input: {
    id: string;
    patch: Partial<Record<ProjectIntakeField, string | null>>;
    status: ProjectIntake["status"] | null;
    now: number;
  }): ProjectIntake {
    // Only keys actually present in the patch appear in the SET clause, which
    // is what makes a partial save leave every other answer untouched.
    const assignments: string[] = [];
    const params: (string | number | null)[] = [];
    for (const field of PROJECT_INTAKE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(input.patch, field)) continue;
      assignments.push(`${PROJECT_INTAKE_COLUMNS[field]} = ?`);
      params.push(input.patch[field] ?? null);
    }
    if (input.status !== null) {
      assignments.push("status = ?");
      params.push(input.status);
    }
    if (input.status === "submitted") {
      assignments.push("submitted_at = ?");
      params.push(input.now);
    }
    assignments.push("updated_at = ?", "last_saved_at = ?");
    params.push(input.now, input.now);

    this.run(
      `UPDATE project_intake SET ${assignments.join(", ")} WHERE id = ?`,
      ...params,
      input.id,
    );

    const row = this.get("SELECT * FROM project_intake WHERE id = ?", input.id);
    if (!row) {
      throw new Error("Project intake was not readable immediately after being saved.");
    }
    return this.toProjectIntake(row);
  }

  // --- audit ---------------------------------------------------------------

  private toAuditEvent(row: Row): AuditEvent {
    const rawMetadata = nullableText(row, "metadata");
    let metadata: Record<string, unknown> | null = null;
    if (rawMetadata !== null) {
      const parsed: unknown = JSON.parse(rawMetadata);
      // A stored value is not trusted to have the declared shape.
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>;
      }
    }
    return {
      id: text(row, "id"),
      organizationId: nullableText(row, "organization_id"),
      personId: nullableText(row, "person_id"),
      projectId: nullableText(row, "project_id"),
      type: text(row, "type"),
      occurredAt: int(row, "occurred_at"),
      metadata,
    };
  }

  listAuditEventsForProject(projectId: string, limit: number): AuditEvent[] {
    const bounded = Math.max(1, Math.min(limit, 200));
    return this.all(
      "SELECT * FROM audit_events WHERE project_id = ? ORDER BY occurred_at DESC, id DESC LIMIT ?",
      projectId,
      bounded,
    ).map((row) => this.toAuditEvent(row));
  }

  appendAuditEvent(event: AuditEvent): void {
    this.run(
      `INSERT INTO audit_events
         (id, organization_id, person_id, project_id, type, occurred_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      event.id,
      event.organizationId,
      event.personId,
      event.projectId,
      event.type,
      event.occurredAt,
      event.metadata === null ? null : JSON.stringify(event.metadata),
    );
  }
}