/**
 * Project Intake.
 *
 * Intake answers are the customer's onboarding information, stored against the
 * project they belong to so progress survives leaving and returning.
 *
 * Two rules do the real work here:
 *
 * - **Partial saves preserve prior values.** Only keys actually present in the
 *   incoming patch are written, so submitting one field cannot clear the rest.
 * - **The field list is closed.** Incoming keys are validated against the
 *   declared intake fields, so a client that adds an unlisted key — including
 *   something like an internal qualification field — is rejected outright rather
 *   than mass-assigned onto the record.
 *
 * Every read and write goes through the authorization check first. Nothing here
 * is trusted because the client already passed it once.
 */

import {
  PROJECT_INTAKE_FIELDS,
  type ProjectId,
  type ProjectIntakeField,
  type ProjectIntakePatch,
} from "./domain";
import type { Clock } from "./clock";
import { requireProjectAccess } from "./authorization";
import { NotFoundError, ValidationError } from "./errors";
import type { PlatformStore } from "./ports";
import type { CustomerProjectDetail } from "./views";
import { toCustomerProjectDetail } from "./views";

const MAX_FIELD_LENGTH = 5000;

export interface IntakeServiceOptions {
  store: PlatformStore;
  clock: Clock;
  newId: () => string;
}

/**
 * Normalizes one answer value. An empty or whitespace-only value clears the
 * field; everything else is trimmed and length-checked.
 *
 * Called both at the request boundary and again inside the service, so the
 * stored value is normalized no matter which caller reaches the write.
 */
export function normalizeIntakeValue(rawValue: unknown): string | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }
  if (typeof rawValue !== "string") {
    throw new ValidationError("Intake answers must be text.");
  }
  const value = rawValue.trim();
  if (value.length > MAX_FIELD_LENGTH) {
    throw new ValidationError(`Keep each answer under ${MAX_FIELD_LENGTH} characters.`);
  }
  return value === "" ? null : value;
}

/**
 * Validates and normalizes raw form input into a partial intake patch.
 *
 * Rejects unknown keys, non-string values, and over-long values. An explicitly
 * empty string clears a field; an absent key leaves the saved value alone.
 */
export function parseIntakePatch(input: Record<string, unknown>): ProjectIntakePatch {
  const patch: Record<string, string | null> = {};
  const allowed = new Set<string>(PROJECT_INTAKE_FIELDS);

  for (const [key, rawValue] of Object.entries(input)) {
    if (!allowed.has(key)) {
      // Never write an unlisted column, whatever the caller claims it is.
      throw new ValidationError("That intake field is not part of Project Intake.");
    }
    patch[key] = normalizeIntakeValue(rawValue);
  }

  return patch as ProjectIntakePatch;
}

export class IntakeService {
  constructor(private readonly options: IntakeServiceOptions) {}

  /** Reads the intake for resume. Authorizes first, then loads. */
  read(personId: string, projectId: ProjectId): CustomerProjectDetail {
    const { project } = requireProjectAccess(this.options.store, personId, projectId);
    const intake = this.options.store.findProjectIntakeByProject(projectId);
    if (!intake) {
      throw new NotFoundError("Project Intake was not found for this project.");
    }
    return toCustomerProjectDetail(project, intake);
  }

  /**
   * Saves draft progress.
   *
   * Only supplied fields change; every other saved answer is preserved. The
   * project record is never written here, so saving a draft cannot move internal
   * qualification state.
   */
  saveDraft(input: {
    personId: string;
    projectId: ProjectId;
    patch: ProjectIntakePatch;
  }): CustomerProjectDetail {
    const { project } = requireProjectAccess(
      this.options.store,
      input.personId,
      input.projectId,
    );
    const intake = this.options.store.findProjectIntakeByProject(input.projectId);
    if (!intake) {
      throw new NotFoundError("Project Intake was not found for this project.");
    }
    if (intake.status === "submitted") {
      throw new ValidationError(
        "This Project Intake has already been submitted.",
      );
    }

    // Only keys present in the patch are written; every other saved answer is
    // left as it is. Values are re-normalized here so a caller that skipped the
    // request boundary still cannot store an untrimmed or over-long answer.
    const patch: ProjectIntakePatch = {};
    for (const [key, value] of Object.entries(input.patch)) {
      patch[key as ProjectIntakeField] = normalizeIntakeValue(value);
    }

    const now = this.options.clock.now();
    const saved = this.options.store.transaction(() => {
      const updated = this.options.store.saveProjectIntake({
        id: intake.id,
        patch,
        status: null,
        now,
      });
      this.options.store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: project.organizationId,
        personId: input.personId,
        projectId: project.id,
        type: "project_intake.saved",
        occurredAt: now,
        metadata: { fields: Object.keys(patch).length },
      });
      return updated;
    });

    return toCustomerProjectDetail(project, saved);
  }

  /**
   * Marks the intake as submitted. Kept separate from saving so a customer can
   * keep working on a draft without changing its state.
   */
  submit(personId: string, projectId: ProjectId): CustomerProjectDetail {
    const { project } = requireProjectAccess(this.options.store, personId, projectId);
    const intake = this.options.store.findProjectIntakeByProject(projectId);
    if (!intake) {
      throw new NotFoundError("Project Intake was not found for this project.");
    }

    const now = this.options.clock.now();
    const updated = this.options.store.transaction(() => {
      const result = this.options.store.saveProjectIntake({
        id: intake.id,
        patch: {},
        status: "submitted",
        now,
      });
      this.options.store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: project.organizationId,
        personId,
        projectId: project.id,
        type: "project_intake.submitted",
        occurredAt: now,
        metadata: null,
      });
      return result;
    });

    return toCustomerProjectDetail(project, updated);
  }
}