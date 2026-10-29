/**
 * POST /api/auth/request-link
 *
 * Issues a one-time sign-in link.
 *
 * The redirect after a successful request is the same for every address, so the
 * response cannot be used to learn whether an account exists. A rate-limited or
 * malformed request also redirects to the same page; only the notice code differs,
 * and none of those codes depend on account existence.
 *
 * Like every state-changing route this one carries the same-origin guard. The
 * guard runs before the body is read, so a cross-site post cannot open a
 * challenge, spend the address's rate-limit budget, or make the platform send
 * mail — the side effects the endpoint exists to perform.
 */
// The origin is read from the request rather than trusted from the form, so a
// cross-site page cannot trigger sign-in email for an address it chose.

import { PLATFORM_ERROR_CODES, isPlatformError } from "@/lib/platform/errors";
import { assertSameOrigin } from "@/lib/platform/http";
import { getPlatform } from "@/lib/platform/container";
import { currentRequestContext, redirectWith, signInPath } from "@/lib/platform/server";

export async function POST(request: Request) {
  const platform = await getPlatform();
  const context = await currentRequestContext("POST", platform.config.trustedProxyHops);

  try {
    assertSameOrigin(context, platform.config);
  } catch (error) {
    if (isPlatformError(error, PLATFORM_ERROR_CODES.originRejected)) {
      // The body is deliberately unread at this point, so a rejected request
      // carries no returnTo. It lands on the plain sign-in page with the same
      // approved notice code sign-out uses, and reveals nothing about the
      // submitted address.
      return redirectWith(request, "/sign-in", { error: "origin-denied" });
    }
    throw error;
  }

  const form = await request.formData();
  const email = form.get("email");
  const rawReturnTo = form.get("returnTo");
  const returnTo = signInPath(
    typeof rawReturnTo === "string" ? rawReturnTo : undefined,
  );

  try {
    await platform.auth.requestSignInLink({
      email: typeof email === "string" ? email : "",
      clientKey: context.clientKey,
    });
  } catch (error) {
    if (isPlatformError(error, PLATFORM_ERROR_CODES.invalidInput)) {
      return redirectWith(request, returnTo, { error: "invalid-email" });
    }
    if (isPlatformError(error, PLATFORM_ERROR_CODES.rateLimited)) {
      return redirectWith(request, returnTo, { error: "sign-in-rate-limited" });
    }
    throw error;
  }

  return redirectWith(request, returnTo, { sent: "link-sent" });
}