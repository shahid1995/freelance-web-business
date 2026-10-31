/**
 * GET /api/auth/verify?token=...
 *
 * Consumes a one-time sign-in link and establishes the session.
 *
 * The token is consumed here and nowhere else; it is never forwarded to the
 * dashboard in a cookie, so a usable authentication secret does not travel with
 * the browser after this response. The response rotates to a fresh session and
 * redirects on to the destination the customer originally asked for — carried
 * through the emailed link as `returnTo` — falling back to the customer
 * dashboard when there was none, which sends a person without an organization
 * to organization creation.
 *
 * Unknown, expired, replayed, and rate-limited links all land on the sign-in
 * page with a code, and the codes do not distinguish between those cases beyond
 * what the customer needs to know. The destination survives that refusal too —
 * re-sanitised, never the token — so the replacement link requested from the
 * sign-in page still knows where the customer was originally going.
 */

import { PLATFORM_ERROR_CODES, isPlatformError } from "@/lib/platform/errors";
import { getPlatform } from "@/lib/platform/container";
import { currentRequestContext, issueSessionCookie, redirectWith } from "@/lib/platform/server";
import { sanitizeReturnTo } from "@/lib/platform/http";

/**
 * Refuses a failed verification back to the sign-in page, keeping the
 * destination the customer originally asked for.
 *
 * The destination arrives on a URL anyone can edit, so it is sanitised here
 * rather than trusted: an absent or rejected value is dropped from the
 * redirect entirely instead of passed on. Only the notice code and the
 * destination travel — never the token.
 */
function redirectAfterFailedVerification(request: Request, url: URL, code: string) {
  const params: Record<string, string> = { error: code };
  const destination = sanitizeReturnTo(url.searchParams.get("returnTo"));
  if (destination !== null) {
    params.returnTo = destination;
  }
  return redirectWith(request, "/sign-in", params);
}

export async function GET(request: Request) {
  const platform = await getPlatform();
  const context = await currentRequestContext("GET", platform.config.trustedProxyHops);
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  let sessionId: string;
  try {
    const verified = platform.auth.verifySignInLink({
      token,
      clientKey: context.clientKey,
    });
    sessionId = verified.sessionId;
  } catch (error) {
    if (isPlatformError(error, PLATFORM_ERROR_CODES.invalidSignInLink)) {
      return redirectAfterFailedVerification(request, url, "invalid-link");
    }
    if (isPlatformError(error, PLATFORM_ERROR_CODES.rateLimited)) {
      return redirectAfterFailedVerification(request, url, "link-rate-limited");
    }
    throw error;
  }

  await issueSessionCookie(platform, sessionId);

  // The destination arrived on the link the platform itself sent and is
  // restricted to a same-site path again here, so a tampered `returnTo` — on a
  // crafted URL around a real token, or one edited in transit — cannot send a
  // freshly authenticated customer to another origin.
  const destination = sanitizeReturnTo(url.searchParams.get("returnTo")) ?? "/dashboard";
  return redirectWith(request, destination, {});
}