/**
 * POST /api/auth/request-link
 *
 * Issues a one-time sign-in link.
 *
 * The redirect after a successful request is the same for every address, so the
 * response cannot be used to learn whether an account exists. A rate-limited or
 * malformed request also redirects to the same page; only the notice code differs,
 * and none of those codes depend on account existence.
 */

import { PLATFORM_ERROR_CODES, isPlatformError } from "@/lib/platform/errors";
import { getPlatform } from "@/lib/platform/container";
import { currentRequestContext, redirectWith, signInPath } from "@/lib/platform/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = form.get("email");
  const rawReturnTo = form.get("returnTo");
  const returnTo = signInPath(
    typeof rawReturnTo === "string" ? rawReturnTo : undefined,
  );

  const platform = await getPlatform();
  const context = await currentRequestContext("POST", platform.config.trustedProxyHops);

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