import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { noticeFor } from "@/lib/platform/notices";
import {
  PROJECT_INTAKE_FIELD_LABELS,
  PROJECT_INTAKE_FIELDS,
} from "@/lib/platform/domain";
import { isMissing, requireSessionForPage } from "@/lib/platform/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Project Intake",
  description: "Tell us what you need. Your answers are saved as you go.",
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/**
 * Project Intake.
 *
 * Reads the saved draft through the service, which checks project access on the
 * server before returning anything. The form is rendered with the current
 * answers, so returning later resumes where the customer left off, and saving
 * again only changes the fields that were edited.
 */
export default async function ProjectIntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reference } = await params;
  const { platform, personId } = await requireSessionForPage(
    `/dashboard/projects/${reference}/intake`,
  );

  let detail;
  try {
    detail = platform.projects.getCustomerProjectByReference(personId, reference);
  } catch (error) {
    if (isMissing(error)) {
      // An unrelated or revoked project is indistinguishable from one that does
      // not exist, from the customer's point of view.
      notFound();
    }
    throw error;
  }

  const answers = detail.intake?.answers ?? {};
  const submitted = detail.intake?.status === "submitted";
  const savedAt = detail.intake?.lastSavedAt ?? detail.project.lastSavedAt;
  const notice = noticeFor(await searchParams);
  const action = `/api/projects/${encodeURIComponent(reference)}/intake`;

  return (
    <section className="portal">
      <div className="container portal__stack">
        <div className="portal__header">
          <div className="portal__stack">
            <p className="eyebrow">
              {detail.project.reference} · {detail.project.stageLabel}
            </p>
            <h1>Project Intake</h1>
            <p className="portal__meta">
              {detail.project.answeredFieldCount} of {detail.project.totalFieldCount}{" "}
              answered · last saved {DATE_FORMAT.format(new Date(savedAt))}
            </p>
          </div>
          <div className="portal__actions">
            <Link className="button button-secondary" href="/dashboard">
              Back to dashboard
            </Link>
          </div>
        </div>

        {submitted ? (
          <p className="form-notice" role="status">
            Your Project Intake has been submitted. Thank you — we will be in touch
            about what happens next.
          </p>
        ) : null}

        {notice ? (
          <p
            className={
              notice.kind === "error"
                ? "form-notice form-notice--error"
                : "form-notice"
            }
            role={notice.kind === "error" ? "alert" : "status"}
          >
            {notice.message}
          </p>
        ) : null}

        <div className="portal__panel">
          <p className="lede">
            Answer what you can. Anything you leave blank stays blank and you can
            return to it — your progress is saved against this project.
          </p>

          <form className="form-stack" method="post" action={action}>
            {PROJECT_INTAKE_FIELDS.map((field) => (
              <div className="intake-section" key={field}>
                <div className="field">
                  <label className="field__label" htmlFor={field}>
                    {PROJECT_INTAKE_FIELD_LABELS[field]}
                  </label>
                  <textarea
                    className="textarea"
                    id={field}
                    name={field}
                    defaultValue={answers[field] ?? ""}
                    disabled={submitted}
                  />
                </div>
              </div>
            ))}

            {!submitted ? (
              <div className="portal__actions">
                <button className="button" type="submit" name="intent" value="save">
                  Save progress
                </button>
                <button
                  className="button button-secondary"
                  type="submit"
                  name="intent"
                  value="submit"
                >
                  Submit Project Intake
                </button>
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}