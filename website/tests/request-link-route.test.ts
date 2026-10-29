/**
 * POST /api/auth/request-link — the route-level origin guard.
 *
 * These tests invoke the real route handler: the same-origin guard, its
 * ordering ahead of the untrusted body, the real sign-in service, the real
 * store, and the real email sink. Only Next's ambient request headers are
 * supplied by the harness, because they exist only inside a running server.
 *
 * The security contract under test: a rejected request must not reach
 * `platform.auth.requestSignInLink()` — no challenge, no mail, no rate-limit
 * charge — and must reveal nothing about the submitted address.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Platform } from "../lib/platform/container";
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
} from "./support/route-harness";

/** The fixed allow-list the harness configures. */
const SELF_ORIGIN = "https://portal.synthetic.example";
const SIGN_IN_URL = `${SELF_ORIGIN}/sign-in`;

interface RequestLinkRoute {
  POST(request: Request): Promise<Response>;
}

const route = loadRouteHandler<RequestLinkRoute>("app/api/auth/request-link/route");

type SignInLinkInput = Parameters<Platform["auth"]["requestSignInLink"]>[0];
type ChallengeInput = Parameters<Platform["store"]["createChallenge"]>[0];

/** Records every call to the sign-in service without preventing it. */
function watchSignInLink(platform: Platform): SignInLinkInput[] {
  const calls: SignInLinkInput[] = [];
  const original = platform.auth.requestSignInLink.bind(platform.auth);
  platform.auth.requestSignInLink = (input) => {
    calls.push(input);
    return original(input);
  };
  return calls;
}

/** Records every challenge written to the store. */
function watchChallenges(platform: Platform): ChallengeInput[] {
  const created: ChallengeInput[] = [];
  const original = platform.store.createChallenge.bind(platform.store);
  platform.store.createChallenge = (challenge) => {
    created.push(challenge);
    original(challenge);
  };
  return created;
}

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

interface PostInit {
  fields?: Record<string, string>;
  /** `null` omits the Origin header entirely. Defaults to the own origin. */
  origin?: string | null;
  /** Raw body, bypassing `fields`. */
  body?: string;
  contentType?: string;
}

/** Invokes the real route handler with explicit ambient headers. */
async function post(harness: TestPlatform, init: PostInit = {}): Promise<Response> {
  const origin = init.origin === undefined ? SELF_ORIGIN : init.origin;
  setRouteHeaders(
    origin === null
      ? { host: "portal.synthetic.example" }
      : { host: "portal.synthetic.example", origin },
  );

  const request = new Request(SIGN_IN_URL, {
    method: "POST",
    headers: {
      "content-type": init.contentType ?? "application/x-www-form-urlencoded",
    },
    body: init.body ?? new URLSearchParams(init.fields ?? {}).toString(),
  });

  const restore = installTestPlatform(harness.platform);
  try {
    return await route.POST(request);
  } finally {
    restore();
  }
}

describe("POST /api/auth/request-link origin guard", () => {
  it("continues the sign-in flow for a valid same-origin request", async () => {
    const harness = await createTestPlatform();
    const signInCalls = watchSignInLink(harness.platform);

    const response = await post(harness, {
      fields: { email: OWNER_EMAIL, returnTo: "/dashboard" },
    });

    const location = assertRedirect(response);
    assert.equal(location.pathname, "/sign-in");
    assert.equal(location.searchParams.get("sent"), "link-sent");
    assert.equal(location.searchParams.get("returnTo"), "/dashboard");
    assert.equal(signInCalls.length, 1, "the sign-in service must be invoked");
    assert.equal(signInCalls[0]!.email, OWNER_EMAIL);
    assert.equal(harness.email.messageCount, 1, "the link must be delivered");
    assert.ok(harness.email.lastMessageTo(OWNER_EMAIL));
  });

  it("rejects a cross-origin request before the sign-in service is called", async () => {
    const harness = await createTestPlatform();
    const signInCalls = watchSignInLink(harness.platform);

    const response = await post(harness, {
      fields: { email: OWNER_EMAIL },
      origin: "https://attacker.example",
    });

    const location = assertRedirect(response);
    assert.equal(`${location.pathname}${location.search}`, "/sign-in?error=origin-denied");
    assert.equal(signInCalls.length, 0, "the sign-in service must not be invoked");
    assert.equal(harness.email.messageCount, 0, "no mail may be sent");
    assert.ok(
      !location.href.includes("@"),
      "the rejected response must not echo the submitted address",
    );
  });

  it("rejects a request with no Origin header", async () => {
    const harness = await createTestPlatform();
    const signInCalls = watchSignInLink(harness.platform);

    const response = await post(harness, {
      fields: { email: OWNER_EMAIL },
      origin: null,
    });

    const location = assertRedirect(response);
    assert.equal(`${location.pathname}${location.search}`, "/sign-in?error=origin-denied");
    assert.equal(signInCalls.length, 0, "the sign-in service must not be invoked");
    assert.equal(harness.email.messageCount, 0, "no mail may be sent");
  });

  it("checks the origin before the untrusted body is parsed", async () => {
    const harness = await createTestPlatform();
    const signInCalls = watchSignInLink(harness.platform);

    // This body is not a parseable form: `formData()` would throw a TypeError
    // against the missing multipart boundary. The clean origin-denied redirect
    // proves the guard ran first; if the body were read first, this test would
    // fail with an exception instead of a redirect.
    const response = await post(harness, {
      origin: "https://attacker.example",
      body: "not-a-multipart-body",
      contentType: "multipart/form-data",
    });

    const location = assertRedirect(response);
    assert.equal(`${location.pathname}${location.search}`, "/sign-in?error=origin-denied");
    assert.equal(signInCalls.length, 0);
    assert.equal(harness.email.messageCount, 0);
  });

  it("leaves the address rate-limit budget untouched when requests are rejected", async () => {
    const harness = await createTestPlatform({
      config: {
        signInLimits: {
          perAddress: { limit: 1, windowMs: 60_000 },
          perClient: { limit: 100, windowMs: 60_000 },
        },
      },
    });

    for (const origin of ["https://attacker.example", null, "https://other.example"]) {
      const rejected = await post(harness, {
        fields: { email: OWNER_EMAIL },
        origin,
      });
      const location = assertRedirect(rejected);
      assert.equal(location.searchParams.get("error"), "origin-denied");
    }

    // The address's single permitted attempt is still available: rejected
    // requests never charged it.
    const accepted = await post(harness, { fields: { email: OWNER_EMAIL } });
    const location = assertRedirect(accepted);
    assert.equal(location.searchParams.get("sent"), "link-sent");
    assert.equal(harness.email.messageCount, 1, "only the accepted request sent mail");
  });

  it("creates no sign-in challenge for a rejected request", async () => {
    const harness = await createTestPlatform();
    const challenges = watchChallenges(harness.platform);

    await post(harness, { fields: { email: OWNER_EMAIL }, origin: "https://attacker.example" });
    await post(harness, { fields: { email: OWNER_EMAIL }, origin: null });

    assert.equal(challenges.length, 0, "a rejected request must not open a challenge");

    // Prove the watcher actually records: an accepted request creates exactly one.
    await post(harness, { fields: { email: OWNER_EMAIL } });
    assert.equal(challenges.length, 1);
  });

  it("answers a known and an unknown address identically", async () => {
    const harness = await createTestPlatform();

    const known = await post(harness, { fields: { email: OWNER_EMAIL } });
    const unknown = await post(harness, { fields: { email: OTHER_EMAIL } });

    assert.equal(known.status, unknown.status);
    assert.equal(
      known.headers.get("location"),
      unknown.headers.get("location"),
      "the response must not reveal whether the address exists",
    );
    assert.equal(harness.email.messageCount, 2, "an unknown address is still handled");
  });

  it("keeps the invalid-email redirect for accepted same-origin requests", async () => {
    const harness = await createTestPlatform();
    const signInCalls = watchSignInLink(harness.platform);

    const response = await post(harness, { fields: { email: "not-an-email" } });

    const location = assertRedirect(response);
    assert.equal(location.searchParams.get("error"), "invalid-email");
    assert.equal(signInCalls.length, 1, "validation happens in the service");
    assert.equal(harness.email.messageCount, 0);
  });

  it("keeps the rate-limited redirect for accepted same-origin requests", async () => {
    const harness = await createTestPlatform({
      config: {
        signInLimits: {
          perAddress: { limit: 1, windowMs: 60_000 },
          perClient: { limit: 100, windowMs: 60_000 },
        },
      },
    });

    const first = assertRedirect(await post(harness, { fields: { email: OWNER_EMAIL } }));
    assert.equal(first.searchParams.get("sent"), "link-sent");

    const second = assertRedirect(await post(harness, { fields: { email: OWNER_EMAIL } }));
    assert.equal(second.searchParams.get("error"), "sign-in-rate-limited");
    assert.equal(harness.email.messageCount, 1);
  });

  it("keeps sanitising returnTo for accepted same-origin requests", async () => {
    const harness = await createTestPlatform();

    const hostile = assertRedirect(
      await post(harness, {
        fields: { email: OWNER_EMAIL, returnTo: "https://attacker.example" },
      }),
    );
    assert.equal(hostile.pathname, "/sign-in");
    assert.equal(hostile.searchParams.get("returnTo"), null, "a hostile target is discarded");
    assert.equal(hostile.searchParams.get("sent"), "link-sent");
  });
});
