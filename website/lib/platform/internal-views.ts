/**
 * Internal projections for the Founder workspace.
 *
 * This is the internal counterpart to `views.ts`, and it is deliberately a
 * separate file rather than a second branch inside the customer projections. The
 * customer file is the safety boundary that keeps internal state out of customer
 * responses; mixing the two would put both kinds of shaping in one place and make
 * a mistake in either one invisible.
 *
 * As in `views.ts`, every result is built key by key from an explicit list —
 * nothing here spreads a stored record — so adding a column to `projects` cannot
 * reach the Founder view by accident either.
 *
 * Audit metadata is deliberately excluded. The Founder view needs to see that an
 * action happened and when; it does not need the stored metadata payload, and
 * keeping it out means note text can never travel through audit history.
 */

import {
  PROJECT_INTAKE_FIELDS,
  type AuditEvent,
  type FounderDecision,
  type InternalQualificationState,
  type Membership,
  type Organization,
  type OrganizationRole,
  type Person,
  type ProjectIntake,
  type ProjectInternal,
  type ProposalInternal,
  type ProposalVersionInternal,
  type ProposalVersionStatus,
} from "./domain";
import type { CustomerProjectStage } from "./views";
import { CUSTOMER_STAGE_LABELS, customerStageFor } from "./views";

/** One person associated with the project, for review context. */
export interface InternalCustomerIdentity {
  personId: string;
  email: string;
  displayName: string | null;
  /** Their customer role in the organization. Null when they hold no membership. */
  customerRole: OrganizationRole | null;
  isProjectCreator: boolean;
}

export interface InternalOrganizationSummary {
  id: string;
  name: string;
  createdAt: number;
}

/** Internal-only project state, exactly as stored. Never customer-facing. */
export interface InternalProjectState {
  qualificationState: InternalQualificationState;
  internalNotes: string | null;
  founderDecision: FounderDecision | null;
  internalNextAction: string | null;
}

/** One internal action, without the stored metadata payload. */
export interface InternalAuditEntry {
  id: string;
  type: string;
  occurredAt: number;
  personId: string | null;
}

export interface InternalIntakeView {
  status: "draft" | "submitted";
  schemaVersion: number;
  answers: Readonly<Record<string, string | null>>;
  lastSavedAt: number;
  submittedAt: number | null;
}

/**
 * Everything the Founder sees for one project under review.
 *
 * Built by `buildInternalReview`, never assembled by a caller, so a page cannot
 * pick its own fields.
 */
export interface InternalProjectReview {
  organization: InternalOrganizationSummary;
  customers: InternalCustomerIdentity[];
  project: {
    reference: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    /** Null until the explicit Start Review action has run. */
    reviewStartedAt: number | null;
  };
  intake: InternalIntakeView | null;
  /** The customer-facing stage, using only approved customer wording. */
  customerStage: CustomerProjectStage;
  customerStageLabel: string;
  internal: InternalProjectState;
  audit: InternalAuditEntry[];
}

/**
 * One row in the Founder project queue.
 *
 * Intentionally narrow. This is a listing surface, not a review surface: it
 * carries what is needed to identify and prioritize a project, and nothing more.
 *
 * Notably absent, and absent by construction rather than by convention:
 * internal notes, qualification state, Founder decision, internal next action,
 * intake answers, customer identity, session data, and audit entries. The queue
 * answers "what is waiting?", and the review page answers "what is in it?".
 */
export interface FounderQueueRow {
  /** Stable customer-visible reference; also the link key to the review page. */
  reference: string;
  title: string;
  /** Organization name, so projects from different tenants are distinguishable. */
  organizationName: string;
  /** When the Intake was submitted; also the queue's primary ordering. */
  submittedAt: number;
  /** Customer-facing stage, using only approved customer wording. */
  customerStage: CustomerProjectStage;
  customerStageLabel: string;
  /** Null until the explicit Start Review action has run. */
  reviewStartedAt: number | null;
  /** Derived from `reviewStartedAt` so the page cannot disagree with the stage. */
  reviewStarted: boolean;
}

function toInternalOrganization(organization: Organization): InternalOrganizationSummary {
  return { id: organization.id, name: organization.name, createdAt: organization.createdAt };
}

function toInternalCustomer(
  person: Person,
  membership: Membership | null,
  createdByPersonId: string,
): InternalCustomerIdentity {
  return {
    personId: person.id,
    email: person.email,
    displayName: person.displayName,
    customerRole: membership ? membership.role : null,
    isProjectCreator: person.id === createdByPersonId,
  };
}

function toInternalIntake(intake: ProjectIntake | null): InternalIntakeView | null {
  if (!intake) return null;
  // Copied field by field from the declared intake fields.
  const answers: Record<string, string | null> = {};
  for (const field of PROJECT_INTAKE_FIELDS) {
    answers[field] = intake.answers[field];
  }
  return {
    status: intake.status,
    schemaVersion: intake.schemaVersion,
    answers,
    lastSavedAt: intake.lastSavedAt,
    submittedAt: intake.submittedAt,
  };
}

export function buildInternalReview(input: {
  project: ProjectInternal;
  organization: Organization;
  customers: InternalCustomerIdentity[];
  intake: ProjectIntake | null;
  auditEvents: AuditEvent[];
}): InternalProjectReview {
  const stage = customerStageFor(input.intake, input.project.reviewStartedAt);
  return {
    organization: toInternalOrganization(input.organization),
    customers: input.customers,
    project: {
      reference: input.project.reference,
      title: input.project.title,
      createdAt: input.project.createdAt,
      updatedAt: input.project.updatedAt,
      reviewStartedAt: input.project.reviewStartedAt,
    },
    intake: toInternalIntake(input.intake),
    customerStage: stage,
    customerStageLabel: CUSTOMER_STAGE_LABELS[stage],
    internal: {
      qualificationState: input.project.qualificationState,
      internalNotes: input.project.internalNotes,
      founderDecision: input.project.founderDecision,
      internalNextAction: input.project.internalNextAction,
    },
    // Metadata is dropped: the Founder sees that an action happened, not the
    // stored payload, so internal note text cannot travel through audit history.
    audit: input.auditEvents.map((event) => ({
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      personId: event.personId,
    })),
  };
}

/** One immutable version row for the Founder proposal view. */
export interface InternalProposalVersionView {
  id: string;
  versionNumber: number;
  status: ProposalVersionStatus;
  summary: string;
  scopeIncluded: string;
  scopeExcluded: string;
  deliverables: string;
  timeline: string;
  assumptions: string;
  commercialTerms: string;
  validUntil: number | null;
  createdByPersonId: string;
  createdAt: number;
  publishedAt: number | null;
}

export interface InternalProposalView {
  /** Stable project reference; also the link key into the proposal surface. */
  projectReference: string;
  proposalId: string | null;
  createdByPersonId: string | null;
  createdAt: number | null;
  latestVersionNumber: number | null;
  latestVersionId: string | null;
  latestVersionStatus: ProposalVersionStatus | null;
  publishedVersionNumber: number | null;
  publishedVersionId: string | null;
  publishedVersionPublishedAt: number | null;
  /** Versions in creation order. */
  versions: InternalProposalVersionView[];
  /** The most recent draft, if any. Null when the latest version is published. */
  latestDraft: InternalProposalVersionView | null;
}

export function buildInternalProposalView(input: {
  projectReference: string;
  proposal: ProposalInternal | null;
  versions: ProposalVersionInternal[];
}): InternalProposalView {
  const proposalId = input.proposal?.id ?? null;
  const createdByPersonId = input.proposal?.createdByPersonId ?? null;
  const createdAt = input.proposal?.createdAt ?? null;

  const versions = input.versions.map((version) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    status: version.status,
    summary: version.summary,
    scopeIncluded: version.scopeIncluded,
    scopeExcluded: version.scopeExcluded,
    deliverables: version.deliverables,
    timeline: version.timeline,
    assumptions: version.assumptions,
    commercialTerms: version.commercialTerms,
    validUntil: version.validUntil,
    createdByPersonId: version.createdByPersonId,
    createdAt: version.createdAt,
    publishedAt: version.publishedAt,
  }));

  const latest = versions[versions.length - 1];
  const latestVersionNumber = latest?.versionNumber ?? null;
  const latestVersionId = latest?.id ?? null;
  const latestVersionStatus = latest?.status ?? null;

  let publishedVersionNumber: number | null = null;
  let publishedVersionId: string | null = null;
  let publishedVersionPublishedAt: number | null = null;
  let latestDraft: InternalProposalVersionView | null = null;

  if (versions.length > 0) {
    // The most recently published version, if any. Iteration is in ascending
    // order, so the last published version encountered is the newest one.
    for (const version of versions) {
      if (version.status === "published") {
        publishedVersionNumber = version.versionNumber;
        publishedVersionId = version.id;
        publishedVersionPublishedAt = version.publishedAt;
      }
    }
    // The most recent draft, if any: the latest version when it is a draft,
    // otherwise the version immediately before it.
    latestDraft = latest?.status === "draft" ? latest : null;
    if (latestDraft === null && latest !== null) {
      const previous = versions[versions.length - 2];
      latestDraft = previous?.status === "draft" ? previous : null;
    }
  }

  return {
    projectReference: input.projectReference,
    proposalId,
    createdByPersonId,
    createdAt,
    latestVersionNumber,
    latestVersionId,
    latestVersionStatus,
    publishedVersionNumber,
    publishedVersionId,
    publishedVersionPublishedAt,
    versions,
    latestDraft,
  };
}

/**
 * Builds one queue row.
 *
 * Takes the already-projected customer stage rather than recomputing it, so the
 * queue cannot disagree with the review page about what stage a project is in.
 */
export function buildFounderQueueRow(input: {
  project: ProjectInternal;
  organizationName: string;
  customerStage: CustomerProjectStage;
  submittedAt: number;
}): FounderQueueRow {
  return {
    reference: input.project.reference,
    title: input.project.title,
    organizationName: input.organizationName,
    submittedAt: input.submittedAt,
    customerStage: input.customerStage,
    customerStageLabel: CUSTOMER_STAGE_LABELS[input.customerStage],
    reviewStartedAt: input.project.reviewStartedAt,
    reviewStarted: input.project.reviewStartedAt !== null,
  };
}


