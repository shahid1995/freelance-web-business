import { requireFounderWithBootstrap } from "./authorization";
import type { Clock } from "./clock";
import {
  NotFoundError,
  ValidationError,
} from "./errors";
import type {
  AgreementVersionInternal,
  AuditEventType,
  ProjectId,
  ProjectInternal,
} from "./domain";
import type { PlatformStore } from "./ports";
import {
  buildInternalAgreementView,
  type InternalAgreementView,
} from "./agreement-views";

const MAX_ADDITIONAL_TERMS_LENGTH = 20000;

function normalizeAdditionalTerms(rawValue: unknown): string {
  if (rawValue === null || rawValue === undefined) {
    return "";
  }
  if (typeof rawValue !== "string") {
    throw new ValidationError("Additional agreement terms must be text.");
  }
  const value = rawValue.trim();
  if (value.length > MAX_ADDITIONAL_TERMS_LENGTH) {
    throw new ValidationError(
      `Keep additional agreement terms under ${MAX_ADDITIONAL_TERMS_LENGTH} characters.`,
    );
  }
  return value;
}

function parseVersionNumber(rawValue: unknown): number {
  const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError("That agreement version is not recognised.");
  }
  return parsed;
}

export interface AgreementServiceOptions {
  store: PlatformStore;
  clock: Clock;
  newId: () => string;
  founderEmailHashes: readonly string[];
}

export class AgreementService {
  constructor(private readonly options: AgreementServiceOptions) {}

  read(personId: string, projectId: ProjectId): InternalAgreementView {
    const project = this.requireFounderProject(personId, projectId);
    const agreement = this.options.store.findAgreementByProject(project.id);
    const versions = agreement
      ? this.options.store.listAgreementVersions(agreement.id)
      : [];
    const signaturesByVersion = new Map(
      versions.map((version) => [
        version.id,
        this.options.store.listAgreementSignaturesByVersion(version.id),
      ]),
    );
    return buildInternalAgreementView({
      project,
      agreement,
      versions,
      signaturesByVersion,
    });
  }

  createAgreement(input: {
    personId: string;
    projectId: ProjectId;
    additionalTerms?: unknown;
  }): InternalAgreementView {
    const project = this.requireFounderProject(input.personId, input.projectId);
    const additionalTerms = normalizeAdditionalTerms(input.additionalTerms);
    const now = this.options.clock.now();

    this.options.store.transaction((store) => {
      if (store.findAgreementByProject(project.id)) {
        throw new ValidationError(
          "This project already has an agreement. Create the next version instead.",
        );
      }
      const proposal = store.findCurrentAcceptedProposalVersion(project.id);
      if (!proposal) {
        throw new ValidationError(
          "An accepted proposal is required before an agreement can be created.",
        );
      }
      const agreement = store.createAgreement({
        id: this.options.newId(),
        projectId: project.id,
        createdByPersonId: input.personId,
        createdAt: now,
      });
      this.recordEvent(store, {
        type: "agreement.created",
        personId: input.personId,
        project,
        occurredAt: now,
        metadata: { agreementId: agreement.id },
      });
      this.writeVersion({
        store,
        personId: input.personId,
        project,
        agreementId: agreement.id,
        versionNumber: 1,
        proposalId: proposal.proposalId,
        proposalVersionId: proposal.id,
        proposalVersionNumber: proposal.versionNumber,
        additionalTerms,
        now,
      });
    });

    return this.read(input.personId, project.id);
  }

  createVersion(input: {
    personId: string;
    projectId: ProjectId;
    additionalTerms?: unknown;
  }): InternalAgreementView {
    const project = this.requireFounderProject(input.personId, input.projectId);
    const agreement = this.requireAgreement(project.id);
    const additionalTerms = normalizeAdditionalTerms(input.additionalTerms);
    const now = this.options.clock.now();

    this.options.store.transaction((store) => {
      const proposal = store.findCurrentAcceptedProposalVersion(project.id);
      if (!proposal) {
        throw new ValidationError(
          "An accepted proposal is required before an agreement version can be created.",
        );
      }
      const versions = store.listAgreementVersions(agreement.id);
      const next = versions.length > 0 ? versions[versions.length - 1]!.versionNumber + 1 : 1;
      this.writeVersion({
        store,
        personId: input.personId,
        project,
        agreementId: agreement.id,
        versionNumber: next,
        proposalId: proposal.proposalId,
        proposalVersionId: proposal.id,
        proposalVersionNumber: proposal.versionNumber,
        additionalTerms,
        now,
      });
    });

    return this.read(input.personId, project.id);
  }

  publishVersion(input: {
    personId: string;
    projectId: ProjectId;
    versionNumber: unknown;
  }): InternalAgreementView {
    const project = this.requireFounderProject(input.personId, input.projectId);
    const agreement = this.requireAgreement(project.id);
    const versionNumber = parseVersionNumber(input.versionNumber);
    const now = this.options.clock.now();

    this.options.store.transaction((store) => {
      const version = store
        .listAgreementVersions(agreement.id)
        .find((candidate) => candidate.versionNumber === versionNumber);
      if (!version) {
        throw new NotFoundError("That agreement version does not exist.");
      }
      if (version.status === "signed") {
        return;
      }
      if (version.status === "published") {
        return;
      }

      const proposal = store.findCurrentAcceptedProposalVersion(project.id);
      if (!proposal || proposal.id !== version.proposalVersionId) {
        throw new ValidationError(
          "This agreement version is based on an older accepted proposal. Create a new agreement version before publishing.",
        );
      }

      store.publishAgreementVersion({ id: version.id, now });
      this.recordEvent(store, {
        type: "agreement_version.published",
        personId: input.personId,
        project,
        occurredAt: now,
        metadata: {
          agreementId: agreement.id,
          versionNumber: version.versionNumber,
          proposalVersionNumber: version.proposalVersionNumber,
        },
      });
    });

    return this.read(input.personId, project.id);
  }

  private writeVersion(input: {
    store: PlatformStore;
    personId: string;
    project: ProjectInternal;
    agreementId: string;
    versionNumber: number;
    proposalId: string;
    proposalVersionId: string;
    proposalVersionNumber: number;
    additionalTerms: string;
    now: number;
  }): AgreementVersionInternal {
    const version = input.store.createAgreementVersion({
      id: this.options.newId(),
      agreementId: input.agreementId,
      proposalId: input.proposalId,
      proposalVersionId: input.proposalVersionId,
      proposalVersionNumber: input.proposalVersionNumber,
      versionNumber: input.versionNumber,
      status: "draft",
      additionalTerms: input.additionalTerms,
      createdByPersonId: input.personId,
      createdAt: input.now,
      publishedAt: null,
    });
    this.recordEvent(input.store, {
      type: "agreement_version.created",
      personId: input.personId,
      project: input.project,
      occurredAt: input.now,
      metadata: {
        agreementId: input.agreementId,
        versionNumber: version.versionNumber,
        proposalVersionNumber: version.proposalVersionNumber,
      },
    });
    return version;
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

  private requireAgreement(projectId: ProjectId) {
    const agreement = this.options.store.findAgreementByProject(projectId);
    if (!agreement) {
      throw new NotFoundError("This project does not have an agreement yet.");
    }
    return agreement;
  }

  private recordEvent(store: PlatformStore, input: {
    type: AuditEventType;
    personId: string;
    project: ProjectInternal;
    occurredAt: number;
    metadata: Record<string, unknown>;
  }): void {
    store.appendAuditEvent({
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
