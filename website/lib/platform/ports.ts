/**
 * Provider ports.
 *
 * The services depend only on these interfaces, never on a concrete database or
 * email vendor. That is the ADR's provider-abstraction boundary: swapping
 * `node:sqlite` for a managed database, or the local sink for a real provider,
 * must not change any authorization or domain rule.
 */

import type {
  AuditEvent,
  AuthenticationChallenge,
  FounderDecision,
  InternalCapabilityGrant,
  InternalCapabilityName,
  InternalQualificationState,
  Membership,
  Organization,
  Person,
  ProjectAccess,
  ProjectId,
  ProjectIntake,
  ProjectIntakePatch,
  ProjectInternal,
  Session,
} from "./domain";

export interface RateLimitWindow {
  windowStart: number;
  count: number;
}

/**
 * A project paired with the fact that its Project Intake was submitted.
 *
 * Carries only the submission timestamp rather than the whole intake: the queue
 * needs to know that an intake exists and when it arrived, and returning the
 * answers would put customer-submitted content into a listing surface for no
 * reason.
 */
export interface SubmittedIntakeProject {
  project: ProjectInternal;
  submittedAt: number;
}

export interface RateLimitDecision extends RateLimitWindow {
  /**
   * False when the attempt was refused. `count` is then the count that was
   * already recorded; no write happened.
   */
  allowed: boolean;
  /** Seconds until the current window frees a slot. Only set when `allowed` is false. */
  retryAfterSeconds: number;
}

/**
 * Data-access port. Every method is the minimum surface the services need; the
 * service layer owns all authorization, so no method takes an "acting user".
 */
export interface PlatformStore {
  /**
   * Runs `fn` inside a single database transaction. Nested calls join the
   * outer transaction instead of starting a new one, so composing services does
   * not silently drop atomicity.
   */
  transaction<T>(fn: (store: PlatformStore) => T): T;

  close(): void;

  // --- rate limiting -------------------------------------------------------
  /**
   * Records one attempt against a bucket and reports the outcome.
   *
   * Implementations must perform the read, the limit decision, and the write as a
   * single atomic step. A separate read-then-write lets two concurrent callers
   * both observe the same pre-increment count and both be admitted, so the limit
   * would be advisory rather than enforced.
   *
   * The policy (`limit`, `windowMs`) is supplied by the caller; the store only
   * supplies atomicity.
   */
  consumeRateLimit(
    bucket: string,
    input: { now: number; windowMs: number; limit: number },
  ): RateLimitDecision;

  // --- people --------------------------------------------------------------
  findPersonByEmailHash(emailHash: string): Person | null;
  /** Lookup by the server-held id from a session. Never by a client-supplied id. */
  findPersonById(id: string): Person | null;
  createPerson(input: {
    id: string;
    email: string;
    emailHash: string;
    displayName: string | null;
    now: number;
  }): Person;

  // --- authentication challenges ------------------------------------------
  createChallenge(challenge: AuthenticationChallenge): void;
  /**
   * Reads a challenge without consuming it, so a wrong secret cannot be used to
   * burn a valid link. Returns the stored record; it holds only the secret hash.
   */
  findChallenge(id: string): AuthenticationChallenge | null;
  /**
   * Atomically marks an unexpired, unconsumed challenge as consumed and returns
   * it, or returns null when it is unknown, already consumed, or expired. The
   * condition lives in the UPDATE so two concurrent verifications cannot both
   * succeed.
   */
  consumeChallenge(input: { id: string; now: number }): AuthenticationChallenge | null;

  // --- sessions ------------------------------------------------------------
  createSession(session: Session): void;
  /** `id` is the hashed cookie value, never the cookie value itself. */
  findSessionById(sessionId: string): Session | null;
  /** Refreshes `last_used_at`. Callers throttle this so it is not a per-request write. */
  touchSession(input: { id: string; now: number }): void;
  revokeSession(input: { id: string; now: number }): boolean;

  // --- organizations -------------------------------------------------------
  findOrganization(id: string): Organization | null;
  createOrganization(input: { id: string; name: string; now: number }): Organization;
  findMembershipByPerson(personId: string): Membership | null;
  findMembership(input: { personId: string; organizationId: string }): Membership | null;
  listMembershipsByOrganization(organizationId: string): Membership[];
  createMembership(input: {
    id: string;
    personId: string;
    organizationId: string;
    role: Membership["role"];
    now: number;
  }): Membership;

  // --- projects ------------------------------------------------------------
  /**
   * `idempotencyKey` is stored alongside the project under a database unique
   * constraint, so a retried "Start Your Project" resolves to the same project
   * instead of creating a second one.
   */
  createProject(input: {
    project: ProjectInternal;
    idempotencyKey: string | null;
  }): ProjectInternal;
  findProjectByIdempotencyKey(
    organizationId: string,
    idempotencyKey: string,
  ): ProjectInternal | null;
  findProject(id: ProjectId): ProjectInternal | null;
  /** Lookup by the customer-facing reference, scoped to one organization. */
  findProjectByReference(
    organizationId: string,
    reference: string,
  ): ProjectInternal | null;
  /**
   * Lookup by reference across organizations.
   *
   * Project references are globally unique, so this resolves exactly one project
   * or none. Two callers need it: the internal workspace, which is authorized by
   * the internal capability rather than by organization membership and so has no
   * organization to scope the search with, and reference allocation, which has
   * to check the whole platform because uniqueness is platform-wide.
   */
  findProjectByReferenceGlobal(reference: string): ProjectInternal | null;
  listProjectsByOrganization(organizationId: string): ProjectInternal[];

  /**
   * Projects whose Project Intake has been submitted, across all organizations.
   *
   * For the internal Founder queue only. It is deliberately unscoped: the Founder
   * is authorized by the internal capability and holds membership in no customer
   * organization, so an organization-scoped read would be wrong rather than merely
   * inconvenient.
   *
   * Draft intakes are excluded in SQL rather than filtered afterwards, so a
   * half-finished intake can never appear in the queue at all. Ordering is fixed
   * here rather than in the caller: newest submission first, then project
   * reference, so the queue is stable across requests. `reference` is globally
   * unique, which is what makes the tie-break a total order.
   */
  listSubmittedIntakeProjects(limit: number): SubmittedIntakeProject[];

  // --- project access ------------------------------------------------------
  findProjectAccess(projectId: ProjectId, personId: string): ProjectAccess | null;
  grantProjectAccess(access: ProjectAccess): ProjectAccess;
  revokeProjectAccess(input: { projectId: ProjectId; personId: string; now: number }): boolean;
  listActiveProjectAccess(projectId: ProjectId): ProjectAccess[];

  // --- project intake ------------------------------------------------------
  createProjectIntake(intake: ProjectIntake): ProjectIntake;
  findProjectIntakeByProject(projectId: ProjectId): ProjectIntake | null;
  saveProjectIntake(input: {
    id: string;
    patch: ProjectIntakePatch;
    status: ProjectIntake["status"] | null;
    now: number;
  }): ProjectIntake;

  // --- internal capabilities ------------------------------------------------
  /**
   * Grants an internal capability. Re-granting an existing row clears a previous
   * revocation, so the grant is restored rather than duplicated.
   */
  grantInternalCapability(grant: InternalCapabilityGrant): InternalCapabilityGrant;
  revokeInternalCapability(input: {
    personId: string;
    capability: InternalCapabilityName;
    now: number;
  }): boolean;
  findInternalCapability(
    personId: string,
    capability: InternalCapabilityName,
  ): InternalCapabilityGrant | null;
  listActiveInternalCapabilities(personId: string): InternalCapabilityGrant[];

  // --- internal project state -----------------------------------------------
  /**
   * Writes internal-only project state. Every field is optional, so one action
   * never clears the others; `now` also refreshes `updated_at`.
   *
   * Nothing here is reachable from a customer request: the customer services do
   * not call it, and the customer projections have no field for the values it
   * writes.
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
  }): ProjectInternal;

  // --- audit ---------------------------------------------------------------
  appendAuditEvent(event: AuditEvent): void;
  /** Newest-first audit history for one project, for the internal workspace. */
  listAuditEventsForProject(projectId: string, limit: number): AuditEvent[];
}

/**
 * Email delivery port. Delivered messages carry the one-time link, so this is
 * the only component that ever holds a live secret, and it hands the message
 * to the transport rather than storing or logging it.
 */
export interface SignInMessage {
  to: string;
  /** The full one-time URL. Secret-bearing. */
  signInUrl: string;
  expiresAt: number;
}

export interface EmailDelivery {
  sendSignInLink(message: SignInMessage): Promise<void>;
}