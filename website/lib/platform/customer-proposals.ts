/**
 * Customer proposal review — read-only.
 *
 * The single customer-facing seam over the Founder-authored proposal model. It
 * exposes exactly one fact: the current published proposal version for a project
 * the customer may access. Drafts, internal ids, audit metadata, and Founder
 * state never cross this boundary.
 *
 * Authorization is the existing customer project model, not the Founder
 * capability: the read resolves the project through the same reference
 * resolution and project-access rules as every other customer read, so a person
 * who holds only the internal capability is rejected like anyone else unless
 * they are genuinely an authorized customer of the project.
 */

import type { ProposalVersionInternal } from "./domain";
import type { PlatformStore } from "./ports";
import type { ProjectService } from "./projects";
import { toCustomerProposal, type CustomerProposalView } from "./views";

export interface CustomerProposalServiceOptions {
  store: PlatformStore;
  projects: ProjectService;
}

/** The current published version: the highest-numbered version that is published. */
export interface CurrentPublishedVersion {
  version: ProposalVersionInternal;
  publishedAt: number;
}

/**
 * Selects the current published version from a proposal's versions.
 *
 * Versions arrive oldest first, so the last published one encountered is the
 * newest: a newer draft never displaces it, and an older published version is
 * never presented as the current one. A version marked published without a
 * publication instant is treated as not published rather than shown with a
 * fabricated date.
 */
export function selectCurrentPublishedVersion(
  versions: readonly ProposalVersionInternal[],
): CurrentPublishedVersion | null {
  let current: CurrentPublishedVersion | null = null;
  for (const version of versions) {
    if (version.status === "published" && version.publishedAt !== null) {
      current = { version, publishedAt: version.publishedAt };
    }
  }
  return current;
}

export class CustomerProposalService {
  constructor(private readonly options: CustomerProposalServiceOptions) {}

  /**
   * Reads the current published proposal for a project the caller may access.
   *
   * Returns null when the project has no published proposal — the same result
   * whether there is no proposal at all or only drafts, so the two are
   * indistinguishable to the customer. Authorizes through the existing customer
   * project reference resolution first, so an inaccessible or unrelated project
   * is reported as missing rather than disclosed.
   */
  readByProjectReference(
    personId: string,
    reference: string,
  ): CustomerProposalView | null {
    const projectId = this.options.projects.resolveProjectIdByReference(
      personId,
      reference,
    );
    const project = this.options.store.findProject(projectId);
    if (!project) {
      return null;
    }
    const proposal = this.options.store.findProposalByProject(project.id);
    if (!proposal) {
      return null;
    }
    const current = selectCurrentPublishedVersion(
      this.options.store.listProposalVersions(proposal.id),
    );
    if (!current) {
      return null;
    }
    return toCustomerProposal(project.reference, current.version, current.publishedAt);
  }
}
