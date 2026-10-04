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
  readRateLimit(bucket: string): RateLimitWindow | null;
  writeRateLimit(bucket: string, window: RateLimitWindow): void;

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
  listProjectsByOrganization(organizationId: string): ProjectInternal[];

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

  // --- audit ---------------------------------------------------------------
  appendAuditEvent(event: AuditEvent): void;
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