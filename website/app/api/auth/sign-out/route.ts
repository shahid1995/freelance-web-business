/**
 * POST /api/auth/sign-out
 *
 * Revokes the session server-side and clears the cookie. Revocation is what makes
 * the change effective: even if the cookie value were captured, the stored session
 * is already marked revoked and no longer resolves.
 */
// The origin is read from the request rather than trusted from the form, so a
// cross-site page cannot end the customer's session.

import { PLATFORM_ERROR_CODES, isPlatformError } from "@/lib/platform/errors";
import { assertSameOrigin } from "@/lib/platform/http";
import { getPlatform } from "@/lib/platform/container";
import { clearSessionCookie, currentRequestContext, redirectWith } from "@/lib/platform/server";
import { parseSessionCookie } from "@/lib/platform/sessions";

export async function POST(request: Request) {
  const platform = await getPlatform();
  const context = await currentRequestContext("POST");

  // Sign-out changes server state, so it carries the same origin check as any
  // other mutation. It does not require a session: revoking nothing is valid.
  try {
    assertSameOrigin(context, platform.config);
  } catch (error) {
    if (isPlatformError(error, PLATFORM_ERROR_CODES.originRejected)) {
      return redirectWith(request, "/sign-in", { error: "origin-denied" });
    }
    throw error;
  }

  const sessionToken = parseSessionCookie(platform.sessions.cookie, context.cookieHeader);
  platform.sessions.revokeSession(sessionToken);
  await clearSessionCookie(platform);

  return redirectWith(request, "/", {});
}