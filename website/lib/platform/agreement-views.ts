import type {
  AgreementInternal,
  AgreementSignatureInternal,
  AgreementVersionInternal,
  ProjectInternal,
  ProposalVersionInternal,
} from "./domain";

export interface InternalAgreementVersionView {
  versionNumber: number;
  proposalVersionNumber: number;
  status: AgreementVersionInternal["status"];
  additionalTerms: string;
  createdAt: number;
  publishedAt: number | null;
  signedAt: number | null;
  signatureCount: number;
}

export interface InternalAgreementView {
  projectReference: string;
  agreementId: string | null;
  latestVersionNumber: number | null;
  versions: InternalAgreementVersionView[];
}

export function buildInternalAgreementView(input: {
  project: ProjectInternal;
  agreement: AgreementInternal | null;
  versions: AgreementVersionInternal[];
  signaturesByVersion: Map<string, AgreementSignatureInternal[]>;
}): InternalAgreementView {
  return {
    projectReference: input.project.reference,
    agreementId: input.agreement?.id ?? null,
    latestVersionNumber:
      input.versions.length > 0
        ? input.versions[input.versions.length - 1]!.versionNumber
        : null,
    versions: input.versions.map((version) => {
      const signatures = input.signaturesByVersion.get(version.id) ?? [];
      return {
        versionNumber: version.versionNumber,
        proposalVersionNumber: version.proposalVersionNumber,
        status: version.status,
        additionalTerms: version.additionalTerms,
        createdAt: version.createdAt,
        publishedAt: version.publishedAt,
        signedAt: signatures.length > 0 ? signatures[signatures.length - 1]!.createdAt : null,
        signatureCount: signatures.length,
      };
    }),
  };
}

/**
 * Customer view of the signing surface.
 *
 * A completed signed agreement intentionally exposes status and signing metadata
 * only until Q10 is decided. The actual proposal/additional-terms content is
 * projected only while the agreement is awaiting the customer's signature.
 */
export interface CustomerAgreementView {
  state: "not_ready" | "awaiting_signature" | "completed";
  projectReference: string;
  versionNumber: number | null;
  proposalVersionNumber: number | null;
  publishedAt: number | null;
  signedAt: number | null;
  canSign: boolean;
  proposal: {
    summary: string;
    scopeIncluded: string;
    scopeExcluded: string;
    deliverables: string;
    timeline: string;
    assumptions: string;
    commercialTerms: string;
    validUntil: number | null;
  } | null;
  additionalTerms: string | null;
}

export function toCustomerAgreementAwaitingSignature(
  projectReference: string,
  version: AgreementVersionInternal,
  proposal: ProposalVersionInternal,
  canSign: boolean,
): CustomerAgreementView {
  return {
    state: "awaiting_signature",
    projectReference,
    versionNumber: version.versionNumber,
    proposalVersionNumber: version.proposalVersionNumber,
    publishedAt: version.publishedAt,
    signedAt: null,
    canSign,
    proposal: {
      summary: proposal.summary,
      scopeIncluded: proposal.scopeIncluded,
      scopeExcluded: proposal.scopeExcluded,
      deliverables: proposal.deliverables,
      timeline: proposal.timeline,
      assumptions: proposal.assumptions,
      commercialTerms: proposal.commercialTerms,
      validUntil: proposal.validUntil,
    },
    additionalTerms: version.additionalTerms,
  };
}

export function toCustomerAgreementCompleted(
  projectReference: string,
  version: AgreementVersionInternal,
  signedAt: number | null,
): CustomerAgreementView {
  return {
    state: "completed",
    projectReference,
    versionNumber: version.versionNumber,
    proposalVersionNumber: version.proposalVersionNumber,
    publishedAt: version.publishedAt,
    signedAt,
    canSign: false,
    proposal: null,
    additionalTerms: null,
  };
}

export function toCustomerAgreementNotReady(projectReference: string): CustomerAgreementView {
  return {
    state: "not_ready",
    projectReference,
    versionNumber: null,
    proposalVersionNumber: null,
    publishedAt: null,
    signedAt: null,
    canSign: false,
    proposal: null,
    additionalTerms: null,
  };
}
