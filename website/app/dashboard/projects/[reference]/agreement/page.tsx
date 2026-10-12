import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PortalNotice } from "@/components/portal-notice";
import { noticeFor } from "@/lib/platform/notices";
import { generateActionKey } from "@/lib/platform/secrets";
import { isMissing, requireSessionForPage } from "@/lib/platform/server";
import { PORTAL_DATE_FORMAT } from "@/lib/platform/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Agreement",
  description: "Review the current agreement and sign it when authorised.",
};

export default async function CustomerAgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reference } = await params;
  const returnTo = `/dashboard/projects/${reference}/agreement`;
  const { platform, personId } = await requireSessionForPage(returnTo);

  let agreement;
  try {
    const projectId = platform.projects.resolveProjectIdByReference(personId, reference);
    agreement = platform.customerAgreements.readByProjectId(personId, projectId);
  } catch (error) {
    if (isMissing(error)) notFound();
    throw error;
  }

  const notice = noticeFor(await searchParams);

  return (
    <section className="portal">
      <div className="container portal__stack">
        <div className="portal__header">
          <div className="portal__stack">
            <p className="eyebrow">{agreement.projectReference}</p>
            <h1>Agreement</h1>
          </div>
          <div className="portal__actions">
            <Link className="button button-secondary" href="/dashboard">Back to dashboard</Link>
          </div>
        </div>
        <PortalNotice notice={notice} />

        {agreement.state === "awaiting_signature" ? (
          <>
            <div className="portal__panel portal__stack">
              <h2>Agreement version {agreement.versionNumber}</h2>
              <p className="portal__meta">
                Based on accepted proposal version {agreement.proposalVersionNumber}. Published{" "}
                {agreement.publishedAt === null ? "without a recorded date" : PORTAL_DATE_FORMAT.format(new Date(agreement.publishedAt))}
              </p>
              {agreement.proposal ? (
                <>
                  <div className="field"><p className="field__label">Proposal summary</p><p className="lede">{agreement.proposal.summary}</p></div>
                  <div className="field"><p className="field__label">In scope</p><p className="lede">{agreement.proposal.scopeIncluded}</p></div>
                  <div className="field"><p className="field__label">Out of scope</p><p className="lede">{agreement.proposal.scopeExcluded}</p></div>
                  <div className="field"><p className="field__label">Deliverables</p><p className="lede">{agreement.proposal.deliverables}</p></div>
                  <div className="field"><p className="field__label">Timeline</p><p className="lede">{agreement.proposal.timeline}</p></div>
                  <div className="field"><p className="field__label">Assumptions</p><p className="lede">{agreement.proposal.assumptions}</p></div>
                  <div className="field"><p className="field__label">Commercial terms</p><p className="lede">{agreement.proposal.commercialTerms}</p></div>
                  {agreement.proposal.validUntil !== null ? <div className="field"><p className="field__label">Proposal valid until</p><p className="lede">{PORTAL_DATE_FORMAT.format(new Date(agreement.proposal.validUntil))}</p></div> : null}
                </>
              ) : null}
              {agreement.additionalTerms ? (
                <div className="field">
                  <p className="field__label">Additional contractual terms</p>
                  <p className="lede">{agreement.additionalTerms}</p>
                </div>
              ) : null}
            </div>

            {agreement.canSign ? (
              <div className="portal__panel portal__stack">
                <h2>Sign this agreement</h2>
                <p className="lede">
                  By continuing, your organisation's authorised signer records a signature
                  against this exact agreement version. Signing does not process payment
                  or activate the project.
                </p>
                <form className="form-stack" method="post" action={`/api/projects/${encodeURIComponent(reference)}/agreement/sign`}>
                  <input type="hidden" name="versionNumber" value={agreement.versionNumber ?? ""} />
                  <input type="hidden" name="actionKey" value={generateActionKey()} />
                  <button className="button" type="submit">Sign agreement version {agreement.versionNumber}</button>
                </form>
              </div>
            ) : (
              <div className="portal__panel portal__stack">
                <h2>Authorised signer required</h2>
                <p className="lede">
                  Only your organisation's owner or admin can sign this agreement version.
                </p>
              </div>
            )}
          </>
        ) : agreement.state === "completed" ? (
          <div className="portal__panel portal__stack">
            <h2>Agreement completed</h2>
            <p className="lede">
              Agreement version {agreement.versionNumber} was signed
              {agreement.signedAt === null ? "." : ` on ${PORTAL_DATE_FORMAT.format(new Date(agreement.signedAt))}.`}
            </p>
            <p className="portal__meta">
              The signed agreement content is not made downloadable or viewable through
              this slice; customer document access remains a separate decision.
            </p>
          </div>
        ) : (
          <div className="portal__panel portal__stack">
            <h2>No agreement ready for signature</h2>
            <p className="lede">
              The project does not currently have an agreement version ready for your
              organisation to sign.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
