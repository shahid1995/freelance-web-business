/**
 * Typed errors shared by the customer platform services.
 *
 * Each error carries a stable machine code and an HTTP status so route handlers
 * can translate a service failure into a response without inspecting messages.
 * Messages are written to be safe to show to an authenticated customer: they
 * never contain tokens, session identifiers, or internal business state.
 */

export class PlatformError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
  }
}

/**
 * Recognizes a platform error by its stable `code` rather than by class identity.
 *
 * `instanceof` is not reliable here: Next.js compiles each route into its own
 * bundle, so a page and a route handler can hold separate copies of this module
 * and therefore separate copies of the error classes. An error thrown by the
 * services inside a route bundle is not an `instanceof` the page bundle's class,
 * which turns an expected redirect into a 500. The code is the contract that
 * survives module duplication, so it is what callers branch on.
 */
export function isPlatformError(error: unknown, code?: string): error is PlatformError {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; status?: unknown };
  if (typeof candidate.code !== "string") return false;
  if (code !== undefined && candidate.code !== code) return false;
  return typeof candidate.status === "number";
}

export const PLATFORM_ERROR_CODES = {
  unauthenticated: "unauthenticated",
  forbidden: "forbidden",
  notFound: "not_found",
  invalidInput: "invalid_input",
  originRejected: "origin_rejected",
  rateLimited: "rate_limited",
  invalidSignInLink: "invalid_sign_in_link",
} as const;

/** No valid, unexpired, unrevoked session was presented. */
export class UnauthenticatedError extends PlatformError {
  constructor(message = "Sign in to continue.") {
    super("unauthenticated", message, 401);
  }
}

/** Authenticated, but the actor is not permitted to perform the operation. */
export class ForbiddenError extends PlatformError {
  constructor(message = "You do not have access to this.") {
    super("forbidden", message, 403);
  }
}

export class NotFoundError extends PlatformError {
  constructor(message = "Not found.") {
    super("not_found", message, 404);
  }
}

export class ValidationError extends PlatformError {
  constructor(message: string) {
    super("invalid_input", message, 400);
  }
}

/**
 * A state-changing request arrived without an acceptable Origin header. Requests
 * are rejected rather than the check being skipped, so a missing Origin can
 * never fall through to an unprotected mutation.
 */
export class OriginRejectedError extends PlatformError {
  constructor(message = "Request origin could not be verified.") {
    super("origin_rejected", message, 403);
  }
}

export class RateLimitedError extends PlatformError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = "Too many attempts. Please wait and try again.") {
    super("rate_limited", message, 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Customer proposal response outcomes (accepted Customer Proposal Response ADR,
 * sections 10 and 16).
 *
 * Each has its own stable code so the form-post handler can branch on the code
 * and give each outcome its own approved notice, without a service message ever
 * travelling through the redirect. Messages are customer-safe wording.
 */
export const AGREEMENT_ERROR_CODES = {
  updated: "agreement_updated",
  completed: "agreement_completed",
} as const;

export class AgreementUpdatedError extends PlatformError {
  constructor(
    message = "This agreement is no longer the current version for signing. Reload and review the latest agreement.",
  ) {
    super(AGREEMENT_ERROR_CODES.updated, message, 409);
  }
}

export class AgreementCompletedError extends PlatformError {
  constructor(
    message = "This agreement version has already been completed.",
  ) {
    super(AGREEMENT_ERROR_CODES.completed, message, 409);
  }
}

export const PROPOSAL_RESPONSE_ERROR_CODES = {
  /** The submitted version number is no longer the current published version. */
  updated: "proposal_updated",
  /** The version already carries an acceptance — terminal for every action. */
  versionAccepted: "proposal_version_accepted",
  /** Changes were requested against this version, so it can no longer be accepted. */
  notAcceptable: "proposal_not_acceptable",
} as const;

/** The submitted version number is no longer the current published version. */
export class ProposalUpdatedError extends PlatformError {
  constructor(
    message = "This proposal has been updated. Review the latest version, then respond again.",
  ) {
    super(PROPOSAL_RESPONSE_ERROR_CODES.updated, message, 409);
  }
}

/** The version already carries an acceptance — terminal for every action. */
export class ProposalVersionAcceptedError extends PlatformError {
  constructor(
    message = "This proposal version has already been accepted, so no further response can be recorded against it.",
  ) {
    super(PROPOSAL_RESPONSE_ERROR_CODES.versionAccepted, message, 409);
  }
}

/** Changes were requested against this version, so it can no longer be accepted. */
export class ProposalNotAcceptableError extends PlatformError {
  constructor(
    message = "This proposal version can no longer be accepted because changes were requested against it.",
  ) {
    super(PROPOSAL_RESPONSE_ERROR_CODES.notAcceptable, message, 409);
  }
}