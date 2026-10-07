/**
 * Customer-facing projections.
 *
 * The ADR forbids relying on hiding internal fields in the UI, so internal state
 * is excluded here in the data shaping itself. Every function below constructs
 * its result key by key from an explicit allow-list — none of them spread a
 * stored record — so adding an internal column to `projects` cannot reach a
 * customer response by accident.
 *
 * The types in this file have no member corresponding to qualification state,
 * internal notes, Founder decisions, internal next actions, or audit metadata,
 * so a customer component cannot reference them even by mistake.
 */

import {
  PROJECT_INTAKE_FIELDS,
  type ProjectIntake,
  type ProjectInternal,
  type ProposalVersionInternal,
} from "./domain";
import { type ProposalContentField } from "./proposal-form";

/**
 * Customer-facing lifecycle stages, using only the approved customer labels
 * from docs/website/customer-platform-requirements.md. Internal outcomes such as
 * "Qualified" or "Not a fit" are deliberately absent and are not mapped here.
 */
export type CustomerProjectStage =
  | "account_created"
  | "project_started"
  | "intake_information_submitted"
  | "intake_review"
  | "requirements_confirmed"
  | "proposal_prepared"
  | "proposal_accepted"
  | "agreement_completed"
  | "payment_satisfied"
  | "delivery_onboarding_setup"
  | "milestones"
  | "client_review"
  | "qa"
  | "handover"
  | "completed";

export const CUSTOMER_STAGE_LABELS: Record<CustomerProjectStage, string> = {
  account_created: "Account created",
  project_started: "Project started",
  intake_information_submitted: "Project Intake — Information submitted",
  intake_review: "Project Intake — Review",
  requirements_confirmed: "Requirements confirmed",
  proposal_prepared: "Proposal prepared",
  proposal_accepted: "Proposal accepted",
  agreement_completed: "Agreement completed",
  payment_satisfied: "Payment satisfied",
  delivery_onboarding_setup: "Delivery Onboarding — Project setup",
  milestones: "Milestones",
  client_review: "Client review",
  qa: "QA",
  handover: "Handover",
  completed: "Completed",
};

/**
 * The single date format the portal surfaces use.
 *
 * Was declared separately in each page, which meant the same five-line literal
 * appeared four times and a formatting change meant four edits. Presentation
 * concerns belong here with the other shaping helpers rather than being copied
 * into route files.
 */
export const PORTAL_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export interface CustomerProjectSummary {
  /** Stable, non-sensitive reference. Not the internal record id. */
  reference: string;
  title: string;
  stage: CustomerProjectStage;
  stageLabel: string;
  intakeStatus: "draft" | "submitted";
  answeredFieldCount: number;
  totalFieldCount: number;
  lastSavedAt: number;
  createdAt: number;
  /**
   * Whether the project has at least one published proposal version.
   *
   * The only proposal fact a customer sees beyond the published proposal itself:
   * it drives the dashboard link. It is `false` when there is no proposal and
   * when every version is still a draft, so it cannot reveal that a draft exists.
   */
  hasPublishedProposal: boolean;
}

export interface CustomerIntake {
  status: "draft" | "submitted";
  schemaVersion: number;
  /** Answers only. Intake carries no internal state at all. */
  answers: Readonly<Record<string, string | null>>;
  lastSavedAt: number;
  submittedAt: number | null;
}

export interface CustomerProjectDetail {
  project: CustomerProjectSummary;
  intake: CustomerIntake | null;
}

export function countAnsweredFields(intake: ProjectIntake): number {
  let answered = 0;
  for (const field of PROJECT_INTAKE_FIELDS) {
    const value = intake.answers[field];
    if (typeof value === "string" && value.trim() !== "") {
      answered += 1;
    }
  }
  return answered;
}

/**
 * Maps a stored project to the customer stage shown in the customer timeline.
 *
 * Derived from intake progress plus the Founder's explicit Start Review action,
 * so internal qualification state — and internal notes, the Founder decision,
 * and the internal next action — can never influence what a customer sees.
 *
 * The intake parameter is structural: only `status` is read. A `ProjectIntake`
 * satisfies it, and a caller that already knows the status (the Founder queue,
 * which only ever holds submitted intakes) can pass just that without casting.
 *
 * `reviewStartedAt` defaults to null so callers that have no internal context
 * cannot accidentally advance the stage.
 */
export function customerStageFor(
  intake: Pick<ProjectIntake, "status"> | null,
  reviewStartedAt: number | null = null,
): CustomerProjectStage {
  if (!intake || intake.status === "draft") {
    return "project_started";
  }
  return reviewStartedAt === null ? "intake_information_submitted" : "intake_review";
}

export function toCustomerProjectSummary(
  project: ProjectInternal,
  intake: ProjectIntake | null,
  hasPublishedProposal: boolean,
): CustomerProjectSummary {
  const stage = customerStageFor(intake, project.reviewStartedAt);
  return {
    reference: project.reference,
    title: project.title,
    stage,
    stageLabel: CUSTOMER_STAGE_LABELS[stage],
    intakeStatus: intake?.status ?? "draft",
    answeredFieldCount: intake ? countAnsweredFields(intake) : 0,
    totalFieldCount: PROJECT_INTAKE_FIELDS.length,
    lastSavedAt: intake?.lastSavedAt ?? project.createdAt,
    createdAt: project.createdAt,
    hasPublishedProposal,
  };
}

export function toCustomerIntake(intake: ProjectIntake): CustomerIntake {
  // Copied field by field from the declared intake fields; anything else that
  // may be added to the stored record later is excluded.
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

export function toCustomerProjectDetail(
  project: ProjectInternal,
  intake: ProjectIntake | null,
  hasPublishedProposal: boolean,
): CustomerProjectDetail {
  return {
    project: toCustomerProjectSummary(project, intake, hasPublishedProposal),
    intake: intake ? toCustomerIntake(intake) : null,
  };
}

/**
 * Customer-facing projection of a published proposal version.
 *
 * Built field by field from an explicit allow-list, so a stored proposal or
 * version column added later cannot reach a customer response by accident. It
 * carries only the content the Customer Proposal Review ADR approves for
 * customer visibility: the project reference, the version number, the
 * publication instant, and the free-text commercial baseline. Internal ids,
 * audit metadata, drafts, and any Founder/internal state are absent by
 * construction.
 */
export interface CustomerProposalView {
  projectReference: string;
  versionNumber: number;
  publishedAt: number;
  summary: string;
  scopeIncluded: string;
  scopeExcluded: string;
  deliverables: string;
  timeline: string;
  assumptions: string;
  commercialTerms: string;
  validUntil: number | null;
}

/**
 * The approved proposal content fields, in display order, with their labels.
 *
 * One definition shared by the customer proposal view and the Founder proposal
 * view, so the two surfaces cannot drift apart in which fields they render or in
 * what order. `name` is typed against the fields the proposal form actually
 * writes, so a displayed field cannot exist without being parseable.
 */
export interface ProposalDisplayField {
  name: ProposalContentField;
  label: string;
}

export const PROPOSAL_DISPLAY_FIELDS: readonly ProposalDisplayField[] = [
  { name: "summary", label: "Summary" },
  { name: "scopeIncluded", label: "In scope" },
  { name: "scopeExcluded", label: "Out of scope" },
  { name: "deliverables", label: "Deliverables" },
  { name: "timeline", label: "Timeline" },
  { name: "assumptions", label: "Assumptions" },
  { name: "commercialTerms", label: "Commercial terms" },
];

export function toCustomerProposal(
  projectReference: string,
  version: ProposalVersionInternal,
  publishedAt: number,
): CustomerProposalView {
  return {
    projectReference,
    versionNumber: version.versionNumber,
    publishedAt,
    summary: version.summary,
    scopeIncluded: version.scopeIncluded,
    scopeExcluded: version.scopeExcluded,
    deliverables: version.deliverables,
    timeline: version.timeline,
    assumptions: version.assumptions,
    commercialTerms: version.commercialTerms,
    validUntil: version.validUntil,
  };
}

/**
 * The customer-visible standing of the current published proposal version,
 * derived from the immutable response history.
 *
 * There is deliberately no stored "response status" column on the proposal, the
 * version, or the project: this value is computed from `proposal_responses`
 * every time it is read, so the two can never disagree.
 *
 * Built field by field from an explicit allow-list. It carries no other
 * person's identity, no message text, no internal id, and no capability or
 * authorization detail beyond whether *this* viewer holds the accept action.
 */
export type CustomerProposalResponseState = "open" | "changes_requested" | "accepted";

export interface CustomerProposalResponseStanding {
  /** The customer-visible version number the standing belongs to. */
  versionNumber: number;
  state: CustomerProposalResponseState;
  /**
   * Whether this viewer may submit an Accept for this version right now:
   * organization Owner/Admin, and the version still open. False otherwise, so
   * the page never renders an accept control the viewer cannot use — and it
   * reveals nothing about any other person or about internal state.
   */
  canAccept: boolean;
}

export const PROPOSAL_RESPONSE_STATE_LABELS: Record<
  CustomerProposalResponseState,
  string
> = {
  open: "Open for a response",
  changes_requested: "Changes requested",
  accepted: "Accepted",
};

export function toCustomerProposalResponseStanding(input: {
  versionNumber: number;
  state: CustomerProposalResponseState;
  canAccept: boolean;
}): CustomerProposalResponseStanding {
  return {
    versionNumber: input.versionNumber,
    state: input.state,
    canAccept: input.canAccept,
  };
}