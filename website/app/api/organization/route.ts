/**
 * POST /api/organization
 *
 * Creates the signed-in person's organization and makes them its owner.
 *
 * The person id comes from the session, never from the request body, so this
 * endpoint can only ever act on the caller's own account. Submitting more than
 * once returns the organization that already exists.
 */

import {
  redirectAfterError,
  redirectWith,
  requireSessionForAction,
} from "@/lib/platform/server";

const RETURN_TO = "/onboarding/organization";

export async function POST(request: Request) {
  const { platform, personId } = await requireSessionForAction(request.method, RETURN_TO);
  const form = await request.formData();
  const name = form.get("organizationName");

  try {
    const result = platform.organizations.createForPerson(
      personId,
      typeof name === "string" ? name : "",
    );
    // Whether the organization was just created or already existed, the
    // customer belongs in the same place.
    return redirectWith(request, "/dashboard", result.created ? { created: "1" } : {});
  } catch (error) {
    return redirectAfterError(error, RETURN_TO, "organization");
  }
}