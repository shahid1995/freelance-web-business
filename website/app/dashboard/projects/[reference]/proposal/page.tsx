import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PortalNotice } from "@/components/portal-notice";
import { noticeFor } from "@/lib/platform/notices";
import { generateActionKey } from "@/lib/platform/secrets";
import { isMissing, requireSessionForPage } from "@/lib/platform/server";
import {
  PORTAL_DATE_FORMAT,
  PROPOSAL_DISPLAY_FIELDS,
  PROPOSAL_RESPONSE_STATE_LABELS,
} from "@/lib/platform/views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Proposal",
  description: "The current published proposal for your project.",
};

/**
 * Customer proposal view and response.
 *
 * Reading stays exactly as it was: the page renders only the customer-safe
 * projection the service returns — drafts, internal state, and Founder
 * information cannot reach it — and viewing writes nothing and creates no audit
 * event.
 *
 * On top of that read, an authorized customer may take exactly two explicit
 * actions on the current published version: Request Changes, and Accept
 * Proposal (an organization Owner/Admin, and only while the version is still
 * open). The standing shown is derived from the immutable response history —
 * never a stored status — the confirmation is a query-parameter panel rendered
 * by this server component (no client script), and the copy makes no legal
 * claim: accepting is application-level evidence recorded against one named
 * version, not a signature.
 */
export default async function CustomerProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reference } = await params;
  const returnTo = `/dashboard/projects/${reference}/proposal`;
  const { platform, personId } = await requireSessionForPage(returnTo);

  let detail;
  let proposal;
  let standing;
  let agreement;
  try {
    // Resolve the customer-facing reference exactly once, so an inaccessible or
    // unrelated project is reported as missing rather than disclosed, and reuse
    // the resolved project id for every read instead of resolving the same
    // reference again for each surface. Each read still enforces project access
    // on that id, including the response-standing read.
    const projectId = platform.projects.resolveProjectIdByReference(personId, reference);
    detail = platform.projects.getCustomerProject(personId, projectId);
    proposal = platform.customerProposals.readByProjectId(personId, projectId);
    standing = platform.customerProposalResponses.readStandingByProjectId(
      personId,
      projectId,
    );
    agreement = platform.customerAgreements.readByProjectId(personId, projectId);
  } catch (error) {
    if (isMissing(error)) {
      notFound();
    }
    throw error;
  }

  const { project } = detail;
  const query = await searchParams;
  const notice = noticeFor(query);
  const rawConfirm = query.confirm;
  const confirmAccept = (Array.isArray(rawConfirm) ? rawConfirm[0] : rawConfirm) === "accept";

  const action = `/api/projects/${encodeURIComponent(reference)}/proposal-response`;
  const isTerminal = standing !== null && standing.state === "accepted";

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
            {agreement.state !== "not_ready" ? (
              <Link className="button button-secondary" href={`/dashboard/projects/${encodeURIComponent(reference)}/agreement`}>
                Agreement
              </Link>
            ) : null}
            <Link className="button button-secondary" href="/dashboard">
              Back to dashboard
            </Link>
          </div>
        </div>

        <PortalNotice notice={notice} />

        {proposal ? (
          <>
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

            {standing !== null && standing.state !== "open" ? (
              <div className="portal__panel portal__stack">
                <h2>{PROPOSAL_RESPONSE_STATE_LABELS[standing.state]}</h2>
                {standing.state === "accepted" ? (
                  <p className="lede">
                    Version {standing.versionNumber} of this proposal has been
                    accepted. This is final for that version: no further response can
                    be recorded against it.
                  </p>
                ) : (
                  <p className="lede">
                    Changes have been requested against version {standing.versionNumber}{" "}
                    of this proposal. Requesting changes does not change the proposal
                    itself — the next version is written by the Founder, and you can
                    review and respond to it when it is published.
                  </p>
                )}
              </div>
            ) : null}

            {standing !== null && standing.canAccept ? (
              confirmAccept ? (
                <div className="portal__panel portal__stack">
                  <h2>Confirm: accept version {proposal.versionNumber}</h2>
                  <div className="field">
                    <p className="field__label">Project</p>
                    <p className="lede">
                      {project.reference} · {project.title}
                    </p>
                  </div>
                  <div className="field">
                    <p className="field__label">Proposal version</p>
                    <p className="lede">
                      Version {proposal.versionNumber}, published{" "}
                      {PORTAL_DATE_FORMAT.format(new Date(proposal.publishedAt))}
                    </p>
                  </div>
                  <p className="lede">
                    You are accepting proposal version {proposal.versionNumber} for
                    this project, as published on that date. Accepting applies to this
                    specific version only.
                  </p>
                  <p className="portal__meta">
                    Within this version your response is final: a change of mind
                    requires the next proposal version to be published, which you can
                    then review and respond to. Accepting records your
                    organization&apos;s decision on this version — it does not create
                    an agreement, a payment, or a project activation.
                  </p>
                  <form className="form-stack" method="post" action={action}>
                    <input type="hidden" name="intent" value="accept" />
                    <input
                      type="hidden"
                      name="versionNumber"
                      value={proposal.versionNumber}
                    />
                    <input type="hidden" name="actionKey" value={generateActionKey()} />
                    <div className="portal__actions">
                      <button
                        className="button"
                        type="submit"
                      >{`Accept proposal version ${proposal.versionNumber}`}</button>
                      <Link className="button button-secondary" href={returnTo}>
                        Cancel
                      </Link>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="portal__panel portal__stack">
                  <h2>Accept this proposal</h2>
                  <p className="lede">
                    Accepting records your organization&apos;s decision to accept the
                    proposal version shown on this page. You will be asked to confirm
                    the exact version first.
                  </p>
                  <div className="portal__actions">
                    <Link
                      className="button"
                      href={`${returnTo}?confirm=accept`}
                    >{`Accept proposal version ${proposal.versionNumber}`}</Link>
                  </div>
                </div>
              )
            ) : null}

            {!isTerminal ? (
              <div className="portal__panel portal__stack">
                <h2>Request changes</h2>
                <p className="lede">
                  Tell us what you would like changed in version {proposal.versionNumber}{" "}
                  of this proposal. Your request is recorded against this version.
                </p>
                <form className="form-stack" method="post" action={action}>
                  <input type="hidden" name="intent" value="request-changes" />
                  <input
                    type="hidden"
                    name="versionNumber"
                    value={proposal.versionNumber}
                  />
                  <input type="hidden" name="actionKey" value={generateActionKey()} />
                  <div className="field">
                    <label className="field__label" htmlFor="response-message">
                      What would you like changed in version {proposal.versionNumber}?
                    </label>
                    <textarea
                      className="textarea"
                      id="response-message"
                      name="message"
                      required
                      maxLength={5000}
                    />
                    <p className="portal__meta">
                      Requesting changes does not change the proposal, and it does not
                      accept or reject it. Up to 5,000 characters.
                    </p>
                  </div>
                  <div className="portal__actions">
                    <button className="button" type="submit">
                      Request changes
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </>
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
