import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isMissing, requireSessionForPage } from "@/lib/platform/server";
import { PORTAL_DATE_FORMAT, PROPOSAL_DISPLAY_FIELDS } from "@/lib/platform/views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Proposal",
  description: "The current published proposal for your project.",
};

/**
 * Customer proposal view.
 *
 * Read-only. Shows the current published proposal version for a project the
 * customer may access, or one neutral empty state when no published proposal
 * exists. The page renders only the customer-safe projection the service
 * returns — drafts, internal state, and Founder information cannot reach it —
 * and it has no form and no state-changing control, so viewing a proposal
 * mutates nothing and implies no acceptance.
 */
export default async function CustomerProposalPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const { platform, personId } = await requireSessionForPage(
    `/dashboard/projects/${reference}/proposal`,
  );

  let detail;
  let proposal;
  try {
    // Resolve the customer-facing reference exactly once, so an inaccessible or
    // unrelated project is reported as missing rather than disclosed, and reuse
    // the resolved project id for both the detail and the proposal read instead
    // of resolving the same reference again for each surface. Each read still
    // enforces project access on that id.
    const projectId = platform.projects.resolveProjectIdByReference(personId, reference);
    detail = platform.projects.getCustomerProject(personId, projectId);
    proposal = platform.customerProposals.readByProjectId(personId, projectId);
  } catch (error) {
    if (isMissing(error)) {
      notFound();
    }
    throw error;
  }

  const { project } = detail;

  return (
    <section className="portal">
      <div className="container portal__stack">
        <div className="portal__header">
          <div className="portal__stack">
            <p className="eyebrow">
              {project.reference} · {project.stageLabel}
            </p>
            <h1>Proposal</h1>
            <p className="portal__meta">{project.title}</p>
          </div>
          <div className="portal__actions">
            <Link className="button button-secondary" href="/dashboard">
              Back to dashboard
            </Link>
          </div>
        </div>

        {proposal ? (
          <div className="portal__panel portal__stack">
            <div>
              <h2>Version {proposal.versionNumber}</h2>
              <p className="portal__meta">
                Published {PORTAL_DATE_FORMAT.format(new Date(proposal.publishedAt))}
              </p>
            </div>
            {PROPOSAL_DISPLAY_FIELDS.map((field) => (
              <div className="field" key={field.name}>
                <p className="field__label">{field.label}</p>
                <p className="lede">{proposal[field.name]}</p>
              </div>
            ))}
            {proposal.validUntil !== null ? (
              <div className="field">
                <p className="field__label">Valid until</p>
                <p className="lede">
                  {PORTAL_DATE_FORMAT.format(new Date(proposal.validUntil))}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="portal__panel portal__stack">
            <h2>No proposal to view</h2>
            <p className="lede">
              There is no proposal to view for this project at the moment.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
