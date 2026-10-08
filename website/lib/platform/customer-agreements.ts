import { requireProjectAccess } from "./authorization";
import { AgreementCompletedError, AgreementUpdatedError, ForbiddenError, ValidationError } from "./errors";
import type { Clock } from "./clock";
import type { ProjectId } from "./domain";
import type { PlatformStore } from "./ports";
import {
  toCustomerAgreementAwaitingSignature,
  toCustomerAgreementCompleted,
  toCustomerAgreementNotReady,
  type CustomerAgreementView,
} from "./agreement-views";

const MAX_ACTION_KEY_LENGTH = 128;

export interface CustomerAgreementServiceOptions {
  store: PlatformStore;
  clock: Clock;
  newId: () => string;
}

export interface SignAgreementInput {
  personId: string;
  projectId: ProjectId;
  versionNumber: unknown;
  actionKey: unknown;
}

export interface SignedAgreementResult {
  versionNumber: number;
  signedAt: number;
}

function parseVersionNumber(raw: unknown): number {
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError("That agreement version is not recognised.");
  }
  return parsed;
}

function parseActionKey(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new ValidationError("This signing submission is missing its action key.");
  }
  const value = raw.trim();
  if (value === "" || value.length > MAX_ACTION_KEY_LENGTH) {
    throw new ValidationError("This signing submission is not valid. Reload and try again.");
  }
  return value;
}

export class CustomerAgreementService {
  constructor(private readonly options: CustomerAgreementServiceOptions) {}

  readByProjectId(personId: string, projectId: ProjectId): CustomerAgreementView {
    const { context, project } = requireProjectAccess(
      this.options.store,
      personId,
      projectId,
    );
    const signable = this.options.store.findCurrentSignableAgreementVersion(project.id);
    if (signable) {
      const proposal = this.options.store.findProposalVersionById(signable.proposalVersionId);
      if (!proposal || proposal.publishedAt === null) {
        return toCustomerAgreementNotReady(project.reference);
      }
      return toCustomerAgreementAwaitingSignature(
        project.reference,
        signable,
        proposal,
        context.isAdministrator,
      );
    }

    const current = this.options.store.findCurrentAgreementVersion(project.id);
    if (current?.status === "signed") {
      const signatures = this.options.store.listAgreementSignaturesByVersion(current.id);
      const signedAt = signatures.length > 0 ? signatures[signatures.length - 1]!.createdAt : null;
      return toCustomerAgreementCompleted(project.reference, current, signedAt);
    }

    return toCustomerAgreementNotReady(project.reference);
  }

  sign(input: SignAgreementInput): SignedAgreementResult {
    const versionNumber = parseVersionNumber(input.versionNumber);
    const actionKey = parseActionKey(input.actionKey);
    const now = this.options.clock.now();

    return this.options.store.transaction((store) => {
      const { context, project } = requireProjectAccess(store, input.personId, input.projectId);
      if (!context.isAdministrator) {
        throw new ForbiddenError("Only an organization owner or admin can sign an agreement.");
      }

      const replayed = store.findAgreementSignatureByKey(actionKey);
      if (replayed) {
        const agreement = store.findAgreementByProject(project.id);
        const replayVersion = agreement
          ? store
              .listAgreementVersions(agreement.id)
              .find((version) => version.versionNumber === versionNumber)
          : null;
        const matches =
          replayed.personId === input.personId &&
          replayed.projectId === project.id &&
          replayed.action === "signed" &&
          replayVersion !== null &&
          replayed.agreementVersionId === replayVersion.id &&
          replayed.proposalId === replayVersion.proposalId &&
          replayed.proposalVersionId === replayVersion.proposalVersionId;
        if (!matches) {
          throw new ValidationError(
            "That signing submission could not be recognised. Reload the agreement and try again.",
          );
        }
        return {
          versionNumber: replayVersion.versionNumber,
          signedAt: replayed.createdAt,
        };
      }

      const current = store.findCurrentSignableAgreementVersion(project.id);
      if (!current || current.status !== "published") {
        const completed = store.findCurrentAgreementVersion(project.id);
        if (completed?.status === "signed") {
          throw new AgreementCompletedError(
            "This agreement is already completed. Reload the project to see its current status.",
          );
        }
        throw new AgreementUpdatedError();
      }

      if (current.versionNumber !== versionNumber) {
        throw new AgreementUpdatedError();
      }

      const acceptedProposal = store.findCurrentAcceptedProposalVersion(project.id);
      if (!acceptedProposal || acceptedProposal.id !== current.proposalVersionId) {
        throw new AgreementUpdatedError();
      }

      const signature = store.createAgreementSignature({
        id: this.options.newId(),
        personId: input.personId,
        organizationId: project.organizationId,
        projectId: project.id,
        agreementId: current.agreementId,
        agreementVersionId: current.id,
        proposalId: current.proposalId,
        proposalVersionId: current.proposalVersionId,
        proposalVersionNumber: current.proposalVersionNumber,
        authorityRole: context.role === "owner" ? "owner" : "admin",
        action: "signed",
        createdAt: now,
        actionKey,
      });

      store.signAgreementVersion({ id: current.id, now });

      store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: project.organizationId,
        personId: input.personId,
        projectId: project.id,
        type: "agreement.signed",
        occurredAt: now,
        metadata: {
          agreementId: current.agreementId,
          versionNumber: current.versionNumber,
          proposalVersionNumber: current.proposalVersionNumber,
          signatureId: signature.id,
        },
      });

      return {
        versionNumber: current.versionNumber,
        signedAt: now,
      };
    });
  }
}
