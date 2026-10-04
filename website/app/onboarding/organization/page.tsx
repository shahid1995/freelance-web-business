import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { resolveOrganizationContext } from "@/lib/platform/authorization";
import { PortalNotice } from "@/components/portal-notice";
import { noticeFor } from "@/lib/platform/notices";
import { requireSessionForPage } from "@/lib/platform/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your organization",
  description: "Set up the organization your projects belong to.",
};

/**
 * Organization creation, reached by a verified person who does not yet belong to
 * one.
 *
 * The session is required before this page renders, and the organization is
 * created server-side on submit. Submitting twice is harmless: the service returns
 * the organization that already exists rather than creating a second one.
 */
export default async function CreateOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { platform, personId } = await requireSessionForPage("/onboarding/organization");

  const context = resolveOrganizationContext(platform.store, personId);
  if (context) {
    // Already part of an organization: nothing to create.
    redirect("/dashboard");
  }

  const notice = noticeFor(await searchParams);

  return (
    <section className="portal">
      <div className="container">
        <div className="portal__panel portal__panel--narrow portal__stack">
          <div>
            <p className="eyebrow">Almost there</p>
            <h1>Set up your organization</h1>
            <p className="lede">
              Projects belong to an organization. This is the name we will use for
              your projects, proposals, and correspondence.
            </p>
          </div>

          <PortalNotice notice={notice} />

          <form className="form-stack" method="post" action="/api/organization">
            <div className="field">
              <label className="field__label" htmlFor="organizationName">
                Organization or business name
              </label>
              <input
                className="input"
                type="text"
                id="organizationName"
                name="organizationName"
                autoComplete="organization"
                required
                maxLength={120}
                autoFocus
              />
              <p className="field__hint">
                You will be the owner of this organization and can invite others
                later.
              </p>
            </div>
            <div className="portal__actions">
              <button className="button" type="submit">
                Create organization
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}