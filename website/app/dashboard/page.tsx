import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { resolveOrganizationContext } from "@/lib/platform/authorization";
import { requireSessionForPage } from "@/lib/platform/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your projects and saved Project Intake progress.",
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/**
 * Customer dashboard.
 *
 * Shows the organization context, the projects this person may actually see, and
 * the Start Your Project action for an owner or admin.
 *
 * The project list comes from the service, which applies the access rules; the
 * page never decides what to show on its own, and nothing internal is rendered.
 */
export default async function DashboardPage() {
  const { platform, personId } = await requireSessionForPage("/dashboard");

  const context = resolveOrganizationContext(platform.store, personId);
  if (!context) {
    // Verified, but no organization yet: the next step in signup.
    redirect("/onboarding/organization");
  }

  const { actor, isAdministrator } = context;
  const projects = platform.projects.listAccessibleProjects(personId);
  const actionKey = platform.projects.newActionKey();

  return (
    <section className="portal">
      <div className="container portal__stack">
        <div className="portal__header">
          <div className="portal__stack">
            <p className="eyebrow">Customer dashboard</p>
            <h1>{actor.organization.name}</h1>
            <p className="portal__meta">
              Signed in as {actor.person.email} · {actor.membership.role}
            </p>
          </div>
          <form method="post" action="/api/auth/sign-out">
            <button className="button button-secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>

        {isAdministrator ? (
          <div className="portal__panel portal__stack">
            <div>
              <h2>Start a new project</h2>
              <p className="lede">
                Starting a project creates it now and opens its Project Intake, so
                you can answer what you know today and come back to the rest later.
              </p>
            </div>
            <div className="portal__actions">
              <form method="post" action="/api/projects">
                {/* Rendered by the server and unique per rendered form, so one
                    click cannot create two projects even if the page is
                    submitted twice. */}
                <input type="hidden" name="actionKey" value={actionKey} />
                <button className="button" type="submit">
                  Start Your Project
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <div className="portal__panel portal__stack">
          <div>
            <h2>Your projects</h2>
            {projects.length === 0 ? (
              <p className="lede">
                No projects are shared with you yet. Your organization owner or an
                admin can give you access to a project.
              </p>
            ) : null}
          </div>

          {projects.length > 0 ? (
            <ul className="project-list">
              {projects.map((project) => {
                const percentage = Math.round(
                  (project.answeredFieldCount / project.totalFieldCount) * 100,
                );
                return (
                  <li className="project-row" key={project.reference}>
                    <div className="portal__stack">
                      <Link href={`/dashboard/projects/${encodeURIComponent(project.reference)}/intake`}>
                        {project.title}
                      </Link>
                      <span className="project-row__reference">
                        {project.reference}
                      </span>
                      <span className="portal__meta">{project.stageLabel}</span>
                      {project.hasPublishedProposal ? (
                        <Link
                          href={`/dashboard/projects/${encodeURIComponent(project.reference)}/proposal`}
                        >
                          View proposal
                        </Link>
                      ) : null}
                    </div>
                    <div className="progress">
                      <div
                        className="progress__track"
                        role="progressbar"
                        aria-valuenow={project.answeredFieldCount}
                        aria-valuemin={0}
                        aria-valuemax={project.totalFieldCount}
                        aria-label={`Project Intake progress for ${project.title}`}
                      >
                        <div className="progress__fill" style={{ width: `${percentage}%` }} />
                      </div>
                      <span className="progress__label">
                        {project.answeredFieldCount} of {project.totalFieldCount} answers ·{" "}
                        {project.intakeStatus === "submitted"
                          ? "submitted"
                          : `last saved ${DATE_FORMAT.format(new Date(project.lastSavedAt))}`}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}