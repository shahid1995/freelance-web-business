/**
 * POST /api/internal/projects/{reference}/proposal
 *
 * The Founder-only proposal actions for one project: create the first version,
 * create the next version, and publish an existing version.
 *
 * This handler is internal-only and shares no code path with the customer
 * endpoints: it resolves the project through the internal capability rather than
 * through organization membership, so a customer session cannot reach it by
 * changing the URL, a query parameter, or the body.
 *
 * Form parsing lives in `lib/platform/proposal-form.ts` so the boundary rules can
 * be tested without a running request; the service remains the authority on
 * everything it is given.
 */

import { ValidationError } from "@/lib/platform/errors";
import {
  readProposalContent,
  readVersionNumber,
} from "@/lib/platform/proposal-form";
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
  const returnTo = `/internal/projects/${encodeURIComponent(reference)}/proposal`;
  const { platform, personId } = await requireSessionForAction(request.method, returnTo);

  try {
    const projectId = platform.internal.resolveProjectId(personId, reference);
    const form = await request.formData();
    const intent = form.get("intent");

    if (intent === "create") {
      platform.proposals.createProposal({
        personId,
        projectId,
        content: readProposalContent(form),
      });
      return redirectWith(request, returnTo, { internal: "proposal-created" });
    }

    if (intent === "create-version") {
      platform.proposals.createVersion({
        personId,
        projectId,
        content: readProposalContent(form),
      });
      return redirectWith(
        request,
        returnTo,
        { internal: "proposal-version-created" },
      );
    }

    if (intent === "publish") {
      platform.proposals.publishVersion({
        personId,
        projectId,
        versionNumber: readVersionNumber(form),
      });
      return redirectWith(
        request,
        returnTo,
        { internal: "proposal-version-published" },
      );
    }

    throw new ValidationError("That action is not part of the proposal workspace.");
  } catch (error) {
    return redirectAfterError(error, returnTo, "internal");
  }
}
