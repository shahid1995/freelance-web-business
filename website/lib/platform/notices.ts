/**
 * Customer-facing notices.
 *
 * Route handlers redirect back to a page with a short code in the query string
 * rather than rendering an error inline. This module is the single place those
 * codes become words, so a code can never be rendered raw and no internal message
 * is passed through the URL.
 *
 * Codes come from the handler, not from the customer: the `detail` parameter is
 * ignored deliberately, so a message can only ever be one of the approved
 * strings below.
 */

export interface Notice {
  kind: "error" | "success";
  message: string;
}

/** One shared wording for every rate-limited route's notice. */
const RATE_LIMITED_MESSAGE = "Too many requests. Please wait a moment and try again.";

const MESSAGES: Record<string, Notice> = {
  "link-sent": {
    kind: "success",
    message:
      "If that address can receive sign-in links, one is on its way. The link works once and expires shortly.",
  },
  "invalid-email": {
    kind: "error",
    message: "Enter a valid email address.",
  },
  "sign-in-rate-limited": {
    kind: "error",
    message: "Too many sign-in links requested. Please wait a few minutes and try again.",
  },
  "invalid-link": {
    kind: "error",
    message: "That sign-in link is no longer valid. Request a new one to continue.",
  },
  "link-rate-limited": {
    kind: "error",
    message: "Too many attempts with that link. Please request a new one.",
  },
  "organization-denied": {
    kind: "error",
    message: "We could not create that organization. Check the name and try again.",
  },
  "organization-rate-limited": {
    kind: "error",
    message: RATE_LIMITED_MESSAGE,
  },
  "project-denied": {
    kind: "error",
    message: "We could not start that project. Only an organization owner or admin can start a project.",
  },
  "project-rate-limited": {
    kind: "error",
    message: RATE_LIMITED_MESSAGE,
  },
  "intake-denied": {
    kind: "error",
    message: "We could not save your Project Intake. Please review your answers and try again.",
  },
  "intake-rate-limited": {
    kind: "error",
    message: RATE_LIMITED_MESSAGE,
  },
  "origin-denied": {
    kind: "error",
    message: "That request could not be verified. Please reload the page and try again.",
  },
  // Customer proposal response (Request Changes / Accept).
  "proposal-response-accepted": {
    kind: "success",
    message:
      "Your acceptance of this proposal version has been recorded. It applies to this version only.",
  },
  "proposal-response-changes-requested": {
    kind: "success",
    message:
      "Your change request has been recorded for this proposal version. Requesting changes does not change, accept, or reject the proposal.",
  },
  "proposal-response-denied": {
    kind: "error",
    message: "We could not record that response. Please reload the page and try again.",
  },
  "proposal-response-invalid": {
    kind: "error",
    message:
      "That response was not accepted. Check the proposal version and your message, then try again.",
  },
  "proposal-response-rate-limited": {
    kind: "error",
    message: RATE_LIMITED_MESSAGE,
  },
  "proposal-updated": {
    kind: "error",
    message:
      "This proposal has been updated. Review the latest version, then respond again.",
  },
  "proposal-version-accepted": {
    kind: "error",
    message:
      "This proposal version has already been accepted, so no further response can be recorded against it.",
  },
  "proposal-not-acceptable": {
    kind: "error",
    message:
      "This proposal version can no longer be accepted because changes were requested against it.",
  },
};

export function noticeFor(
  params: Record<string, string | string[] | undefined>,
): Notice | null {
  const raw = params.error ?? params.sent;
  const code = Array.isArray(raw) ? raw[0] : raw;
  if (!code) return null;
  return MESSAGES[code] ?? null;
}