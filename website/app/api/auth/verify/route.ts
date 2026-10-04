/**
 * GET /api/auth/verify?token=...
 *
 * Consumes a one-time sign-in link and establishes the session.
 *
 * The token is consumed here and nowhere else; it is never forwarded to the
 * dashboard in a cookie, so a usable authentication secret does not travel with
 * the browser after this response. The response rotates to a fresh session and
 * redirects on to the customer dashboard, which sends a person without an
 * organization to organization creation.
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

  // The destination is restricted to a same-site path, so this redirect cannot
  // send a freshly authenticated customer to another origin.
  const destination = sanitizeReturnTo(url.searchParams.get("returnTo")) ?? "/dashboard";
  return redirectWith(request, destination, {});
}