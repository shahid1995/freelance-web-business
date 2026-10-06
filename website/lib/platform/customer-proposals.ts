/**
 * Customer proposal review — read-only.
 *
 * The single customer-facing seam over the Founder-authored proposal model. It
 * exposes exactly one fact: the current published proposal version for a project
 * the caller has already been authorized to read. Drafts, internal ids, audit
 * metadata, and Founder state never cross this boundary.
 *
 * Authorization is the existing customer project model and happens once, in the
 * project service, before this seam is reached: the caller resolves the
 * customer-facing reference to a project it may access and passes that project
 * id in. This service therefore resolves no reference and performs no
 * authorization of its own, so a single request resolves and authorizes the
 * reference exactly once instead of repeating it for each surface.
 */

import type { ProjectId } from "./domain";
import type { PlatformStore } from "./ports";
import { toCustomerProposal, type CustomerProposalView } from "./views";

export interface CustomerProposalServiceOptions {
  store: PlatformStore;
}

export class CustomerProposalService {
  constructor(private readonly options: CustomerProposalServiceOptions) {}

  /**
   * Reads the current published proposal for a project the caller is already
   * authorized to access.
   *
   * The caller must have resolved and authorized the project through the
   * customer project service first; this method trusts that project id rather
   * than resolving the reference or repeating the access check, so the
   * customer-facing reference is not resolved and authorized twice in one
   * request. Returns null when the project has no published proposal — the same
   * result whether there is no proposal at all or only drafts, so the two are
   * indistinguishable to the customer.
   *
   * The current published version — published status, a recorded publication
   * instant, and the highest version number — is resolved by the store in one
   * query, so the publication invariant lives in one place instead of being
   * re-derived here. A version marked published without an instant is treated as
   * not published rather than shown with a fabricated date.
   */
  readByProjectId(projectId: ProjectId): CustomerProposalView | null {
    const project = this.options.store.findProject(projectId);
    if (!project) {
      return null;
    }
    const version = this.options.store.findCurrentPublishedProposalVersion(project.id);
    if (!version || version.publishedAt === null) {
      return null;
    }
    return toCustomerProposal(project.reference, version, version.publishedAt);
  }
}
