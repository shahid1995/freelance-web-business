/**
 * Customer platform domain records.
 *
 * These types are the provider-neutral logical model described in
 * docs/decisions/2026-10-04-customer-platform-foundation.md. They describe
 * what the platform stores, not how or where it is stored.
 *
 * Boundary rule enforced throughout this layer: records that carry internal
 * business state are named with an `Internal` suffix so they cannot be passed
 * to a customer-facing mapper by accident. Customer responses are built from
 * the `views.ts` projection types, which have no internal fields at all.
 */

export type PersonId = string;
export type OrganizationId = string;
export type MembershipId = string;
export type ProjectId = string;
export type ProjectIntakeId = string;
export type ChallengeId = string;
export type SessionId = string;
export type AuditEventId = string;

/**
 * Internal business roles. `owner` is the first user of an organization;
 * `owner` and `admin` have identical authority in this slice.
 */
export type OrganizationRole = "owner" | "admin" | "member";

export function isOrganizationAdministrator(role: OrganizationRole): boolean {
  return role === "owner" || role === "admin";
}

export interface Person {
  id: PersonId;
  email: string;
  /** SHA-256 of the normalised email. Used for lookup so the raw address is not a join key. */
  emailHash: string;
  displayName: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Organization {
  id: OrganizationId;
  name: string;
  createdAt: number;
}

export interface Membership {
  id: MembershipId;
  personId: PersonId;
  organizationId: OrganizationId;
  role: OrganizationRole;
  createdAt: number;
}

/**
 * Internal qualification outcomes, from docs/website/customer-platform-requirements.md
 * section 7. Explicitly **not** customer-facing copy.
 */
export const INTERNAL_QUALIFICATION_STATES = [
  "unreviewed",
  "qualified",
  "clarification_required",
  "not_a_fit",
  "no_decision",
] as const;

export type InternalQualificationState = (typeof INTERNAL_QUALIFICATION_STATES)[number];

export function isInternalQualificationState(
  value: unknown,
): value is InternalQualificationState {
  return (
    typeof value === "string" &&
    (INTERNAL_QUALIFICATION_STATES as readonly string[]).includes(value)
  );
}

/**
 * The Founder decision vocabulary, from the approved Founder Workspace ADR
 * section 4.2.
 *
 * Distinct from qualification state: that describes the internal *assessment*,
 * this records the operational *action* after review. The two are stored
 * separately, are never derived from one another, and neither is customer-facing.
 */
export const FOUNDER_DECISIONS = [
  "proceed",
  "clarification_required",
  "not_a_fit",
  "hold",
] as const;

export type FounderDecision = (typeof FOUNDER_DECISIONS)[number];

export function isFounderDecision(value: unknown): value is FounderDecision {
  return (
    typeof value === "string" && (FOUNDER_DECISIONS as readonly string[]).includes(value)
  );
}

export interface ProjectInternal {
  id: ProjectId;
  organizationId: OrganizationId;
  /** Short, stable, non-sensitive reference shown to the customer (e.g. PRJ-7F3K2QD4). */
  reference: string;
  title: string;
  createdByPersonId: PersonId;
  createdAt: number;
  updatedAt: number;
  /**
   * When the Founder explicitly started review. Null until then.
   *
   * This is the only thing that moves the customer-facing stage on to *Project
   * Intake — Review*. It is written by the explicit Start Review action and by
   * nothing else, so opening or reading a review cannot change what the customer
   * sees.
   */
  reviewStartedAt: number | null;
  /**
   * Internal-only business state. None of the fields below may appear in a
   * customer response, customer page, or customer email. They are stored
   * because the Founder workspace will own them, not because this slice
   * exposes them.
   */
  qualificationState: InternalQualificationState;
  internalNotes: string | null;
  founderDecision: FounderDecision | null;
  internalNextAction: string | null;
}

/**
 * Internal capabilities a person may hold.
 *
 * A dedicated concept, deliberately separate from `OrganizationRole`: internal
 * access is never inferred from, or granted through, customer membership.
 */
export type InternalCapabilityName = "founder";

/** One internal capability held by one person. */
export interface InternalCapabilityGrant {
  personId: PersonId;
  capability: InternalCapabilityName;
  grantedAt: number;
  revokedAt: number | null;
}

export type ProposalId = string;
export type ProposalVersionId = string;
export type ProposalResponseId = string;

/**
 * Version state.
 *
 * `draft` is Founder-only and never leaves the internal workspace. `published`
 * records that the Founder explicitly made that version available; it does not
 * mean the customer has seen it, accepted it, or agreed to anything. The
 * customer-facing step is a separate, later decision.
 */
export type ProposalVersionStatus = "draft" | "published";

export const PROPOSAL_VERSION_STATUSES = ["draft", "published"] as const;

export function isProposalVersionStatus(value: unknown): value is ProposalVersionStatus {
  return (
    typeof value === "string" &&
    (PROPOSAL_VERSION_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * The commercial baseline a version carries.
 *
 * Deliberately all free text. The approved proposal template requires commercial
 * amounts to come from Founder-approved pricing, and pricing is a separate,
 * unapproved Founder decision — so there is deliberately no amount or currency
 * column here to pre-empt it. `commercialTerms` is where the Founder records the
 * terms they have approved; turning that into structured money is that later
 * decision's job.
 */
export interface ProposalContent {
  summary: string;
  scopeIncluded: string;
  scopeExcluded: string;
  deliverables: string;
  timeline: string;
  assumptions: string;
  commercialTerms: string;
  /** Optional expiry the Founder sets for this version. Not a pricing field. */
  validUntil: number | null;
}

/** The stable proposal record: one per project. */
export interface ProposalInternal {
  id: ProposalId;
  projectId: ProjectId;
  /** Founder who created the proposal. */
  createdByPersonId: PersonId;
  createdAt: number;
  updatedAt: number;
}

/**
 * One immutable version of a proposal.
 *
 * Content is written once at creation and never updated. Publishing only sets
 * `publishedAt`, so what a version said and when it was made available are both
 * durable facts.
 */
export interface ProposalVersionInternal extends ProposalContent {
  id: ProposalVersionId;
  proposalId: ProposalId;
  /** 1-based, gapless within a proposal. */
  versionNumber: number;
  status: ProposalVersionStatus;
  /** Founder who authored this version. */
  createdByPersonId: PersonId;
  createdAt: number;
  /** Null while the version is a draft. Set once, when the Founder publishes it. */
  publishedAt: number | null;
}

/**
 * The two — and only two — customer actions on a published proposal version.
 *
 * From the accepted Customer Proposal Response ADR: no reject, no decline, no
 * counter-offer, no comment-only action, and no implicit action. The stored
 * values match the `proposal_responses.action` CHECK constraint.
 */
export const PROPOSAL_RESPONSE_ACTIONS = ["changes_requested", "accepted"] as const;

export type ProposalResponseAction = (typeof PROPOSAL_RESPONSE_ACTIONS)[number];

export function isProposalResponseAction(
  value: unknown,
): value is ProposalResponseAction {
  return (
    typeof value === "string" &&
    (PROPOSAL_RESPONSE_ACTIONS as readonly string[]).includes(value)
  );
}

/**
 * One immutable customer response to exactly one proposal version.
 *
 * Append-only: there is no update or delete path, mirroring how proposal
 * versions are handled. The row is the primary evidence for "who responded, to
 * which version, when" — and, for a request for changes, what they asked for.
 * `message` is the only place a customer's request text is stored; it never
 * travels into audit metadata.
 *
 * The current standing of a version (open / changes requested / accepted) is
 * always derived from these rows, never stored separately.
 */
export interface ProposalResponseInternal {
  id: ProposalResponseId;
  personId: PersonId;
  organizationId: OrganizationId;
  projectId: ProjectId;
  proposalId: ProposalId;
  proposalVersionId: ProposalVersionId;
  /** Customer-visible version number, denormalized from the immutable version. */
  versionNumber: number;
  action: ProposalResponseAction;
  /** Required and non-empty for `changes_requested`; null for `accepted`. */
  message: string | null;
  /** Idempotency key. UNIQUE in the database, so a replay records no second row. */
  actionKey: string;
  createdAt: number;
}

/**
 * Explicit project grant for an ordinary member. Administrators do not need a
 * grant: organization-wide access is derived from the membership role.
 */
export interface ProjectAccess {
  projectId: ProjectId;
  personId: PersonId;
  grantedAt: number;
  revokedAt: number | null;
}

export type ProjectIntakeStatus = "draft" | "submitted";

/**
 * The Project Intake answer fields, in the order they are asked. This list is
 * the single source of truth: the storage adapter derives its columns from it
 * and the intake service validates incoming keys against it, so a client cannot
 * write an unlisted field (including an internal one) by adding it to the body.
 */
export const PROJECT_INTAKE_FIELDS = [
  "serviceNeed",
  "businessProblem",
  "desiredOutcome",
  "targetUsers",
  "pagesScreensWorkflows",
  "existingSiteOrSystem",
  "requiredFunctionality",
  "integrations",
  "existingAssets",
  "timing",
  "constraints",
  "dependencies",
  "otherInformation",
] as const;

export type ProjectIntakeField = (typeof PROJECT_INTAKE_FIELDS)[number];

/** Storage column name for each intake field. Explicit so the mapping cannot drift. */
export const PROJECT_INTAKE_COLUMNS: Record<ProjectIntakeField, string> = {
  serviceNeed: "service_need",
  businessProblem: "business_problem",
  desiredOutcome: "desired_outcome",
  targetUsers: "target_users",
  pagesScreensWorkflows: "pages_screens_workflows",
  existingSiteOrSystem: "existing_site_or_system",
  requiredFunctionality: "required_functionality",
  integrations: "integrations",
  existingAssets: "existing_assets",
  timing: "timing",
  constraints: "constraints",
  dependencies: "dependencies",
  otherInformation: "other_information",
};

export const PROJECT_INTAKE_FIELD_LABELS: Record<ProjectIntakeField, string> = {
  serviceNeed: "What do you need built, improved, or maintained?",
  businessProblem: "What business problem are you trying to solve?",
  desiredOutcome: "What does a good outcome look like for you?",
  targetUsers: "Who is the website or application for?",
  pagesScreensWorkflows: "Which pages, screens, or workflows are involved?",
  existingSiteOrSystem: "What already exists today?",
  requiredFunctionality: "What must it do?",
  integrations: "Does it need to connect to other tools or systems?",
  existingAssets: "Do you have existing content, brand, or code to reuse?",
  timing: "Do you have a target date or timing in mind?",
  constraints: "Are there constraints we should know about?",
  dependencies: "Does anything depend on other people, tools, or approvals?",
  otherInformation: "Anything else we should know?",
};

/** Intake is always stored against exactly one project, with this schema version. */
export const PROJECT_INTAKE_SCHEMA_VERSION = 1;

export type ProjectIntakeAnswers = {
  [Field in ProjectIntakeField]: string | null;
};

export interface ProjectIntake {
  id: ProjectIntakeId;
  projectId: ProjectId;
  status: ProjectIntakeStatus;
  schemaVersion: number;
  answers: ProjectIntakeAnswers;
  createdAt: number;
  updatedAt: number;
  lastSavedAt: number;
  submittedAt: number | null;
}

/** A partial intake save. Absent keys are preserved; an explicit empty string clears a field. */
export type ProjectIntakePatch = {
  [Field in ProjectIntakeField]?: string | null;
};

export function emptyProjectIntakeAnswers(): ProjectIntakeAnswers {
  const answers = {} as ProjectIntakeAnswers;
  for (const field of PROJECT_INTAKE_FIELDS) {
    answers[field] = null;
  }
  return answers;
}

/**
 * One-time sign-in challenge. Only the hash of the secret is retained; the raw
 * secret exists solely inside the emailed link.
 */
export interface AuthenticationChallenge {
  id: ChallengeId;
  email: string;
  emailHash: string;
  secretHash: string;
  createdAt: number;
  expiresAt: number;
  consumedAt: number | null;
}

/**
 * Server-side session. `id` is the SHA-256 of the opaque value held in the
 * browser cookie, so the stored record cannot be replayed directly.
 */
export interface Session {
  id: string;
  personId: PersonId;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  revokedAt: number | null;
}

/** Auditable record of a state change. Internal: never returned to a customer. */
export interface AuditEvent {
  id: AuditEventId;
  organizationId: OrganizationId | null;
  personId: PersonId | null;
  projectId: ProjectId | null;
  type: string;
  occurredAt: number;
  /** Private metadata. Never serialized to a customer response. */
  metadata: Record<string, unknown> | null;
}

export type AuditEventType =
  | "person.created"
  | "session.created"
  | "session.revoked"
  | "organization.created"
  | "membership.created"
  | "project.created"
  | "project_access.granted"
  | "project_access.revoked"
  | "project_intake.saved"
  | "project_intake.submitted"
  // Founder workspace. Internal-only; never returned to a customer.
  | "project_intake.review_started"
  | "project.customer_stage_changed"
  | "project.qualification_changed"
  | "project.internal_note_added"
  | "project.internal_note_updated"
  | "project.founder_decision_recorded"
  | "project.internal_next_action_recorded"
  // Proposal foundation. Internal metadata only — never proposal content.
  | "proposal.created"
  | "proposal_version.created"
  | "proposal_version.published"
  // Customer proposal response. Metadata carries identifiers only — never the
  // customer's request-for-changes message and never proposal content.
  | "proposal_response.accepted"
  | "proposal_response.changes_requested";
