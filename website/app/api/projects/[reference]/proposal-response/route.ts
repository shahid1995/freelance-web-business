/**
 * POST /api/projects/{reference}/proposal-response
 *
 * Records one explicit customer response to the current published proposal
 * version: Request Changes or Accept Proposal. A form-post endpoint like
 * `POST /api/projects/{reference}/intake` — not a JSON API, and not a generic
 * endpoint that accepts arbitrary project or version identifiers. The reference
 * in the URL is the only resource selector; it is resolved and authorized
 * server-side, and no new customer JSON read endpoint exists.
 *
 * Every business rule lives in `CustomerProposalResponseService`: it
 * authorizes the caller against the project on the server, re-derives the
 * current published version inside the recording transaction, enforces the
 * response rule table, and writes the response row and its audit event
 * together. This handler only translates a service outcome into a redirect
 * carrying a short, approved notice code — never a service message, token, or
 * internal state — and branches on the stable platform error code.
 */

import {
  PLATFORM_ERROR_CODES,
  PROPOSAL_RESPONSE_ERROR_CODES,
  ValidationError,
  isPlatformError,
} from "@/lib/platform/errors";
import {
  redirectWith,
  requireSessionForAction,
} from "@/lib/platform/server";

/** The approved notice code for a service failure, or null to re-throw. */
function noticeCodeFor(error: unknown): string | null {
  if (isPlatformError(error, PROPOSAL_RESPONSE_ERROR_CODES.updated)) {
    return "proposal-updated";
  }
  if (isPlatformError(error, PROPOSAL_RESPONSE_ERROR_CODES.versionAccepted)) {
    return "proposal-version-accepted";
  }
  if (isPlatformError(error, PROPOSAL_RESPONSE_ERROR_CODES.notAcceptable)) {
    return "proposal-not-acceptable";
  }
  if (isPlatformError(error, PLATFORM_ERROR_CODES.invalidInput)) {
    return "proposal-response-invalid";
  }
  if (isPlatformError(error, PLATFORM_ERROR_CODES.rateLimited)) {
    return "proposal-response-rate-limited";
  }
  // Not found (missing, unrelated, or revoked project; no proposal), forbidden
  // (no project access; an ordinary member attempting acceptance), and any
  // other platform refusal all surface as one customer-safe denial.
  if (isPlatformError(error)) {
    return "proposal-response-denied";
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const returnTo = `/dashboard/projects/${encodeURIComponent(reference)}/proposal`;
  const { platform, personId } = await requireSessionForAction(request.method, returnTo);

  try {
    // Resolving the reference also enforces project access before any read or
    // write happens; an unrelated project is reported as missing.
    const projectId = platform.projects.resolveProjectIdByReference(personId, reference);

    const form = await request.formData();
    const intent = form.get("intent");
    const action =
      intent === "accept"
        ? "accepted"
        : intent === "request-changes"
          ? "changes_requested"
          : null;
    if (action === null) {
      throw new ValidationError("That proposal response action is not recognised.");
    }

    platform.customerProposalResponses.submit({
      personId,
      projectId,
      action,
      versionNumber: form.get("versionNumber"),
      // An acceptance carries no message; a request for changes requires one.
      message: action === "changes_requested" ? form.get("message") : null,
      actionKey: form.get("actionKey"),
    });

    return redirectWith(request, returnTo, {
      sent:
        action === "accepted"
          ? "proposal-response-accepted"
          : "proposal-response-changes-requested",
    });
  } catch (error) {
    const notice = noticeCodeFor(error);
    if (notice === null) {
      // Unexpected failures are re-thrown rather than shown to the customer.
      throw error;
    }
    return redirectWith(request, returnTo, { error: notice });
  }
}
