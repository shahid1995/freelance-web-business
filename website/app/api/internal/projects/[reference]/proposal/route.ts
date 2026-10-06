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
 */

import { ValidationError } from "@/lib/platform/errors";
import {
  redirectAfterError,
  redirectWith,
  requireSessionForAction,
} from "@/lib/platform/server";

const MAX_CONTENT_LENGTH = 20000;

function trimRequired(
  form: FormData,
  field: string,
): string {
  const value = String(form.get(field) ?? "").trim();
  if (value.length === 0) {
    throw new ValidationError(`${field} is required for a proposal version.`);
  }
  if (value.length > MAX_CONTENT_LENGTH) {
    throw new ValidationError(`Keep ${field} under ${MAX_CONTENT_LENGTH} characters.`);
  }
  return value;
}

function optionalInt(
  form: FormData,
  field: string,
): number | null {
  const raw = form.get(field);
  if (raw === null || raw === "") {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw new ValidationError(`${field} must be a valid date the Founder has chosen.`);
  }
  return parsed;
}

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
      const content: Record<string, unknown> = {
        summary: trimRequired(form, "summary"),
        scopeIncluded: trimRequired(form, "scopeIncluded"),
        scopeExcluded: trimRequired(form, "scopeExcluded"),
        deliverables: trimRequired(form, "deliverables"),
        timeline: trimRequired(form, "timeline"),
        assumptions: trimRequired(form, "assumptions"),
        commercialTerms: trimRequired(form, "commercialTerms"),
        validUntil: optionalInt(form, "validUntil"),
      };
      platform.proposals.createProposal({ personId, projectId, content });
      return redirectWith(request, returnTo, { internal: "proposal-created" });
    }

    if (intent === "create-version") {
      const content: Record<string, unknown> = {
        summary: trimRequired(form, "summary"),
        scopeIncluded: trimRequired(form, "scopeIncluded"),
        scopeExcluded: trimRequired(form, "scopeExcluded"),
        deliverables: trimRequired(form, "deliverables"),
        timeline: trimRequired(form, "timeline"),
        assumptions: trimRequired(form, "assumptions"),
        commercialTerms: trimRequired(form, "commercialTerms"),
        validUntil: optionalInt(form, "validUntil"),
      };
      platform.proposals.createVersion({ personId, projectId, content });
      return redirectWith(
        request,
        returnTo,
        { internal: "proposal-version-created" },
      );
    }

    if (intent === "publish") {
      const rawVersionNumber = form.get("versionNumber");
      if (
        rawVersionNumber === null ||
        rawVersionNumber === "" ||
        !/^\\d+$/.test(String(rawVersionNumber))
      ) {
        throw new ValidationError(
          "That proposal version is not recognised.",
        );
      }
      platform.proposals.publishVersion({
        personId,
        projectId,
        versionNumber: Number(rawVersionNumber),
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
