/**
 * Request security guard.
 *
 * One entry point that every protected request passes through, so "the route
 * forgot to check" is not a class of bug this codebase can have. It is a pure
 * function of an explicit request context rather than reading Next's ambient
 * headers, which keeps the security decision testable without a server.
 *
 * Route handlers build the context from the incoming request; nothing in this
 * module can be bypassed by omitting a check, because the guard raises instead of
 * returning a "not allowed" value.
 */

import type { Session } from "./domain";
import { OriginRejectedError } from "./errors";
import type { PlatformConfig } from "./config";
import { parseSessionCookie, type SessionCookieSettings } from "./sessions";

export interface RequestSecurityContext {
  method: string;
  /** Origin header, or null when the client sent none. */
  origin: string | null;
  /** The origin this server answers on, computed by the route from the request. */
  selfOrigin: string | null;
  /** Rate-limiting identity, derived under the configured proxy-trust policy. */
  clientKey: string;
  /** Raw Cookie header. */
  cookieHeader: string | null;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Origin check for state-changing requests.
 *
 * A request with no Origin is rejected rather than exempted. Browsers send
 * Origin on every cross-origin request and on same-origin POST requests, so this
 * rejects cross-site writes without depending on the client cooperating. Read
 * requests are exempt because they change nothing.
 */
export function assertSameOrigin(
  context: RequestSecurityContext,
  config: PlatformConfig,
): void {
  const method = context.method.toUpperCase();
  if (SAFE_METHODS.has(method)) {
    return;
  }
  const origin = context.origin;
  if (!origin) {
    throw new OriginRejectedError();
  }
  // When an explicit allow-list is configured it is the whole decision. Only
  // when nothing is configured does the guard fall back to the server's own
  // origin, which is derived from the request and is therefore only as
  // trustworthy as the Host header the deployment preserves.
  const allowed =
    config.allowedOrigins.length > 0
      ? new Set(config.allowedOrigins)
      : new Set(context.selfOrigin ? [context.selfOrigin] : []);
  if (!allowed.has(origin)) {
    throw new OriginRejectedError();
  }
}

export interface ProtectedRequest {
  session: Session;
  personId: string;
  sessionToken: string;
}

/**
 * Requires both an acceptable origin and a live session.
 *
 * Raises rather than returning a nullable result, so a caller cannot continue
 * with a missing session by forgetting to check.
 */
export function requireProtectedRequest(
  context: RequestSecurityContext,
  services: {
    config: PlatformConfig;
    sessions: {
      cookie: SessionCookieSettings;
      requireSession(rawSessionId: string | null): Session;
    };
  },
): ProtectedRequest {
  assertSameOrigin(context, services.config);
  const sessionToken = parseSessionCookie(services.sessions.cookie, context.cookieHeader);
  const session = services.sessions.requireSession(sessionToken);
  return { session, personId: session.personId, sessionToken: sessionToken ?? "" };
}

/**
 * Rate-limit identity used when the deployment has not declared a trusted proxy.
 *
 * Every caller shares one bucket. That is deliberately conservative: it means a
 * caller cannot mint a fresh limit by changing a header, at the cost of unrelated
 * callers sharing a budget until a real client identity is configured.
 */
export const SHARED_CLIENT_KEY = "shared";

/**
 * Client identity for rate limiting, under an explicit proxy-trust policy.
 *
 * `X-Forwarded-For` is caller-controlled unless something in front of this
 * process rewrites it, so trusting it by default would let anyone defeat a limit
 * by sending a different header — including the very attempts the limit exists to
 * stop. Trusting it at all is therefore an explicit deployment decision
 * (`trustedProxyHops`), and it defaults to not trusting it.
 *
 * When hops are declared, the address is read **counting from the right**. A
 * trusted proxy appends the address it observed, so anything a caller prepends
 * sits to the left of the entries that were actually observed and is never read.
 * With `trustedProxyHops: 1` behind a single proxy, the header `spoofed, real` is
 * read as `real`.
 *
 * With no configured hops, or a header shorter than the declared hop count, the
 * shared key is returned so the result is always a value the caller could not have
 * chosen.
 */
export function clientKeyFromHeaders(
  headers: { get(name: string): string | null },
  trustedProxyHops = 0,
): string {
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1) {
    return SHARED_CLIENT_KEY;
  }
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) {
    return SHARED_CLIENT_KEY;
  }
  const hops = forwarded
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const index = hops.length - trustedProxyHops;
  if (index < 0) {
    // Fewer entries than declared hops: the chain does not match the deployment
    // this policy was written for, so do not guess.
    return SHARED_CLIENT_KEY;
  }
  return hops[index] as string;
}

/** Characters permitted in a same-site path. No scheme, host, or backslash. */
const SAME_SITE_PATH = /^\/[A-Za-z0-9\-._~%/?&=#!$'()*,;:@]*$/;

/**
 * Accepts only a same-site path as a post-sign-in destination.
 *
 * Anything with a scheme, a protocol-relative prefix, a backslash, or a character
 * outside the path set is discarded, so this parameter cannot be used to bounce a
 * customer off-site after they authenticate.
 */
export function sanitizeReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//")) return null;
  if (candidate.includes("\\")) return null;
  if (!SAME_SITE_PATH.test(candidate)) return null;
  return candidate;
}