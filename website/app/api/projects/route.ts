/**
 * POST /api/projects
 *
 * Start Your Project.
 *
 * Requires an organization owner or admin — the authorization runs server-side
 * before any project is created, so an ordinary member's request is refused even
 * if the form were rendered for them. The project and its Project Intake draft are
 * created together, and the caller is redirected straight into the intake.
 */

import { resolveOrganizationContext } from "@/lib/platform/authorization";
import {
  redirectAfterError,
  redirectWith,
  requireSessionForAction,
} from "@/lib/platform/server";

const RETURN_TO = "/dashboard";

export async function POST(request: Request) {
  const { platform, personId } = await requireSessionForAction(request.method, RETURN_TO);

  const context = resolveOrganizationContext(platform.store, personId);
  if (!context) {
    return redirectWith(request, "/onboarding/organization", {});
  }

  const form = await request.formData();
  const actionKey = form.get("actionKey");

  try {
    const result = platform.projects.createProject({
      personId,
      organizationId: context.actor.organization.id,
      actionKey: typeof actionKey === "string" ? actionKey : null,
    });
    return redirectWith(
      request,
      `/dashboard/projects/${encodeURIComponent(result.project.reference)}/intake`,
      // A repeated action lands on the same project rather than announcing a
      // second creation.
      result.created ? { created: "1" } : {},
    );
  } catch (error) {
    return redirectAfterError(error, RETURN_TO, "project");
  }
}