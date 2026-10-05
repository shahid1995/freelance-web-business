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
} from "./domain";

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
): CustomerProjectDetail {
  return {
    project: toCustomerProjectSummary(project, intake),
    intake: intake ? toCustomerIntake(intake) : null,
  };
}