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
 * what the customer needs to know.
 */

import { PLATFORM_ERROR_CODES, isPlatformError } from "@/lib/platform/errors";
import { getPlatform } from "@/lib/platform/container";
import { currentRequestContext, issueSessionCookie, redirectWith } from "@/lib/platform/server";
import { sanitizeReturnTo } from "@/lib/platform/http";

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
      return redirectWith(request, "/sign-in", { error: "invalid-link" });
    }
    if (isPlatformError(error, PLATFORM_ERROR_CODES.rateLimited)) {
      return redirectWith(request, "/sign-in", { error: "link-rate-limited" });
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