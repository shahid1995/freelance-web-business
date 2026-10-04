/**
 * POST /api/projects/{reference}/intake
 *
 * Saves Project Intake progress, or submits it.
 *
 * Every read and write goes through the services, which authorize the caller
 * against the project on the server. Submitted fields are validated against the
 * declared intake fields, so an added or tampered key is rejected rather than
 * written, and a partial save leaves unsupplied answers alone.
 */

import { parseIntakePatch } from "@/lib/platform/intake";
import {
  redirectAfterError,
  redirectWith,
  requireSessionForAction,
} from "@/lib/platform/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const returnTo = `/dashboard/projects/${encodeURIComponent(reference)}/intake`;
  const { platform, personId } = await requireSessionForAction(request.method, returnTo);

  try {
    // Resolving the reference also enforces project access before any read or
    // write happens.
    const projectId = platform.projects.resolveProjectIdByReference(personId, reference);

    const form = await request.formData();
    const raw: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (key === "intent") continue;
      raw[key] = typeof value === "string" ? value : null;
    }
    const patch = parseIntakePatch(raw);

    if (form.get("intent") === "submit") {
      platform.intake.submit(personId, projectId);
      return redirectWith(request, returnTo, { submitted: "1" });
    }

    platform.intake.saveDraft({ personId, projectId, patch });
    return redirectWith(request, returnTo, { saved: "1" });
  } catch (error) {
    return redirectAfterError(error, returnTo, "intake");
  }
}