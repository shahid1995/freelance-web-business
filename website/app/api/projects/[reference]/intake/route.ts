/**
 * POST /api/projects/{reference}/intake
 *
 * Saves Project Intake progress, or submits it.
 *
 * Every read and write goes through the services, which authorize the caller
 * against the project on the server. Submitted fields are validated against the
 * declared intake fields, so an added or tampered key is rejected rather than
 * written, and a partial save leaves unsupplied answers alone.
 *
 * Submitted keys are handed to the validator as raw entries. They are never used
 * as property names on an assembled object, so a key such as `__proto__` cannot
 * reach a record or affect any object's prototype.
 */

import { parseIntakeEntries } from "@/lib/platform/intake";
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
    const entries: [string, string | null][] = [];
    for (const [key, value] of form.entries()) {
      if (key === "intent") continue;
      entries.push([key, typeof value === "string" ? value : null]);
    }
    const patch = parseIntakeEntries(entries);

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