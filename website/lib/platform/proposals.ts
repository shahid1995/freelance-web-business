/**
 * Proposal foundation.
 *
 * The smallest durable commercial proposal model: a proposal belongs to exactly
 * one project and carries immutable, numbered versions.
 *
 * Three rules do the work here.
 *
 * 1. **Versions are append-only.** A version's content is written once and never
 *    edited. Changing what a proposal says means creating the next version, so
 *    "what did the Founder commit to, and when" stays answerable. There is no
 *    delete path at all.
 * 2. **Publishing is a separate, explicit act.** Draft is the default. Only
 *    `publishProposalVersion` makes a version available, and it is Founder-only
 *    and audited. Publishing does not mean the customer has seen or accepted
 *    anything — that step is a separate, later decision.
 * 3. **Nothing here is customer-facing.** No customer projection, route, or
 *    endpoint reads a proposal, and creating or publishing one does not move the
 *    customer-facing project stage.
 *
 * Authorization reuses the Founder capability from the Founder Workspace rather
 * than introducing a second permission concept.
 */

import {
  type AuditEventType,
  type PersonId,
  type ProjectId,
  type ProjectInternal,
  type ProposalContent,
  type ProposalId,
  type ProposalVersionInternal,
} from "./domain";
import type { Clock } from "./clock";
import { requireFounderWithBootstrap } from "./authorization";
import { NotFoundError, ValidationError } from "./errors";
import type { PlatformStore } from "./ports";
import type { InternalProposalView } from "./internal-views";
import { buildInternalProposalView } from "./internal-views";

const MAX_CONTENT_LENGTH = 20000;

/** Content fields the Founder must supply for every version. */
const REQUIRED_CONTENT_FIELDS = [
  "summary",
  "scopeIncluded",
  "scopeExcluded",
  "deliverables",
  "timeline",
  "assumptions",
  "commercialTerms",
] as const satisfies readonly (keyof ProposalContent)[];

export interface ProposalServiceOptions {
  store: PlatformStore;
  clock: Clock;
  newId: () => string;
  founderEmailHashes: readonly string[];
}

/** Normalizes one content field, rejecting anything that is not text. */
function normalizeContentField(rawValue: unknown, field: string): string {
  if (rawValue === null || rawValue === undefined) {
    throw new ValidationError(`${field} is required for a proposal version.`);
  }
  if (typeof rawValue !== "string") {
    throw new ValidationError(`${field} must be text.`);
  }
  const value = rawValue.trim();
  if (value === "") {
    throw new ValidationError(`${field} is required for a proposal version.`);
  }
  if (value.length > MAX_CONTENT_LENGTH) {
    throw new ValidationError(`Keep ${field} under ${MAX_CONTENT_LENGTH} characters.`);
  }
  return value;
}

/** Normalizes the optional validity date. Accepts a timestamp or nothing. */
function normalizeValidUntil(rawValue: unknown): number | null {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return null;
  }
  const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw new ValidationError("Validity must be a date the Founder has chosen.");
  }
  return parsed;
}

/**
 * Validates raw form content into a proposal version's commercial baseline.
 *
 * Exported so the request boundary and the service agree on exactly what a
 * version may contain.
 */
export function parseProposalContent(
  raw: Record<string, unknown>,
): ProposalContent {
  const content: ProposalContent = {
    summary: "",
    scopeIncluded: "",
    scopeExcluded: "",
    deliverables: "",
    timeline: "",
    assumptions: "",
    commercialTerms: "",
    validUntil: null,
  };
  for (const field of REQUIRED_CONTENT_FIELDS) {
    content[field] = normalizeContentField(raw[field], field);
  }
  content.validUntil = normalizeValidUntil(raw.validUntil);
  return content;
}

export class ProposalService {
  constructor(private readonly options: ProposalServiceOptions) {}

  /**
   * Reads the proposal for a project.
   *
   * Founder-only, like everything else here. A project without a proposal is not
   * an error: it reads as an empty view so the Founder can open the first
   * version.
   */
  read(personId: string, projectId: ProjectId): InternalProposalView {
    const project = this.requireFounderProject(personId, projectId);
    const proposal = this.options.store.findProposalByProject(project.id);
    return buildInternalProposalView({
      projectReference: project.reference,
      proposal,
      versions: proposal
        ? this.options.store.listProposalVersions(proposal.id)
        : [],
    });
  }

  /**
   * Opens the proposal for a project and writes its first version.
   *
   * One proposal per project, enforced by the database rather than by a
   * read-then-write here. Creating a second proposal is a caller error, not a
   * silent second record.
   *
   * This is not derived from the Founder decision or qualification state: a
   * proposal is authored, and authoring it is the Founder's call.
   */
  createProposal(input: {
    personId: string;
    projectId: ProjectId;
    content: Record<string, unknown>;
  }): InternalProposalView {
    const project = this.requireFounderProject(input.personId, input.projectId);
    if (this.options.store.findProposalByProject(project.id)) {
      throw new ValidationError(
        "This project already has a proposal. Create the next version instead.",
      );
    }
    const content = parseProposalContent(input.content);
    const now = this.options.clock.now();

    this.options.store.transaction(() => {
      const proposal = this.options.store.createProposal({
        id: this.options.newId(),
        projectId: project.id,
        createdByPersonId: input.personId,
        createdAt: now,
        updatedAt: now,
      });
      this.recordEvent({
        type: "proposal.created",
        personId: input.personId,
        project,
        occurredAt: now,
        metadata: { proposalId: proposal.id },
      });
      this.writeVersion({
        personId: input.personId,
        project,
        proposalId: proposal.id,
        versionNumber: 1,
        content,
        now,
        createdByPersonId: input.personId,
      });
      return proposal.id;
    });

    return this.read(input.personId, project.id);
  }

  /**
   * Adds the next version.
   *
   * The number is the proposal's own highest version plus one, so it is
   * deterministic from the proposal's history rather than guessed. The unique
   * constraint on (proposal_id, version_number) is the guarantee; a lost race
   * surfaces as a violation rather than a duplicate number.
   */
  createVersion(input: {
    personId: string;
    projectId: ProjectId;
    content: Record<string, unknown>;
  }): InternalProposalView {
    const project = this.requireFounderProject(input.personId, input.projectId);
    const proposal = this.requireProposal(project.id);
    const content = parseProposalContent(input.content);
    const now = this.options.clock.now();

    this.options.store.transaction(() => {
      const next = this.nextVersionNumber(proposal.id) ?? 1;
      this.writeVersion({
        personId: input.personId,
        project,
        proposalId: proposal.id,
        versionNumber: next,
        content,
        now,
        createdByPersonId: input.personId,
      });
    });

    return this.read(input.personId, project.id);
  }

  /**
   * Makes a version available to the future customer-facing workflow.
   *
   * Founder-only, audited, and idempotent. Publishing is not acceptance: the
   * customer has still done nothing, and the customer-facing project stage does
   * not move.
   */
  publishVersion(input: {
    personId: string;
    projectId: ProjectId;
    versionNumber: unknown;
  }): InternalProposalView {
    const project = this.requireFounderProject(input.personId, input.projectId);
    const proposal = this.requireProposal(project.id);
    const versionNumber = Number(input.versionNumber);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      throw new ValidationError("That proposal version is not recognised.");
    }
    const version = this.options.store
      .listProposalVersions(proposal.id)
      .find(
        (candidate) => candidate.versionNumber === versionNumber,
      );

    if (!version) {
      throw new NotFoundError("That proposal version does not exist.");
    }

    const now = this.options.clock.now();
    if (version.publishedAt === null) {
      this.options.store.transaction(() => {
        this.options.store.publishProposalVersion({ id: version.id, now });
        this.recordEvent({
          type: "proposal_version.published",
          personId: input.personId,
          project,
          occurredAt: now,
          metadata: { proposalId: proposal.id, versionNumber },
        });
      });
    }

    return this.read(input.personId, project.id);
  }

  /** Writes one immutable version and records that it exists. */
  private writeVersion(input: {
    personId: string;
    project: ProjectInternal;
    proposalId: PersonId;
    versionNumber: number;
    content: ProposalContent;
    now: number;
    createdByPersonId: PersonId;
  }): ProposalVersionInternal {
    const created = this.options.store.createProposalVersion({
      id: this.options.newId(),
      proposalId: input.proposalId,
      versionNumber: input.versionNumber,
      status: "draft",
      ...input.content,
      createdByPersonId: input.createdByPersonId,
      createdAt: input.now,
      publishedAt: null,
    });
    this.recordEvent({
      type: "proposal_version.created",
      personId: input.personId,
      project: input.project,
      occurredAt: input.now,
      // Identifies which version exists. Never the content itself: the version
      // record is the content's home, and copying it into the audit trail would
      // duplicate the commercial document into a second, unbounded place.
      metadata: { proposalId: input.proposalId, versionNumber: created.versionNumber },
    });
    return created;
  }

  /**
   * The next version number, or null when the proposal has no versions yet.
   *
   * Split out so the numbering rule is one expression rather than being
   * restated at each call site.
   */
  private nextVersionNumber(proposalId: ProposalId): number | null {
    const versions = this.options.store.listProposalVersions(proposalId);
    if (versions.length === 0) return null;
    return versions[versions.length - 1]!.versionNumber + 1;
  }

  private requireFounderProject(personId: string, projectId: ProjectId): ProjectInternal {
    requireFounderWithBootstrap(
      this.options.store,
      this.options.clock,
      this.options.founderEmailHashes,
      personId,
    );
    const project = this.options.store.findProject(projectId);
    if (!project) {
      throw new NotFoundError("That project does not exist.");
    }
    return project;
  }

  private requireProposal(projectId: ProjectId) {
    const proposal = this.options.store.findProposalByProject(projectId);
    if (!proposal) {
      throw new NotFoundError("This project does not have a proposal yet.");
    }
    return proposal;
  }

  /**
   * Records a proposal audit event.
   *
   * Metadata identifies the actor, project, proposal, and version. It never
   * carries proposal content, and it carries no internal decision or
   * qualification value, so the audit trail cannot become a second copy of the
   * commercial document or a leak of internal state.
   */
  private recordEvent(input: {
    type: AuditEventType;
    personId: string;
    project: ProjectInternal;
    occurredAt: number;
    metadata: Record<string, unknown>;
  }): void {
    this.options.store.appendAuditEvent({
      id: this.options.newId(),
      organizationId: input.project.organizationId,
      personId: input.personId,
      projectId: input.project.id,
      type: input.type,
      occurredAt: input.occurredAt,
      metadata: input.metadata,
    });
  }
}
