/**
 * Projects.
 *
 * "Start Your Project" follows the ADR boundary: authorize, create the project
 * immediately, create the initial Project Intake draft, record an audit event,
 * and let the caller redirect into the intake flow. The project is the stable
 * record for the lifecycle; intake and any later material attach to it.
 *
 * Ordinary members cannot create projects in this slice — `createProject`
 * requires an organization owner or admin, checked on the server.
 */

import {
  PROJECT_INTAKE_SCHEMA_VERSION,
  emptyProjectIntakeAnswers,
  type ProjectId,
  type ProjectIntake,
  type ProjectInternal,
} from "./domain";
import type { Clock } from "./clock";
import { NotFoundError } from "./errors";
import {
  requireOrganizationAdministrator,
  requireOrganizationContext,
  requireOrganizationProject,
  requireProjectAccess,
} from "./authorization";
import type { PlatformStore } from "./ports";
import { generateActionKey, generateProjectReference } from "./secrets";
import type { CustomerProjectDetail, CustomerProjectSummary } from "./views";
import { toCustomerProjectDetail, toCustomerProjectSummary } from "./views";

const DEFAULT_PROJECT_TITLE = "New project";

export interface ProjectServiceOptions {
  store: PlatformStore;
  clock: Clock;
  newId: () => string;
}

export interface CreateProjectInput {
  personId: string;
  organizationId: string;
  /** Server-rendered action key. Makes one click produce exactly one project. */
  actionKey?: string | null;
  title?: string | null;
}

export interface CreateProjectResult {
  project: ProjectInternal;
  intake: ProjectIntake;
  /** False when an existing project was returned for a repeated action key. */
  created: boolean;
}

export class ProjectService {
  constructor(private readonly options: ProjectServiceOptions) {}

  /** Creates a project plus its initial Project Intake draft, in one transaction. */
  createProject(input: CreateProjectInput): CreateProjectResult {
    // Authorization first: an unauthorized caller cannot even probe for an
    // existing project.
    requireOrganizationAdministrator(
      this.options.store,
      input.personId,
      input.organizationId,
    );

    return this.options.store.transaction(() => {
      const idempotencyKey = input.actionKey ?? null;
      if (idempotencyKey) {
        const existing = this.findProjectByActionKey(
          input.organizationId,
          idempotencyKey,
        );
        if (existing) {
          const existingIntake =
            this.options.store.findProjectIntakeByProject(existing.id);
          if (existingIntake) {
            // Same click, same project. Never a second project.
            return { project: existing, intake: existingIntake, created: false };
          }
        }
      }

      const now = this.options.clock.now();
      const project: ProjectInternal = {
        id: this.options.newId(),
        organizationId: input.organizationId,
        reference: this.newReference(),
        title: normalizeTitle(input.title),
        createdByPersonId: input.personId,
        createdAt: now,
        updatedAt: now,
        // Set only by the explicit Founder Start Review action. Null means the
        // customer-facing stage stays where intake progress puts it.
        reviewStartedAt: null,
        // Internal state starts unset and is owned by the Founder workspace. It
        // is never returned to a customer.
        qualificationState: "unreviewed",
        internalNotes: null,
        founderDecision: null,
        internalNextAction: null,
      };
      const stored = this.options.store.createProject({
        project,
        idempotencyKey,
      });

      const intake = this.options.store.createProjectIntake({
        id: this.options.newId(),
        projectId: stored.id,
        status: "draft",
        schemaVersion: PROJECT_INTAKE_SCHEMA_VERSION,
        answers: emptyProjectIntakeAnswers(),
        createdAt: now,
        updatedAt: now,
        lastSavedAt: now,
        submittedAt: null,
      });

      this.options.store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: stored.organizationId,
        personId: input.personId,
        projectId: stored.id,
        type: "project.created",
        occurredAt: now,
        metadata: { reference: stored.reference },
      });

      return { project: stored, intake, created: true };
    });
  }

  /** Renders the action key embedded in the dashboard form. */
  newActionKey(): string {
    return generateActionKey();
  }

  /**
   * Projects the actor may see: every project in the organization for an
   * owner/admin, and only explicitly granted projects for an ordinary member.
   */
  listAccessibleProjects(personId: string): CustomerProjectSummary[] {
    const context = requireOrganizationContext(this.options.store, personId);
    const organizationProjects = this.options.store.listProjectsByOrganization(
      context.actor.organization.id,
    );
    const candidates = context.isAdministrator
      ? organizationProjects
      : organizationProjects.filter((project) => {
          const access = this.options.store.findProjectAccess(project.id, personId);
          return access !== null && access.revokedAt === null;
        });
    return candidates.map((project) => this.toCustomerSummary(project));
  }

  /** Reads one project as a customer, after an authorization check. */
  getCustomerProject(personId: string, projectId: ProjectId): CustomerProjectDetail {
    const { project } = requireProjectAccess(this.options.store, personId, projectId);
    return this.toCustomerDetail(project);
  }

  /**
   * Resolves a customer-facing project reference to the internal record id.
   *
   * The reference is what appears in customer URLs, so it stays a non-sensitive
   * identifier rather than an internal record id. The caller's organization is
   * resolved first, so the reference is searched only inside it, and the ordinary
   * access rules are applied before the id is returned — an unrelated or revoked
   * project never resolves.
   */
  resolveProjectIdByReference(personId: string, reference: string): ProjectId {
    const context = requireOrganizationContext(this.options.store, personId);
    const project = this.options.store.findProjectByReference(
      context.actor.organization.id,
      reference,
    );
    if (!project) {
      throw new NotFoundError("That project does not exist.");
    }
    // Authorize before disclosing the internal id.
    requireProjectAccess(this.options.store, personId, project.id);
    return project.id;
  }

  /**
   * Reads one project by its customer-facing reference, after an authorization
   * check.
   */
  getCustomerProjectByReference(
    personId: string,
    reference: string,
  ): CustomerProjectDetail {
    const projectId = this.resolveProjectIdByReference(personId, reference);
    return this.getCustomerProject(personId, projectId);
  }

  /**
   * Grants an ordinary member access to a project. Administrator-only, because
   * access control is an organization administration action.
   */
  grantProjectAccess(input: {
    personId: string;
    organizationId: string;
    projectId: ProjectId;
    memberPersonId: string;
  }): void {
    const context = requireOrganizationAdministrator(
      this.options.store,
      input.personId,
      input.organizationId,
    );
    const project = requireOrganizationProject(
      this.options.store,
      context,
      input.projectId,
    );
    this.options.store.grantProjectAccess({
      projectId: project.id,
      personId: input.memberPersonId,
      grantedAt: this.options.clock.now(),
      revokedAt: null,
    });
    this.options.store.appendAuditEvent({
      id: this.options.newId(),
      organizationId: project.organizationId,
      personId: input.personId,
      projectId: project.id,
      type: "project_access.granted",
      occurredAt: this.options.clock.now(),
      metadata: { memberPersonId: input.memberPersonId },
    });
  }

  /**
   * Revokes an explicit grant. Access stops on the next request because the
   * authorization check reads the current row rather than a cached decision.
   */
  revokeProjectAccess(input: {
    personId: string;
    organizationId: string;
    projectId: ProjectId;
    memberPersonId: string;
  }): void {
    const context = requireOrganizationAdministrator(
      this.options.store,
      input.personId,
      input.organizationId,
    );
    const project = requireOrganizationProject(
      this.options.store,
      context,
      input.projectId,
    );
    const revoked = this.options.store.revokeProjectAccess({
      projectId: project.id,
      personId: input.memberPersonId,
      now: this.options.clock.now(),
    });
    if (!revoked) {
      return;
    }
    this.options.store.appendAuditEvent({
      id: this.options.newId(),
      organizationId: project.organizationId,
      personId: input.personId,
      projectId: project.id,
      type: "project_access.revoked",
      occurredAt: this.options.clock.now(),
      metadata: { memberPersonId: input.memberPersonId },
    });
  }

  private findProjectByActionKey(
    organizationId: string,
    actionKey: string,
  ): ProjectInternal | null {
    return this.options.store.findProjectByIdempotencyKey(organizationId, actionKey);
  }

  /**
   * Customer projections, built from the project's own intake.
   *
   * Every customer-facing read goes through these, so a project can only reach a
   * customer via the shaping in `views.ts` rather than by any caller's own field
   * selection.
   */
  private toCustomerSummary(project: ProjectInternal): CustomerProjectSummary {
    return toCustomerProjectSummary(
      project,
      this.options.store.findProjectIntakeByProject(project.id),
    );
  }

  private toCustomerDetail(project: ProjectInternal): CustomerProjectDetail {
    return toCustomerProjectDetail(
      project,
      this.options.store.findProjectIntakeByProject(project.id),
    );
  }

  private newReference(): string {
    // Collision detection uses the indexed global lookup rather than loading a
    // project list. Uniqueness is platform-wide, so the check cannot be scoped to
    // one organization: a reference already used elsewhere must also be avoided.
    // The database unique index on `reference` remains the actual guarantee, so a
    // lost race surfaces as a constraint violation rather than a duplicate.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reference = generateProjectReference();
      if (!this.options.store.findProjectByReferenceGlobal(reference)) {
        return reference;
      }
    }
    throw new Error("Could not allocate a unique project reference.");
  }
}

function normalizeTitle(rawTitle: string | null | undefined): string {
  const title = (rawTitle ?? "").replace(/\s+/g, " ").trim();
  if (title.length === 0) return DEFAULT_PROJECT_TITLE;
  return title.slice(0, 120);
}