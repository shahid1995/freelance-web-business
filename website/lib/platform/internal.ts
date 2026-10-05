/**
 * Founder workspace.
 *
 * The internal service behind the approved Founder Workspace ADR. Everything the
 * Founder can read or change under `/internal` goes through here, and every
 * operation begins with the internal capability check.
 *
 * Three rules shape this module.
 *
 * 1. **Internal authorization is separate.** `requireFounderCapability` runs
 *    before anything else and is not part of the customer policy matrix, so an
 *    organization owner or admin cannot reach any of it by holding a customer
 *    role.
 *
 * 2. **Reading changes nothing.** `review` performs no write and no state
 *    change of any kind. The customer-facing stage moves on to *Project Intake —
 *    Review* only through the explicit `startReview` action, because the stage is
 *    derived from `reviewStartedAt` and nothing else writes it.
 *
 * 3. **Internal state never leaks outward.** Nothing here is reachable from a
 *    customer request, and the customer projections in `views.ts` are untouched.
 *    The Founder-facing projection is built separately in `internal-views.ts`.
 */

import {
  isFounderDecision,
  isInternalQualificationState,
  type AuditEventType,
  type FounderDecision,
  type Person,
  type ProjectId,
} from "./domain";
import type { Clock } from "./clock";
import { requireFounderCapability } from "./authorization";
import { NotFoundError, ValidationError } from "./errors";
import type { PlatformStore } from "./ports";
import type { InternalCustomerIdentity, InternalProjectReview } from "./internal-views";
import { buildInternalReview } from "./internal-views";

const MAX_INTERNAL_TEXT = 5000;
const AUDIT_HISTORY_LIMIT = 50;

export interface FounderWorkspaceOptions {
  store: PlatformStore;
  clock: Clock;
  newId: () => string;
  /**
   * SHA-256 email hashes that hold the `founder` capability, from server-side
   * configuration.
   *
   * This is the controlled bootstrap the ADR requires for the initial
   * assignment: a person whose address hash is listed holds the capability,
   * and nobody else can be given it. Empty by default, so nothing is enabled
   * until a deployment configures it.
   */
  founderEmailHashes: readonly string[];
}

/** Normalizes a free-text internal field the same way intake answers are normalized. */
function normalizeInternalText(rawValue: unknown, label: string): string | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }
  if (typeof rawValue !== "string") {
    throw new ValidationError(`${label} must be text.`);
  }
  const value = rawValue.trim();
  if (value.length > MAX_INTERNAL_TEXT) {
    throw new ValidationError(
      `Keep ${label.toLowerCase()} under ${MAX_INTERNAL_TEXT} characters.`,
    );
  }
  return value === "" ? null : value;
}

export class FounderWorkspaceService {
  constructor(private readonly options: FounderWorkspaceOptions) {}

  /**
   * Grants the configured `founder` capability when it is due, then checks it.
   *
   * The bootstrap is idempotent and only ever *adds* the capability for an
   * address hash the deployment configured; it never grants anything else, never
   * grants to a customer role, and is never reachable from a request. It runs
   * here rather than once at startup so the capability works for a Founder who
   * signs in after the container was built.
   */
  requireFounder(personId: string): Person {
    if (this.options.founderEmailHashes.length > 0) {
      const person = this.options.store.findPersonById(personId);
      if (person && this.options.founderEmailHashes.includes(person.emailHash)) {
        const existing = this.options.store.findInternalCapability(personId, "founder");
        if (!existing || existing.revokedAt !== null) {
          this.options.store.grantInternalCapability({
            personId,
            capability: "founder",
            grantedAt: this.options.clock.now(),
            revokedAt: null,
          });
        }
      }
    }
    return requireFounderCapability(this.options.store, personId);
  }

  /**
   * Resolves a project reference for the internal workspace.
   *
   * Capability is checked first, then the reference is resolved. The reference is
   * not scoped to an organization here because the Founder is not a member of
   * any — that is the point of the internal capability.
   */
  resolveProjectId(personId: string, reference: string): ProjectId {
    this.requireFounder(personId);
    const project = this.options.store.findProjectByReferenceInternal(reference);
    if (!project) {
      throw new NotFoundError("That project does not exist.");
    }
    return project.id;
  }

  /**
   * Reads everything the Founder reviews for one project.
   *
   * Strictly read-only: no write, no audit event, and no change to the
   * customer-facing stage or to any internal field. Loading the review page
   * must not be able to tell the customer that anything happened.
   */
  review(personId: string, projectId: ProjectId): InternalProjectReview {
    this.requireFounder(personId);
    const project = this.requireProject(projectId);
    const intake = this.options.store.findProjectIntakeByProject(project.id);

    const memberships = this.options.store.listMembershipsByOrganization(
      project.organizationId,
    );
    const customers: InternalCustomerIdentity[] = memberships.map((membership) => {
      const member = this.options.store.findPersonById(membership.personId);
      if (!member) {
        // A membership row whose person is gone would otherwise be rendered as a
        // blank identity; skipping keeps the review list honest.
        return {
          personId: membership.personId,
          email: "",
          displayName: null,
          customerRole: membership.role,
          isProjectCreator: membership.personId === project.createdByPersonId,
        };
      }
      return {
        personId: member.id,
        email: member.email,
        displayName: member.displayName,
        customerRole: membership.role,
        isProjectCreator: member.id === project.createdByPersonId,
      };
    });

    const creator = this.options.store.findPersonById(project.createdByPersonId);
    if (creator && !customers.some((entry) => entry.personId === creator.id)) {
      // The creator can hold no membership row; the Founder still needs to know
      // who they are.
      customers.unshift({
        personId: creator.id,
        email: creator.email,
        displayName: creator.displayName,
        customerRole: null,
        isProjectCreator: true,
      });
    }

    return buildInternalReview({
      project,
      organization: this.requireOrganization(project.organizationId),
      customers,
      intake,
      auditEvents: this.options.store.listAuditEventsForProject(
        project.id,
        AUDIT_HISTORY_LIMIT,
      ),
    });
  }

  /**
   * The explicit Start Review action.
   *
   * This is the only thing that moves the customer-facing stage on to *Project
   * Intake — Review*, and it does so explicitly rather than as a side effect of
   * opening the page. It requires only a submitted intake, records the review
   * start and the customer-stage change, and touches no internal qualification
   * state.
   *
   * Repeating it is a no-op: a second call returns the current state without a
   * second audit pair, so a double-submitted form cannot imply two reviews.
   */
  startReview(input: { personId: string; projectId: ProjectId }): InternalProjectReview {
    this.requireFounder(input.personId);
    const project = this.requireProject(input.projectId);
    const intake = this.options.store.findProjectIntakeByProject(project.id);
    if (!intake) {
      throw new NotFoundError("Project Intake was not found for this project.");
    }
    if (intake.status !== "submitted") {
      throw new ValidationError(
        "Only a submitted Project Intake can be reviewed. Ask the customer to submit it first.",
      );
    }
    if (project.reviewStartedAt !== null) {
      // Already started. Nothing is written, so nothing is recorded twice.
      return this.review(input.personId, project.id);
    }

    const now = this.options.clock.now();
    this.options.store.transaction(() => {
      this.options.store.saveProjectInternal({
        id: project.id,
        patch: { reviewStartedAt: now },
        now,
      });
      this.options.store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: project.organizationId,
        personId: input.personId,
        projectId: project.id,
        type: "project_intake.review_started",
        occurredAt: now,
        metadata: null,
      });
      this.options.store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: project.organizationId,
        personId: input.personId,
        projectId: project.id,
        type: "project.customer_stage_changed",
        occurredAt: now,
        metadata: { from: "intake_information_submitted", to: "intake_review" },
      });
    });

    return this.review(input.personId, project.id);
  }

  /**
   * Records the internal assessment.
   *
   * Stored separately from the Founder decision and deliberately without any
   * effect on the customer-facing stage: the customer sees *Project Intake —
   * Review* because review was started, never because of what the assessment
   * concluded.
   */
  setQualificationState(input: {
    personId: string;
    projectId: ProjectId;
    state: unknown;
  }): InternalProjectReview {
    this.requireFounder(input.personId);
    // Bound to a local so the type guard's narrowing survives into the closure.
    const state = input.state;
    if (!isInternalQualificationState(state)) {
      throw new ValidationError("That qualification state is not recognised.");
    }
    const project = this.requireProject(input.projectId);
    const now = this.options.clock.now();

    this.options.store.transaction(() => {
      this.options.store.saveProjectInternal({
        id: project.id,
        patch: { qualificationState: state },
        now,
      });
      this.options.store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: project.organizationId,
        personId: input.personId,
        projectId: project.id,
        type: "project.qualification_changed",
        occurredAt: now,
        metadata: { from: project.qualificationState, to: state },
      });
    });

    return this.review(input.personId, project.id);
  }

  /**
   * Stores internal notes.
   *
   * The note text is deliberately kept out of the audit event: the event records
   * that notes changed, and the current value lives on the project. An audit
   * trail that accumulated every previous note would copy internal working notes
   * into a second place.
   */
  recordInternalNotes(input: {
    personId: string;
    projectId: ProjectId;
    notes: unknown;
  }): InternalProjectReview {
    this.requireFounder(input.personId);
    const notes = normalizeInternalText(input.notes, "Internal notes");
    const project = this.requireProject(input.projectId);
    const now = this.options.clock.now();
    const eventType: AuditEventType =
      project.internalNotes === null
        ? "project.internal_note_added"
        : "project.internal_note_updated";

    this.options.store.transaction(() => {
      this.options.store.saveProjectInternal({
        id: project.id,
        patch: { internalNotes: notes },
        now,
      });
      this.options.store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: project.organizationId,
        personId: input.personId,
        projectId: project.id,
        type: eventType,
        occurredAt: now,
        metadata: null,
      });
    });

    return this.review(input.personId, project.id);
  }

  /**
   * Records the operational decision taken after review.
   *
   * A closed vocabulary, validated server-side. An unknown or empty value is
   * rejected outright rather than stored, coerced, or treated as "no decision",
   * and nothing here derives the decision from the qualification state.
   */
  recordFounderDecision(input: {
    personId: string;
    projectId: ProjectId;
    decision: unknown;
  }): InternalProjectReview {
    this.requireFounder(input.personId);
    if (!isFounderDecision(input.decision)) {
      throw new ValidationError("That Founder decision is not recognised.");
    }
    const project = this.requireProject(input.projectId);
    const now = this.options.clock.now();
    const decision: FounderDecision = input.decision;
    this.options.store.transaction(() => {
      this.options.store.saveProjectInternal({
        id: project.id,
        patch: { founderDecision: decision },
        now,
      });
      this.options.store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: project.organizationId,
        personId: input.personId,
        projectId: project.id,
        type: "project.founder_decision_recorded",
        occurredAt: now,
        metadata: { decision },
      });
    });

    return this.review(input.personId, project.id);
  }

  /** Records the next internal step. Intentionally a single free-text field. */
  recordInternalNextAction(input: {
    personId: string;
    projectId: ProjectId;
    nextAction: unknown;
  }): InternalProjectReview {
    this.requireFounder(input.personId);
    const nextAction = normalizeInternalText(input.nextAction, "Internal next action");
    const project = this.requireProject(input.projectId);
    const now = this.options.clock.now();

    this.options.store.transaction(() => {
      this.options.store.saveProjectInternal({
        id: project.id,
        patch: { internalNextAction: nextAction },
        now,
      });
      this.options.store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: project.organizationId,
        personId: input.personId,
        projectId: project.id,
        type: "project.internal_next_action_recorded",
        occurredAt: now,
        metadata: null,
      });
    });

    return this.review(input.personId, project.id);
  }

  private requireProject(projectId: ProjectId) {
    const project = this.options.store.findProject(projectId);
    if (!project) {
      throw new NotFoundError("That project does not exist.");
    }
    return project;
  }

  private requireOrganization(organizationId: string) {
    const organization = this.options.store.findOrganization(organizationId);
    if (!organization) {
      throw new NotFoundError("That organization does not exist.");
    }
    return organization;
  }
}
