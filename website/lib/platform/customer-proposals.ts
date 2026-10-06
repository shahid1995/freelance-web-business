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

import type { PlatformStore } from "./ports";
import type { ProjectService } from "./projects";
import { toCustomerProposal, type CustomerProposalView } from "./views";

export interface CustomerProposalServiceOptions {
  store: PlatformStore;
  projects: ProjectService;
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
   *
   * The current published version — published status, a recorded publication
   * instant, and the highest version number — is resolved by the store in one
   * query, so the publication invariant lives in one place instead of being
   * re-derived here. A version marked published without an instant is treated as
   * not published rather than shown with a fabricated date.
   */
  readByProjectReference(
    personId: string,
    reference: string,
  ): CustomerProposalView | null {
    const projectId = this.options.projects.resolveProjectIdByReference(
      personId,
      reference,
    );
    const version = this.options.store.findCurrentPublishedProposalVersion(projectId);
    if (!version || version.publishedAt === null) {
      return null;
    }
    // The reference is globally unique and was resolved to exactly one project,
    // so it is that project's own customer-facing reference.
    return toCustomerProposal(reference, version, version.publishedAt);
  }
}
