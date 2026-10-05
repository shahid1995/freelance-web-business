import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isMissing, requireSessionForPage } from "@/lib/platform/server";
import { PORTAL_DATE_FORMAT } from "@/lib/platform/views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Project queue",
  robots: { index: false, follow: false },
};

/**
 * Founder project queue.
 *
 * The operational entry point into the existing Founder review workflow, so the
 * Founder does not have to know a project reference in advance. Every row links to
 * `/internal/projects/{reference}/review`, which is where review actually happens;
 * this page deliberately holds no review logic of its own.
 *
 * Internal-only and Founder-only. The capability check runs inside the service
 * before anything is read, and a missing capability is reported as not-found so
 * it is indistinguishable from a page that does not exist. No customer-facing page
 * links here.
 *
 * Rendering is strictly read-only. Loading this page performs no write and no
 * state change — in particular it does not start a review, which remains an
 * explicit action on the review page.
 */
export default async function InternalProjectQueuePage() {
  const { platform, personId } = await requireSessionForPage("/internal/projects");

  let rows;
  try {
    rows = platform.internal.queue(personId);
  } catch (error) {
    if (isMissing(error)) {
      // No capability and nothing to show are deliberately indistinguishable.
      notFound();
    }
    throw error;
  }

  return (
    <section className="portal">
      <div className="container portal__stack">
        <div className="portal__header">
          <div className="portal__stack">
            <p className="eyebrow">Founder workspace</p>
            <h1>Project queue</h1>
            <p className="portal__meta">
              {rows.length === 1 ? "1 submitted Project Intake" : `${rows.length} submitted Project Intakes`}
            </p>
          </div>
        </div>

        <p className="form-notice" role="status">
          Internal only. Opening this queue changes nothing and records nothing.
        </p>

        <div className="portal__panel portal__stack">
          {rows.length === 0 ? (
            <p className="lede">
              Nothing is waiting. Projects appear here once a customer submits their
              Project Intake.
            </p>
          ) : (
            <ul className="project-list">
              {rows.map((row) => (
                <li className="project-row" key={row.reference}>
                  <div className="portal__stack">
                    <Link href={`/internal/projects/${encodeURIComponent(row.reference)}/review`}>
                      {row.title}
                    </Link>
                    <span className="project-row__reference">{row.reference}</span>
                    <span className="portal__meta">{row.organizationName}</span>
                  </div>
                  <div className="portal__stack">
                    <span className="portal__meta">
                      {PORTAL_DATE_FORMAT.format(new Date(row.submittedAt))}
                    </span>
                    <span className="portal__meta">{row.customerStageLabel}</span>
                    <span className="portal__meta">
                      {row.reviewStarted ? "Review started" : "Review not started"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
