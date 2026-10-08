import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { internalNoticeFor } from "@/lib/platform/internal-notices";
import { isMissing, requireSessionForPage } from "@/lib/platform/server";
import { PORTAL_DATE_FORMAT } from "@/lib/platform/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Agreement",
  robots: { index: false, follow: false },
};

export default async function InternalAgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reference } = await params;
  const { platform, personId } = await requireSessionForPage(
    `/internal/projects/${reference}/agreement`,
  );

  let agreement;
  try {
    const projectId = platform.internal.resolveProjectId(personId, reference);
    agreement = platform.agreements.read(personId, projectId);
  } catch (error) {
    if (isMissing(error)) notFound();
    throw error;
  }

  const notice = internalNoticeFor(await searchParams);
  const action = `/api/internal/projects/${encodeURIComponent(reference)}/agreement`;
  const hasAgreement = agreement.agreementId !== null;
  const latest = agreement.versions[agreement.versions.length - 1];
  return (
    <section className="portal">
      <div className="container portal__stack">
        <div className="portal__header">
          <div className="portal__stack">
            <p className="eyebrow">{agreement.projectReference}</p>
            <h1>Agreement</h1>
            <p className="portal__meta">
              <Link href={`/internal/projects/${encodeURIComponent(reference)}/proposal`}>
                Back to proposal
              </Link>
            </p>
          </div>
        </div>
        <p className="form-notice" role="status">
          Internal only. No provider is connected here, and nothing on this page
          activates or deploys an e-signature service.
        </p>
        {notice ? <p className="form-notice" role="status">{notice.message}</p> : null}

        <div className="portal__panel portal__stack">
          <h2>{hasAgreement ? "Versions" : "Start agreement"}</h2>
          {!hasAgreement ? (
            <>
              <p className="lede">
                An accepted proposal is required. Starting the agreement creates
                version 1 as a draft bound to the current accepted proposal version.
              </p>
              <form className="form-stack" method="post" action={action}>
                <input type="hidden" name="intent" value="create" />
                <div className="field">
                  <label className="field__label" htmlFor="additionalTerms">
                    Additional contractual terms
                  </label>
                  <textarea className="textarea" id="additionalTerms" name="additionalTerms" maxLength={20000} />
                  <p className="portal__meta">Optional. Maximum 20,000 characters.</p>
                </div>
                <button className="button" type="submit">Start agreement</button>
              </form>
            </>
          ) : (
            <>
              <ul className="project-list">
                {agreement.versions.map((version) => (
                  <li className="project-row" key={version.versionNumber}>
                    <div className="portal__stack">
                      <span>
                        Version {version.versionNumber} · {version.status}
                      </span>
                      <span className="portal__meta">
                        Proposal version {version.proposalVersionNumber} · created{" "}
                        {PORTAL_DATE_FORMAT.format(new Date(version.createdAt))}
                      </span>
                      {version.publishedAt !== null ? (
                        <span className="portal__meta">
                          Published {PORTAL_DATE_FORMAT.format(new Date(version.publishedAt))}
                        </span>
                      ) : null}
                      {version.signedAt !== null ? (
                        <span className="portal__meta">
                          Signed {PORTAL_DATE_FORMAT.format(new Date(version.signedAt))} ·{" "}
                          {version.signatureCount} signature
                          {version.signatureCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {version.additionalTerms ? (
                        <span className="portal__meta">{version.additionalTerms}</span>
                      ) : (
                        <span className="portal__meta">No additional contractual terms.</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {latest ? (
                <div className="portal__panel portal__stack">
                  <h2>Create next version</h2>
                  <p className="portal__meta">
                    The next version binds to the project's current accepted proposal
                    version. Earlier versions remain immutable.
                  </p>
                  <form className="form-stack" method="post" action={action}>
                    <input type="hidden" name="intent" value="create-version" />
                    <div className="field">
                      <label className="field__label" htmlFor="nextTerms">
                        Additional contractual terms
                      </label>
                      <textarea className="textarea" id="nextTerms" name="additionalTerms" maxLength={20000} />
                    </div>
                    <button className="button" type="submit">Save next draft</button>
                  </form>
                </div>
              ) : null}
              {agreement.versions.some((version) => version.status === "draft") ? (
                <div className="portal__panel portal__stack">
                  <h2>Publish version</h2>
                  <form className="form-stack" method="post" action={action}>
                    <input type="hidden" name="intent" value="publish" />
                    <div className="field">
                      <label className="field__label" htmlFor="versionNumber">Version</label>
                      <select className="field__select" id="versionNumber" name="versionNumber" defaultValue={String(agreement.latestVersionNumber ?? 1)}>
                        {agreement.versions
                          .filter((version) => version.status === "draft")
                          .map((version) => (
                            <option key={version.versionNumber} value={version.versionNumber}>
                              Version {version.versionNumber}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button className="button" type="submit">Publish version</button>
                  </form>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
