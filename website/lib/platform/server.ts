/**
 * Next.js server adapter.
 *
 * The thin layer between the framework and the platform core. It reads the
 * incoming request's headers, hands them to the pure security guard, and turns a
 * service failure into a redirect. It contains no authorization logic of its own —
 * every decision still comes from `http.ts` and the services — so the tested
 * guard is the guard that runs in production.
 *
 * Errors are matched on their stable code rather than by class. Next compiles
 * each route into its own bundle, so `instanceof` against an error class can be
 * false for an error raised inside another bundle, which would turn an expected
 * redirect into a 500.
 */

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import {
  PLATFORM_ERROR_CODES,
  isPlatformError,
  type PlatformError,
} from "@/lib/platform/errors";
import {
  clientKeyFromHeaders,
  requireProtectedRequest,
  sanitizeReturnTo,
} from "@/lib/platform/http";
import type { ProtectedRequest, RequestSecurityContext } from "@/lib/platform/http";
import { getPlatform, type Platform } from "@/lib/platform/container";
import {
  clearedSessionCookieOptions,
  sessionCookieOptions,
} from "@/lib/platform/sessions";

/** Where an unauthenticated visitor is sent, remembering where they were going. */
export function signInPath(returnTo?: string | null): string {
  const destination = sanitizeReturnTo(returnTo);
  if (!destination) return "/sign-in";
  return `/sign-in?returnTo=${encodeURIComponent(destination)}`;
}

/**
 * Builds the request context the security guard needs.
 *
 * `method` is passed in because server components do not see the HTTP method;
 * pages are reads and pass "GET", route handlers pass the real method.
 */
export async function currentRequestContext(
  method: string,
): Promise<RequestSecurityContext> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProto ?? (process.env.NODE_ENV === "production" ? "https" : "http");

  return {
    method,
    origin: requestHeaders.get("origin"),
    selfOrigin: host ? `${protocol}://${host}` : null,
    clientKey: clientKeyFromHeaders(requestHeaders),
    cookieHeader: requestHeaders.get("cookie"),
  };
}

export interface ProtectedServerRequest {
  platform: Platform;
  personId: string;
}

/**
 * Resolves a session and, on failure, decides where to send the caller.
 *
 * The guard runs inside a try, and `redirect()` is called outside it: a redirect
 * is a thrown control-flow signal, and calling one from inside a catch that is
 * itself inside the caller's render path makes the outcome depend on which layer
 * catches it first.
 */
function resolveProtectedRequest(
  context: RequestSecurityContext,
  platform: Platform,
  returnTo: string,
): ProtectedRequest {
  let resolved: ProtectedRequest | null = null;
  let failure: unknown = null;

  try {
    resolved = requireProtectedRequest(context, platform);
  } catch (error) {
    failure = error;
  }

  if (resolved) return resolved;

  if (isPlatformError(failure, PLATFORM_ERROR_CODES.unauthenticated)) {
    redirect(signInPath(returnTo));
  }
  if (isPlatformError(failure, PLATFORM_ERROR_CODES.originRejected)) {
    redirect(`${returnTo}?error=origin-denied`);
  }
  throw failure;
}

/**
 * Resolves an authenticated session for a page. Redirects to sign-in when there
 * is none, preserving the path the visitor was trying to reach.
 */
export async function requireSessionForPage(
  returnTo: string,
): Promise<ProtectedServerRequest> {
  const platform = await getPlatform();
  const context = await currentRequestContext("GET");
  const protectedRequest = resolveProtectedRequest(context, platform, returnTo);
  return { platform, personId: protectedRequest.personId };
}

/**
 * Resolves an authenticated session for a state-changing request.
 *
 * Runs the origin check and the session check in that order, so a cross-origin
 * write is refused before the session is even looked up.
 */
export async function requireSessionForAction(
  method: string,
  returnTo: string,
): Promise<ProtectedServerRequest> {
  const platform = await getPlatform();
  const context = await currentRequestContext(method);
  const protectedRequest = resolveProtectedRequest(context, platform, returnTo);
  return { platform, personId: protectedRequest.personId };
}

/**
 * Maps a service failure to a safe redirect.
 *
 * Only a short code travels in the URL; `notices.ts` turns it into approved
 * wording. No service message, token, or internal state is ever passed through a
 * redirect. Unexpected errors are re-thrown rather than shown.
 */
export function redirectAfterError(
  error: unknown,
  returnTo: string,
  code: string,
): never {
  if (isPlatformError(error, PLATFORM_ERROR_CODES.rateLimited)) {
    redirect(`${returnTo}?error=${code}-rate-limited`);
  }
  if (isPlatformError(error)) {
    redirect(`${returnTo}?error=${code}-denied`);
  }
  throw error;
}

/** True when a service failure is one the caller should render as "not found". */
export function isMissing(error: unknown): boolean {
  return (
    isPlatformError(error, PLATFORM_ERROR_CODES.notFound) ||
    isPlatformError(error, PLATFORM_ERROR_CODES.forbidden)
  );
}

/** Builds a redirect back to `path` with query parameters, without string surgery. */
export function redirectWith(
  request: Request,
  path: string,
  params: Record<string, string>,
): NextResponse {
  const url = new URL(path, request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

/**
 * Sets the session cookie from the raw session value, using the platform's own
 * cookie settings rather than restating them here — so the attributes that are
 * tested in `sessions.ts` are the ones actually issued.
 */
export async function issueSessionCookie(
  platform: Platform,
  rawSessionId: string,
): Promise<void> {
  const store = await cookies();
  const settings = platform.sessions.cookie;
  store.set(settings.name, rawSessionId, sessionCookieOptions(settings));
}

/**
 * Clears the session cookie. The attributes come from the same helper as issuing,
 * with only the lifetime changed — a clear cookie whose attributes differ does not
 * clear the cookie.
 */
export async function clearSessionCookie(platform: Platform): Promise<void> {
  const store = await cookies();
  const settings = platform.sessions.cookie;
  store.set(settings.name, "", clearedSessionCookieOptions(settings));
}

export type { PlatformError };