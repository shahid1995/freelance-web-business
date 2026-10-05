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
    message: "Too many requests. Please wait a moment and try again.",
  },
  "project-denied": {
    kind: "error",
    message: "We could not start that project. Only an organization owner or admin can start a project.",
  },
  "project-rate-limited": {
    kind: "error",
    message: "Too many requests. Please wait a moment and try again.",
  },
  "intake-denied": {
    kind: "error",
    message: "We could not save your Project Intake. Please review your answers and try again.",
  },
  "intake-rate-limited": {
    kind: "error",
    message: "Too many requests. Please wait a moment and try again.",
  },
  "origin-denied": {
    kind: "error",
    message: "That request could not be verified. Please reload the page and try again.",
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