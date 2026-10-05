import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FOUNDER_DECISIONS,
  INTERNAL_QUALIFICATION_STATES,
  PROJECT_INTAKE_FIELD_LABELS,
  PROJECT_INTAKE_FIELDS,
} from "@/lib/platform/domain";
import { internalNoticeFor } from "@/lib/platform/internal-notices";
import { isMissing, requireSessionForPage } from "@/lib/platform/server";
import { PORTAL_DATE_FORMAT } from "@/lib/platform/views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Project review",
  robots: { index: false, follow: false },
};

/**
 * Founder project review.
 *
 * Internal-only. Nothing here links into or out of the customer workspace, and
 * the page is reachable only with a session that holds the `founder` capability:
 * the service check runs before any data is read, so a signed-in customer who
 * guesses this URL sees a not-found rather than the review.
 *
 * Rendering is strictly read-only. Loading this page performs no write and no
 * state change — the customer-facing stage moves on to *Project Intake — Review*
 * only when the Start Review form below is submitted, which is a separate,
 * authorized, audited POST.
 */
export default async function InternalReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reference } = await params;
  const { platform, personId } = await requireSessionForPage(
    `/internal/projects/${reference}/review`,
  );

  let review;
  try {
    const projectId = platform.internal.resolveProjectId(personId, reference);
    review = platform.internal.review(personId, projectId);
  } catch (error) {
    if (isMissing(error)) {
      // No capability and no such project are deliberately indistinguishable.
      notFound();
    }
    throw error;
  }

  const notice = internalNoticeFor(await searchParams);
  const action = `/api/internal/projects/${encodeURIComponent(reference)}/review`;
  const submitted = review.intake?.status === "submitted";
  const reviewStartedAt = review.project.reviewStartedAt;
  const reviewStarted = reviewStartedAt !== null;

  return (
    <section className="portal">
      <div className="container portal__stack">
        <div className="portal__header">
          <div className="portal__stack">
            <p className="eyebrow">
              {review.project.reference} · {review.customerStageLabel}
            </p>
            <h1>{review.project.title}</h1>
            <p className="portal__meta">
              {review.organization.name} · created{" "}
              {PORTAL_DATE_FORMAT.format(new Date(review.project.createdAt))}
            </p>
          </div>
        </div>

        <p className="form-notice" role="status">
          Internal only. Nothing on this page is visible to the customer.
        </p>

        {notice ? (
          <p className="form-notice" role="status">
            {notice.message}
          </p>
        ) : null}

        <div className="portal__panel portal__stack">
          <h2>Customer</h2>
          <ul className="project-list">
            {review.customers.map((customer) => (
              <li className="project-row" key={customer.personId}>
                <div className="portal__stack">
                  <span>{customer.displayName ?? customer.email}</span>
                  <span className="portal__meta">{customer.email}</span>
                  <span className="portal__meta">
                    {customer.customerRole ?? "no membership"}
                    {customer.isProjectCreator ? " · created this project" : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="portal__panel portal__stack">
          <h2>Submitted Project Intake</h2>
          {review.intake ? (
            <p className="portal__meta">
              {review.intake.status} · schema v{review.intake.schemaVersion} ·{" "}
              {review.intake.submittedAt
                ? `submitted ${PORTAL_DATE_FORMAT.format(new Date(review.intake.submittedAt))}`
                : "not submitted"}
            </p>
          ) : (
            <p className="lede">No Project Intake is attached to this project.</p>
          )}
          {review.intake
            ? PROJECT_INTAKE_FIELDS.map((field) => (
                <div className="field" key={field}>
                  <p className="field__label">{PROJECT_INTAKE_FIELD_LABELS[field]}</p>
                  <p className="lede">{review.intake?.answers[field] ?? "—"}</p>
                </div>
              ))
            : null}
        </div>

        <div className="portal__panel portal__stack">
          <h2>Review</h2>
          <p className="portal__meta">
            {reviewStartedAt !== null
              ? `Review started ${PORTAL_DATE_FORMAT.format(new Date(reviewStartedAt))}`
              : "Review has not been started."}
          </p>
          {submitted && !reviewStarted ? (
            <form method="post" action={action}>
              <button className="button" type="submit" name="intent" value="start-review">
                Start Review
              </button>
            </form>
          ) : null}
          {!submitted ? (
            <p className="lede">
              The customer has not submitted this Project Intake yet, so it cannot be
              reviewed.
            </p>
          ) : null}
        </div>

        <div className="portal__panel portal__stack">
          <h2>Internal state</h2>
          <form className="form-stack" method="post" action={action}>
            <div className="field">
              <label className="field__label" htmlFor="qualificationState">
                Qualification state
              </label>
              <select
                className="textarea"
                id="qualificationState"
                name="qualificationState"
                defaultValue={review.internal.qualificationState}
              >
                {INTERNAL_QUALIFICATION_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <button className="button" type="submit" name="intent" value="qualification">
              Save qualification state
            </button>
          </form>

          <form className="form-stack" method="post" action={action}>
            <div className="field">
              <label className="field__label" htmlFor="notes">
                Internal notes
              </label>
              <textarea
                className="textarea"
                id="notes"
                name="notes"
                defaultValue={review.internal.internalNotes ?? ""}
              />
            </div>
            <button className="button" type="submit" name="intent" value="notes">
              Save internal notes
            </button>
          </form>

          <form className="form-stack" method="post" action={action}>
            <div className="field">
              <label className="field__label" htmlFor="decision">
                Founder decision
              </label>
              <select
                className="textarea"
                id="decision"
                name="decision"
                defaultValue={review.internal.founderDecision ?? ""}
              >
                <option value="">No decision recorded</option>
                {FOUNDER_DECISIONS.map((decision) => (
                  <option key={decision} value={decision}>
                    {decision}
                  </option>
                ))}
              </select>
            </div>
            <button className="button" type="submit" name="intent" value="decision">
              Record Founder decision
            </button>
          </form>

          <form className="form-stack" method="post" action={action}>
            <div className="field">
              <label className="field__label" htmlFor="nextAction">
                Internal next action
              </label>
              <textarea
                className="textarea"
                id="nextAction"
                name="nextAction"
                defaultValue={review.internal.internalNextAction ?? ""}
              />
            </div>
            <button className="button" type="submit" name="intent" value="next-action">
              Save internal next action
            </button>
          </form>
        </div>

        <div className="portal__panel portal__stack">
          <h2>Activity</h2>
          {review.audit.length === 0 ? (
            <p className="lede">Nothing recorded yet.</p>
          ) : (
            <ul className="project-list">
              {review.audit.map((entry) => (
                <li className="project-row" key={entry.id}>
                  <div className="portal__stack">
                    <span>{entry.type}</span>
                    <span className="portal__meta">
                      {PORTAL_DATE_FORMAT.format(new Date(entry.occurredAt))}
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
