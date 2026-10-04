import type { Metadata } from "next";

import { PortalNotice } from "@/components/portal-notice";
import { noticeFor } from "@/lib/platform/notices";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Request a one-time sign-in link for your customer account.",
};

/**
 * Public sign-in page.
 *
 * Renders only a form. Whether an address has an account is not decided here and
 * is not reflected in the page: the response after submitting is the same either
 * way.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const notice = noticeFor(params);
  const returnTo = typeof params.returnTo === "string" ? params.returnTo : null;

  return (
    <section className="portal">
      <div className="container">
        <div className="portal__panel portal__panel--narrow portal__stack">
          <div>
            <p className="eyebrow">Customer access</p>
            <h1>Sign in</h1>
            <p className="lede">
              Enter the email address for your account. We will send a one-time
              link that signs you in. There is no password to remember.
            </p>
          </div>

          <PortalNotice notice={notice} />

          <form className="form-stack" method="post" action="/api/auth/request-link">
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
            <div className="field">
              <label className="field__label" htmlFor="email">
                Email address
              </label>
              <input
                className="input"
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                required
                autoFocus
              />
              <p className="field__hint">
                The link can be used once and expires shortly after it is sent.
              </p>
            </div>
            <div className="portal__actions">
              <button className="button" type="submit">
                Email me a sign-in link
              </button>
            </div>
          </form>

          <p className="portal__meta">
            No account yet? The same link creates your access the first time you
            use it.
          </p>
        </div>
      </div>
    </section>
  );
}