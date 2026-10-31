/**
 * Post-sign-in destination through the complete passwordless flow.
 *
 * A customer who asks for a protected page is sent to sign-in with the
 * destination encoded in the URL; the sign-in form carries it forward; the
 * emailed one-time link must carry it alongside the token; and verification
 * must land the customer on it — signed in, still on this site.
 *
 * The bug these tests pin: the destination used to stop at the form, because
 * the URL builder never received it, so verification silently fell back to the
 * dashboard and the customer lost their place.
 *
 * Everything runs through the real route handlers and the real authentication
 * service — real store, real hashing, real email sink — with only Next's
 * ambient request state supplied by the harness, because it exists solely
 * inside a running server. The service, not the route, is what sanitises the
 * destination before it can enter the emailed link, so both the form post and
 * a forged verify URL are exercised as attack surfaces.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OTHER_EMAIL,
  OWNER_EMAIL,
  createTestPlatform,
  type TestPlatform,
} from "./support/harness";
import {
  installTestPlatform,
  loadRouteHandler,
  setRouteHeaders,
  takeRecordedCookies,
} from "./support/route-harness";

/** The fixed allow-list the harness configures. */
const SELF_ORIGIN = "https://portal.synthetic.example";
const SIGN_IN_URL = `${SELF_ORIGIN}/sign-in`;
const VERIFY_BASE = `${SELF_ORIGIN}/api/auth/verify`;

interface RequestLinkRoute {
  POST(request: Request): Promise<Response>;
}

interface VerifyRoute {
  GET(request: Request): Promise<Response>;
}

// Loading a route installs the harness seams (the `@/` alias resolver and the
// next/headers stubs) before anything else runs.
const requestLink = loadRouteHandler<RequestLinkRoute>("app/api/auth/request-link/route");
const verifyRoute = loadRouteHandler<VerifyRoute>("app/api/auth/verify/route");

// Required after `loadRouteHandler` so the resolver is in place for the
// adapter's compiled `@/` imports. `signInPath` is the function a protected
// page calls to send an unauthenticated visitor to sign-in — the hop where the
// destination is first minted.
const { signInPath } = require("../lib/platform/server") as typeof import("../lib/platform/server");

/** Asserts a redirect response and returns its Location as a URL. */
function assertRedirect(response: Response): URL {
  assert.ok(
    [301, 302, 303, 307, 308].includes(response.status),
    `expected a redirect, got ${response.status}`,
  );
  const location = response.headers.get("location");
  assert.ok(location, "a redirect must carry a Location header");
  return new URL(location);
}

/** POSTs the sign-in form through the real handler with explicit headers. */
async function postSignInForm(
  harness: TestPlatform,
  fields: Record<string, string>,
): Promise<Response> {
  setRouteHeaders({ host: "portal.synthetic.example", origin: SELF_ORIGIN });
  const request = new Request(SIGN_IN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
  const restore = installTestPlatform(harness.platform);
  try {
    return await requestLink.POST(request);
  } finally {
    restore();
  }
}

/**
 * Follows the emailed link through the real verify handler. No Origin header:
 * verification is a top-level navigation from the mail client, not a
 * state-changing cross-site post, so the same-origin guard does not apply here.
 */
async function followVerify(harness: TestPlatform, url: string): Promise<Response> {
  setRouteHeaders({ host: "portal.synthetic.example" });
  const restore = installTestPlatform(harness.platform);
  try {
    return await verifyRoute.GET(new Request(url));
  } finally {
    restore();
  }
}

/** The one-time link the platform actually emailed, as a URL. */
function emailedLink(harness: TestPlatform, to = OWNER_EMAIL): URL {
  const message = harness.email.lastMessageTo(to);
  assert.ok(message, `a sign-in link must have been emailed to ${to}`);
  return new URL(message.signInUrl, SELF_ORIGIN);
}

describe("post-sign-in destination", () => {
  it("carries a protected-page destination through the complete magic-link flow", async () => {
    const harness = await createTestPlatform();
    const destination = "/dashboard/projects/PROJ-1001/intake";

    // Hop 1 — the protected page sends the visitor to sign-in, remembering
    // where they were going.
    const signIn = new URL(signInPath(destination), SELF_ORIGIN);
    assert.equal(signIn.pathname, "/sign-in");
    const formDestination = signIn.searchParams.get("returnTo");
    assert.ok(formDestination, "the sign-in redirect must carry the destination");

    // Hop 2 — the sign-in page renders it as the form's hidden field, so the
    // form post returns to sign-in still remembering it.
    const landing = assertRedirect(
      await postSignInForm(harness, {
        email: OWNER_EMAIL,
        returnTo: formDestination,
      }),
    );
    assert.equal(landing.pathname, "/sign-in");
    assert.equal(landing.searchParams.get("returnTo"), destination);
    assert.equal(landing.searchParams.get("sent"), "link-sent");

    // Hop 3 — the emailed one-time link carries it alongside the token.
    const link = emailedLink(harness);
    assert.equal(link.pathname, "/api/auth/verify");
    assert.ok(link.searchParams.get("token"), "the link must carry its one-time token");
    assert.equal(link.searchParams.get("returnTo"), destination);

    // Hop 4 — verification consumes the token and lands the customer on the
    // destination, signed in. Neither credential nor destination rides along.
    takeRecordedCookies(); // start from a clean cookie recording
    const arrival = assertRedirect(await followVerify(harness, link.href));
    assert.equal(arrival.href, new URL(destination, SELF_ORIGIN).href);
    assert.equal(arrival.searchParams.get("token"), null, "the token must not ride along");
    assert.equal(arrival.searchParams.get("returnTo"), null, "the destination is consumed, not re-sent");

    const issued = takeRecordedCookies();
    assert.equal(issued.length, 1, "the session cookie must be issued");
    assert.equal(issued[0]!.name, harness.platform.sessions.cookie.name);
  });

  it("restores a project-specific path", async () => {
    const harness = await createTestPlatform();
    const destination = "/dashboard/projects/WEB.2026-014/agreement";

    await postSignInForm(harness, { email: OWNER_EMAIL, returnTo: destination });

    const link = emailedLink(harness);
    assert.equal(link.searchParams.get("returnTo"), destination, "the path must reach the link intact");

    const arrival = assertRedirect(await followVerify(harness, link.href));
    assert.equal(arrival.pathname, destination);
  });

  it("preserves supported query parameters on the destination", async () => {
    const harness = await createTestPlatform();
    const destination = "/dashboard/projects/PROJ-1001/proposal?tab=scope&revision=2";

    await postSignInForm(harness, { email: OWNER_EMAIL, returnTo: destination });

    const link = emailedLink(harness);
    assert.equal(
      link.searchParams.get("returnTo"),
      destination,
      "the whole destination must round-trip through the link",
    );

    const arrival = assertRedirect(await followVerify(harness, link.href));
    assert.equal(arrival.pathname, "/dashboard/projects/PROJ-1001/proposal");
    assert.equal(arrival.search, "?tab=scope&revision=2");
  });

  it("falls back to the dashboard when no destination was requested", async () => {
    const harness = await createTestPlatform();

    const landing = assertRedirect(await postSignInForm(harness, { email: OWNER_EMAIL }));
    assert.equal(landing.pathname, "/sign-in");
    assert.equal(landing.searchParams.get("returnTo"), null, "there is no destination to remember");
    assert.equal(landing.searchParams.get("sent"), "link-sent");

    const link = emailedLink(harness);
    assert.equal(link.searchParams.get("returnTo"), null);

    const arrival = assertRedirect(await followVerify(harness, link.href));
    assert.equal(`${arrival.pathname}${arrival.search}`, "/dashboard");
  });

  it("never puts an external or protocol-relative target in front of the customer", async () => {
    const harness = await createTestPlatform();

    for (const hostile of [
      "https://attacker.example/steal",
      "//attacker.example",
      "/\\attacker.example",
      "javascript:alert(1)",
    ]) {
      const landing = assertRedirect(
        await postSignInForm(harness, { email: OWNER_EMAIL, returnTo: hostile }),
      );
      assert.equal(landing.pathname, "/sign-in", `hostile value must be discarded: ${hostile}`);
      assert.equal(
        landing.searchParams.get("returnTo"),
        null,
        `a hostile value must not survive the redirect: ${hostile}`,
      );
      assert.equal(
        landing.searchParams.get("sent"),
        "link-sent",
        "the request itself is still honoured — this must not depend on the destination",
      );

      const link = emailedLink(harness);
      assert.equal(
        link.searchParams.get("returnTo"),
        null,
        `a hostile value must never enter the emailed link: ${hostile}`,
      );
    }

    // The link issued for the last hostile value still verifies — into the
    // dashboard, never the attacker's site.
    const arrival = assertRedirect(await followVerify(harness, emailedLink(harness).href));
    assert.equal(`${arrival.pathname}${arrival.search}`, "/dashboard");
    assert.equal(arrival.origin, SELF_ORIGIN);
  });

  it("keeps a tampered verify URL from creating an external redirect", async () => {
    const harness = await createTestPlatform();

    for (const hostile of [
      "https://attacker.example/collect",
      "//attacker.example",
      "/\\attacker.example",
      "%2F%2Fattacker.example",
      "/dashboard\\..\\..",
    ]) {
      // A genuine, unused one-time token — only the destination is forged, the
      // way a crafted URL around a real link would do it.
      await postSignInForm(harness, { email: OWNER_EMAIL, returnTo: "/dashboard" });
      const token = emailedLink(harness).searchParams.get("token");
      assert.ok(token, "the sign-in link must carry its token");

      const crafted = `${VERIFY_BASE}?token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(hostile)}`;
      const arrival = assertRedirect(await followVerify(harness, crafted));
      assert.equal(arrival.origin, SELF_ORIGIN, `must stay on-site for: ${hostile}`);
      assert.equal(
        `${arrival.pathname}${arrival.search}`,
        "/dashboard",
        `a forged destination must fall back for: ${hostile}`,
      );
    }
  });

  it("keeps the one-time token and session behaviour intact with a destination in play", async () => {
    const harness = await createTestPlatform();
    const destination = "/dashboard/projects/PROJ-1001/agreement";

    await postSignInForm(harness, { email: OWNER_EMAIL, returnTo: destination });
    const link = emailedLink(harness);

    takeRecordedCookies(); // start from a clean cookie recording
    const first = assertRedirect(await followVerify(harness, link.href));
    assert.equal(first.pathname, destination, "the first use lands on the destination");
    const issued = takeRecordedCookies();
    assert.equal(issued.length, 1, "verification issues exactly one session cookie");

    // The same link again: the challenge was consumed, so it must not sign
    // anybody in a second time — destination or no destination.
    const replay = assertRedirect(await followVerify(harness, link.href));
    assert.equal(`${replay.pathname}${replay.search}`, "/sign-in?error=invalid-link");
    assert.equal(takeRecordedCookies().length, 0, "a consumed link issues no session");
  });

  it("answers a known and an unknown address identically with a destination in play", async () => {
    const harness = await createTestPlatform();
    const destination = "/dashboard/projects/PROJ-1001/intake";

    const known = await postSignInForm(harness, {
      email: OWNER_EMAIL,
      returnTo: destination,
    });
    const unknown = await postSignInForm(harness, {
      email: OTHER_EMAIL,
      returnTo: destination,
    });

    assert.equal(known.status, unknown.status);
    assert.equal(
      known.headers.get("location"),
      unknown.headers.get("location"),
      "the response must not reveal whether the address exists",
    );
    assert.equal(harness.email.messageCount, 2, "both addresses are handled the same way");
  });

  it("keeps the sign-in and verification rate limits unchanged with a destination in play", async () => {
    const signInHarness = await createTestPlatform({
      config: {
        signInLimits: {
          perAddress: { limit: 1, windowMs: 60_000 },
          perClient: { limit: 100, windowMs: 60_000 },
        },
      },
    });
    const destination = "/dashboard/projects/PROJ-1001/intake";

    const first = assertRedirect(
      await postSignInForm(signInHarness, { email: OWNER_EMAIL, returnTo: destination }),
    );
    assert.equal(first.searchParams.get("sent"), "link-sent");
    assert.equal(first.searchParams.get("returnTo"), destination);

    const second = assertRedirect(
      await postSignInForm(signInHarness, { email: OWNER_EMAIL, returnTo: destination }),
    );
    assert.equal(second.searchParams.get("error"), "sign-in-rate-limited");
    assert.equal(
      second.searchParams.get("returnTo"),
      destination,
      "the notice redirect still carries the destination",
    );
    assert.equal(signInHarness.email.messageCount, 1, "a limited request sends no mail");

    // Verification attempts against one link stay capped too.
    const verifyHarness = await createTestPlatform({
      config: {
        verifyLimits: {
          perClient: { limit: 30, windowMs: 60_000 },
          perLink: { limit: 2, windowMs: 60_000 },
        },
      },
    });
    await postSignInForm(verifyHarness, { email: OWNER_EMAIL, returnTo: destination });
    const link = emailedLink(verifyHarness);

    const consumed = assertRedirect(await followVerify(verifyHarness, link.href));
    assert.equal(consumed.pathname, destination, "the first attempt is admitted");

    const replayed = assertRedirect(await followVerify(verifyHarness, link.href));
    assert.equal(
      `${replayed.pathname}${replayed.search}`,
      "/sign-in?error=invalid-link",
      "the second is refused as consumed",
    );

    const rateLimited = assertRedirect(await followVerify(verifyHarness, link.href));
    assert.equal(
      `${rateLimited.pathname}${rateLimited.search}`,
      "/sign-in?error=link-rate-limited",
      "the third hits the link's attempt cap",
    );
  });
});
