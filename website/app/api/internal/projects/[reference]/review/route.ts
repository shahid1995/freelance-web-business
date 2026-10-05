/**
 * POST /api/internal/projects/{reference}/review
 *
 * Every Founder action on a submitted Project Intake.
 *
 * This handler is internal-only and shares no code path with the customer
 * endpoints: it resolves the project through the internal capability rather than
 * through organization membership, so a customer session cannot reach it by
 * changing the URL, a query parameter, or the body.
 *
 * `requireSessionForAction` applies the same session and origin protections the
 * customer writes already use, so a cross-origin request is refused before the
 * service runs. The intent field selects which internal action to perform; an
 * unrecognised intent is rejected rather than ignored.
 */

import { ValidationError } from "@/lib/platform/errors";
import { redirectAfterError, redirectWith, requireSessionForAction } from "@/lib/platform/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const returnTo = `/internal/projects/${encodeURIComponent(reference)}/review`;
  const { platform, personId } = await requireSessionForAction(request.method, returnTo);

  try {
    // Resolving the reference performs the Founder capability check first, so an
    // unauthorized caller cannot even probe for a project.
    const projectId = platform.internal.resolveProjectId(personId, reference);
    const form = await request.formData();
    const intent = form.get("intent");

    switch (intent) {
      case "start-review": {
        platform.internal.startReview({ personId, projectId });
        return redirectWith(request, returnTo, { internal: "review-started" });
      }
      case "qualification": {
        // Read straight from the raw form value: the service validates against the
        // closed vocabulary, so an unlisted state is rejected server-side.
        platform.internal.setQualificationState({
          personId,
          projectId,
          state: form.get("qualificationState"),
        });
        break;
      }
      case "notes": {
        platform.internal.recordInternalNotes({
          personId,
          projectId,
          notes: form.get("notes"),
        });
        break;
      }
      case "decision": {
        platform.internal.recordFounderDecision({
          personId,
          projectId,
          decision: form.get("decision"),
        });
        break;
      }
      case "next-action": {
        platform.internal.recordInternalNextAction({
          personId,
          projectId,
          nextAction: form.get("nextAction"),
        });
        break;
      }
      default:
        throw new ValidationError("That action is not part of the Founder workspace.");
    }

    return redirectWith(request, returnTo, { internal: "internal-updated" });
  } catch (error) {
    return redirectAfterError(error, returnTo, "internal");
  }
}
