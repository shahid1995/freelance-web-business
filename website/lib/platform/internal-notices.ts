/**
 * Internal-workspace notices.
 *
 * The internal workspace uses the same redirect-with-a-short-code pattern as the
 * customer flows, but its wording is operational and must never be the source of
 * customer copy. Keeping the map separate from `notices.ts` makes that boundary
 * explicit: an internal code cannot fall through to a customer sentence, and a
 * customer code cannot appear in the Founder view.
 *
 * As in `notices.ts`, the `detail` parameter is ignored deliberately, so a code
 * can only ever render as one of the approved strings below.
 */

export interface InternalNotice {
  kind: "error" | "success";
  message: string;
}

const MESSAGES: Record<string, InternalNotice> = {
  "internal-denied": {
    kind: "error",
    message: "That action was not permitted.",
  },
  "internal-rate-limited": {
    kind: "error",
    message: "Too many requests. Please wait a moment and try again.",
  },
  "review-started": {
    kind: "success",
    message: "Review started. The customer can now see that their Project Intake is in review.",
  },
  "internal-updated": {
    kind: "success",
    message: "Saved. This stays internal.",
  },
  "proposal-created": {
    kind: "success",
    message: "Proposal started. The first version is a draft and stays internal.",
  },
  "proposal-version-created": {
    kind: "success",
    message: "New draft version saved. Earlier versions are unchanged.",
  },
  "proposal-version-published": {
    kind: "success",
    message: "Version published. The customer has still seen and accepted nothing.",
  },
  "agreement-created": {
    kind: "success",
    message: "Agreement started. Version 1 is a draft and stays internal.",
  },
  "agreement-version-created": {
    kind: "success",
    message: "New agreement draft saved. Earlier versions are unchanged.",
  },
  "agreement-version-published": {
    kind: "success",
    message: "Agreement version published and ready for the authorised customer signer.",
  },
};

export function internalNoticeFor(
  params: Record<string, string | string[] | undefined>,
): InternalNotice | null {
  const raw = params.error ?? params.internal;
  const code = Array.isArray(raw) ? raw[0] : raw;
  if (!code) return null;
  return MESSAGES[code] ?? null;
}
