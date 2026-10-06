/**
 * Customer proposal review — read-only.
 *
 * The single customer-facing seam over the Founder-authored proposal model. It
 * exposes exactly one fact: the current published proposal version for a project
 * the customer may access. Drafts, internal ids, audit metadata, and Founder
 * state never cross this boundary.
 *
 * Authorization is the existing customer project model. The caller resolves the
 * customer-facing reference to a project once and passes that project id in, so
 * the reference is not resolved and authorized again for each surface; this
 * service then enforces access on that id itself, through the same
 * `requireProjectAccess` helper every other customer read uses. Authorization is
 * therefore never delegated to the caller: an id the actor was not granted is
 * rejected here even if a caller passed one in.
 */

import { requireProjectAccess } from "./authorization";
import type { ProjectId } from "./domain";
import type { PlatformStore } from "./ports";
import { toCustomerProposal, type CustomerProposalView } from "./views";

export interface CustomerProposalServiceOptions {
  store: PlatformStore;
}

export class CustomerProposalService {
  constructor(private readonly options: CustomerProposalServiceOptions) {}

  /**
   * Reads the current published proposal for a project the caller may access.
   *
   * The caller passes the project id it already resolved and authorized from the
   * customer-facing reference, so that reference is not resolved a second time.
   * Authorization still runs here as well, against the current access rows, so a
   * caller cannot reach another project's proposal by supplying an id it was
   * never granted.
   *
   * Returns null when the project has no published proposal — the same result
   * whether there is no proposal at all or only drafts, so the two are
   * indistinguishable to the customer.
   *
   * The current published version — published status, a recorded publication
   * instant, and the highest version number — is resolved by the store in one
   * query, so the publication invariant lives in one place instead of being
   * re-derived here. A version marked published without an instant is treated as
   * not published rather than shown with a fabricated date.
   */
  readByProjectId(
    personId: string,
    projectId: ProjectId,
  ): CustomerProposalView | null {
    const { project } = requireProjectAccess(this.options.store, personId, projectId);
    const version = this.options.store.findCurrentPublishedProposalVersion(project.id);
    if (!version || version.publishedAt === null) {
      return null;
    }
    return toCustomerProposal(project.reference, version, version.publishedAt);
  }
}
