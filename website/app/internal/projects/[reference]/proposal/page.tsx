import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { internalNoticeFor } from "@/lib/platform/internal-notices";
import { isMissing, requireSessionForPage } from "@/lib/platform/server";
import { PORTAL_DATE_FORMAT } from "@/lib/platform/views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Proposal",
  robots: { index: false, follow: false },
};

/** The content fields every proposal version must carry, in display order. */
const CONTENT_FIELDS = [
  { name: "summary", label: "Summary" },
  { name: "scopeIncluded", label: "In scope" },
  { name: "scopeExcluded", label: "Out of scope" },
  { name: "deliverables", label: "Deliverables" },
  { name: "timeline", label: "Timeline" },
  { name: "assumptions", label: "Assumptions" },
  { name: "commercialTerms", label: "Commercial terms" },
] as const;

/**
 * Founder proposal authoring surface for one project.
 *
 * Internal-only, and deliberately separate from the customer workspace: no
 * customer route or projection reads a proposal, and reaching this page requires
 * the `founder` capability. The page is read-only apart from its forms; every
 * write is a separate, authorized, audited POST handled by the proposal service.
 */
export default async function InternalProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reference } = await params;
  const { platform, personId } = await requireSessionForPage(
    `/internal/projects/${reference}/proposal`,
  );

  let proposal;
  try {
    const projectId = platform.internal.resolveProjectId(personId, reference);
    proposal = platform.proposals.read(personId, projectId);
  } catch (error) {
    if (isMissing(error)) {
      notFound();
    }
    throw error;
  }

  const notice = internalNoticeFor(await searchParams);
  const action = `/api/internal/projects/${encodeURIComponent(reference)}/proposal`;
  const versions = proposal.versions;
  const hasProposal = proposal.proposalId !== null;
  const latestNumber = proposal.latestVersionNumber;
  const latest = versions.length > 0 ? versions[versions.length - 1] : undefined;

  return (
    <section className="portal">
      <div className="container portal__stack">
        <div className="portal__header">
          <div className="portal__stack">
            <p className="eyebrow">
              {proposal.projectReference} ·{" "}
              {latestNumber === null
                ? "No proposal yet"
                : `Version ${latestNumber}`}
            </p>
            <h1>Proposal</h1>
            <p className="portal__meta">
              <Link href={`/internal/projects/${encodeURIComponent(reference)}/review`}>
                Back to review
              </Link>
            </p>
          </div>
        </div>

        <p className="form-notice" role="status">
          Internal only. Nothing on this page is visible to the customer, and no
          version here has been sent to or accepted by anyone.
        </p>

        {notice ? (
          <p className="form-notice" role="status">
            {notice.message}
          </p>
        ) : null}

        <div className="portal__panel portal__stack">
          <h2>Versions</h2>
          {versions.length === 0 ? (
            <p className="lede">
              No proposal has been started for this project yet. Starting one
              writes version 1 as a draft.
            </p>
          ) : (
            <ul className="project-list">
              {versions.map((version) => (
                <li className="project-row" key={version.versionNumber}>
                  <div className="portal__stack">
                    <span>
                      Version {version.versionNumber} ·{" "}
                      {version.status === "published" ? "published" : "draft"}
                    </span>
                    <span className="portal__meta">
                      created{" "}
                      {PORTAL_DATE_FORMAT.format(new Date(version.createdAt))}
                      {version.publishedAt !== null
                        ? ` · published ${PORTAL_DATE_FORMAT.format(
                            new Date(version.publishedAt),
                          )}`
                        : ""}
                    </span>
                    <span className="portal__meta">{version.summary}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {latest ? (
          <div className="portal__panel portal__stack">
            <h2>
              Version {latest.versionNumber} ·{" "}
              {latest.status === "published" ? "published" : "draft"}
            </h2>
            {CONTENT_FIELDS.map((field) => (
              <div className="field" key={field.name}>
                <p className="field__label">{field.label}</p>
                <p className="lede">{latest[field.name]}</p>
              </div>
            ))}
            {latest.validUntil !== null ? (
              <div className="field">
                <p className="field__label">Valid until</p>
                <p className="lede">
                  {PORTAL_DATE_FORMAT.format(new Date(latest.validUntil))}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="portal__panel portal__stack">
          <h2>{hasProposal ? "Create next version" : "Start proposal"}</h2>
          <p className="portal__meta">
            {hasProposal
              ? "A new version is appended. It does not change any earlier version."
              : "Starting the proposal writes version 1 as a draft."}
          </p>
          <form className="form-stack" method="post" action={action}>
            <input
              type="hidden"
              name="intent"
              value={hasProposal ? "create-version" : "create"}
            />
            {CONTENT_FIELDS.map((field) => (
              <div className="field" key={field.name}>
                <label className="field__label" htmlFor={field.name}>
                  {field.label}
                </label>
                <textarea
                  className="textarea"
                  id={field.name}
                  name={field.name}
                  required
                />
              </div>
            ))}
            <div className="field">
              <label className="field__label" htmlFor="validUntil">
                Valid until
              </label>
              <input
                className="textarea"
                id="validUntil"
                name="validUntil"
                type="datetime-local"
              />
              <p className="portal__meta">Optional.</p>
            </div>
            <button className="button" type="submit">
              {hasProposal
                ? `Save version ${(latestNumber ?? 0) + 1}`
                : "Save version 1"}
            </button>
          </form>
        </div>

        {versions.length > 0 ? (
          <div className="portal__panel portal__stack">
            <h2>Publish a version</h2>
            <p className="form-notice">
              Publishing makes a version available to the future customer-facing
              workflow. It does not mean the customer has seen or accepted
              anything, and it does not move the customer-facing stage.
            </p>
            <form className="form-stack" method="post" action={action}>
              <input type="hidden" name="intent" value="publish" />
              <div className="field">
                <label className="field__label" htmlFor="versionNumber">
                  Version
                </label>
                <select
                  className="textarea"
                  id="versionNumber"
                  name="versionNumber"
                  defaultValue={String(latestNumber ?? 1)}
                  required
                >
                  {versions.map((version) => (
                    <option
                      key={version.versionNumber}
                      value={version.versionNumber}
                    >
                      Version {version.versionNumber}
                      {version.status === "published" ? " · published" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button className="button" type="submit">
                Publish version
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}
