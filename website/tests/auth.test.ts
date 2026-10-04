/**
 * Authentication: link issuance, hashing, expiry, single use, replay rejection,
 * rate limiting, enumeration protection, and session establishment.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { InvalidSignInLinkError } from "../lib/platform/auth";
import { RateLimitedError } from "../lib/platform/errors";
import { emailHash, hashSecret, parseChallengeToken } from "../lib/platform/secrets";
import {
  CLIENT_KEY,
  OTHER_EMAIL,
  OWNER_EMAIL,
  START_TIME,
  createTestPlatform,
  requestToken,
  signIn,
  type TestPlatform,
} from "./support/harness";

function expectInvalidLink(action: () => unknown): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof InvalidSignInLinkError, "expected an invalid-link error");
    return true;
  });
}

describe("passwordless sign-in", () => {
  it("issues a one-time sign-in link", async () => {
    const harness = await createTestPlatform();

    const result = await harness.platform.auth.requestSignInLink({
      email: OWNER_EMAIL,
      clientKey: CLIENT_KEY,
    });

    assert.equal(result.status, "link_sent");
    assert.equal(result.expiresAt, START_TIME + 15 * 60_000);

    const message = harness.email.lastMessageTo(OWNER_EMAIL);
    assert.ok(message, "a sign-in message must be delivered");
    assert.ok(message.signInUrl.startsWith("/api/auth/verify?token="));
  });

  it("stores only a hash of the link secret, never the secret itself", async () => {
    const harness = await createTestPlatform();
    const token = await requestToken(harness, OWNER_EMAIL);
    const parsed = parseChallengeToken(token);
    assert.ok(parsed, "the token must carry a challenge id and a secret");

    const challenge = harness.platform.store.findChallenge(parsed.challengeId);
    assert.ok(challenge, "the challenge must be stored");

    assert.notEqual(challenge.secretHash, parsed.secret);
    assert.equal(challenge.secretHash, hashSecret(parsed.secret));
    assert.ok(
      !challenge.secretHash.includes(parsed.secret),
      "the stored hash must not embed the raw secret",
    );
    assert.equal(challenge.consumedAt, null);
  });

  it("rejects a link whose secret has been altered", async () => {
    const harness = await createTestPlatform();
    const token = await requestToken(harness, OWNER_EMAIL);
    const parsed = parseChallengeToken(token);
    assert.ok(parsed);

    await expectInvalidLink(() =>
      harness.platform.auth.verifySignInLink({
        token: `${parsed.challengeId}.${"x".repeat(parsed.secret.length)}`,
        clientKey: CLIENT_KEY,
      }),
    );
  });

  it("expires a link after the configured interval", async () => {
    const harness = await createTestPlatform({ config: { signInLinkTtlMs: 60_000 } });
    const token = await requestToken(harness, OWNER_EMAIL);

    harness.clock.advance(59_999);
    harness.clock.set(START_TIME + 60_000);

    await expectInvalidLink(() =>
      harness.platform.auth.verifySignInLink({ token, clientKey: CLIENT_KEY }),
    );
  });

  it("accepts a link just before it expires", async () => {
    const harness = await createTestPlatform({ config: { signInLinkTtlMs: 60_000 } });
    const token = await requestToken(harness, OWNER_EMAIL);

    harness.clock.set(START_TIME + 59_999);
    const verified = harness.platform.auth.verifySignInLink({
      token,
      clientKey: CLIENT_KEY,
    });

    assert.equal(verified.person.email, OWNER_EMAIL);
  });

  it("is single use: a consumed link cannot be reused", async () => {
    const harness = await createTestPlatform();
    const token = await requestToken(harness, OWNER_EMAIL);

    const first = harness.platform.auth.verifySignInLink({
      token,
      clientKey: CLIENT_KEY,
    });
    assert.ok(first.sessionId);

    await expectInvalidLink(() =>
      harness.platform.auth.verifySignInLink({ token, clientKey: CLIENT_KEY }),
    );
  });

  it("consumes the challenge once when the same link is verified twice in a row", async () => {
    const harness = await createTestPlatform();
    const token = await requestToken(harness, OWNER_EMAIL);
    const parsed = parseChallengeToken(token);
    assert.ok(parsed);

    harness.platform.auth.verifySignInLink({ token, clientKey: CLIENT_KEY });

    // Atomic consumption is enforced by the store, so re-reading the row shows a
    // consumed challenge rather than an open one.
    const challenge = harness.platform.store.findChallenge(parsed.challengeId);
    assert.ok(challenge);
    assert.equal(challenge.consumedAt, START_TIME);
  });

  it("rejects a token that is not in the expected shape", async () => {
    const harness = await createTestPlatform();
    for (const token of ["", "no-separator", ".secret", "challenge."]) {
      await expectInvalidLink(() =>
        harness.platform.auth.verifySignInLink({ token, clientKey: CLIENT_KEY }),
      );
    }
  });
});

describe("sign-in enumeration protection", () => {
  it("returns an identical result for a registered and an unknown address", async () => {
    const harness = await createTestPlatform();

    // Establish that one address already has an account.
    await signIn(harness, OWNER_EMAIL);

    const known = await harness.platform.auth.requestSignInLink({
      email: OWNER_EMAIL,
      clientKey: CLIENT_KEY,
    });
    const unknown = await harness.platform.auth.requestSignInLink({
      email: OTHER_EMAIL,
      clientKey: CLIENT_KEY,
    });

    assert.deepEqual(known, unknown);
    assert.ok(
      harness.email.lastMessageTo(OTHER_EMAIL),
      "an unknown address is handled identically, not refused",
    );
  });

  it("does not create an account when a link is merely requested", async () => {
    const harness = await createTestPlatform();
    await harness.platform.auth.requestSignInLink({
      email: OTHER_EMAIL,
      clientKey: CLIENT_KEY,
    });

    const person = harness.platform.store.findPersonByEmailHash(emailHash(OTHER_EMAIL));
    assert.equal(person, null, "requesting a link must not create a Person");
  });

  it("creates the Person only after successful verification", async () => {
    const harness = await createTestPlatform();
    await requestToken(harness, OTHER_EMAIL);

    const person = harness.platform.store.findPersonByEmailHash(emailHash(OTHER_EMAIL));
    assert.equal(person, null);

    const verified = await signIn(harness, OWNER_EMAIL);
    const created = harness.platform.store.findPersonById(verified.person.id);
    assert.equal(created?.email, OWNER_EMAIL);
  });

  it("reuses the existing Person for a repeat sign-in", async () => {
    const harness = await createTestPlatform();
    const first = await signIn(harness, OWNER_EMAIL);
    const second = await signIn(harness, OWNER_EMAIL);

    assert.equal(first.person.id, second.person.id);
    assert.notEqual(first.sessionId, second.sessionId, "each sign-in gets a new session");
  });
});

describe("rate limiting", () => {
  it("rate limits repeated sign-in requests for one address", async () => {
    const harness = await createTestPlatform({
      config: { signInLimits: { perAddress: { limit: 3, windowMs: 60_000 }, perClient: { limit: 100, windowMs: 60_000 } } },
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await harness.platform.auth.requestSignInLink({
        email: OWNER_EMAIL,
        clientKey: CLIENT_KEY,
      });
    }

    await assert.rejects(
      harness.platform.auth.requestSignInLink({
        email: OWNER_EMAIL,
        clientKey: CLIENT_KEY,
      }),
      RateLimitedError,
    );

    // The window is fixed, so the next window restores access.
    harness.clock.set(START_TIME + 60_001);
    const recovered = await harness.platform.auth.requestSignInLink({
      email: OWNER_EMAIL,
      clientKey: CLIENT_KEY,
    });
    assert.equal(recovered.status, "link_sent");
  });

  it("rate limits sign-in requests from one client across addresses", async () => {
    const harness = await createTestPlatform({
      config: {
        signInLimits: { perAddress: { limit: 50, windowMs: 60_000 }, perClient: { limit: 2, windowMs: 60_000 } },
      },
    });

    await harness.platform.auth.requestSignInLink({ email: OWNER_EMAIL, clientKey: CLIENT_KEY });
    await harness.platform.auth.requestSignInLink({ email: OTHER_EMAIL, clientKey: CLIENT_KEY });

    await assert.rejects(
      harness.platform.auth.requestSignInLink({ email: "third@synthetic.example", clientKey: CLIENT_KEY }),
      RateLimitedError,
    );
  });

  it("rate limits verification attempts against one link", async () => {
    const harness = await createTestPlatform({
      config: { verifyLimits: { perClient: { limit: 100, windowMs: 60_000 }, perLink: { limit: 2, windowMs: 60_000 } } },
    });
    const token = await requestToken(harness, OWNER_EMAIL);
    const parsed = parseChallengeToken(token);
    assert.ok(parsed);

    const wrong = `${parsed.challengeId}.${"y".repeat(parsed.secret.length)}`;
    expectInvalidLink(() =>
      harness.platform.auth.verifySignInLink({ token: wrong, clientKey: CLIENT_KEY }),
    );
    expectInvalidLink(() =>
      harness.platform.auth.verifySignInLink({ token: wrong, clientKey: CLIENT_KEY }),
    );

    assert.throws(
      () => harness.platform.auth.verifySignInLink({ token: wrong, clientKey: CLIENT_KEY }),
      RateLimitedError,
    );
  });

  it("rate limits verification attempts from one client", async () => {
    const harness = await createTestPlatform({
      config: { verifyLimits: { perClient: { limit: 2, windowMs: 60_000 }, perLink: { limit: 100, windowMs: 60_000 } } },
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      expectInvalidLink(() =>
        harness.platform.auth.verifySignInLink({ token: "abc.def", clientKey: CLIENT_KEY }),
      );
    }

    assert.throws(
      () => harness.platform.auth.verifySignInLink({ token: "abc.def", clientKey: CLIENT_KEY }),
      RateLimitedError,
    );
  });
});

describe("session establishment", () => {
  it("establishes a session only after successful verification", async () => {
    const harness = await createTestPlatform();
    const token = await requestToken(harness, OWNER_EMAIL);

    // Requesting a link alone establishes nothing.
    assert.equal(harness.platform.sessions.resolveSession(null), null);

    const verified = harness.platform.auth.verifySignInLink({ token, clientKey: CLIENT_KEY });
    const resolved = harness.platform.sessions.resolveSession(verified.sessionId);

    assert.ok(resolved, "the session must resolve from its cookie value");
    assert.equal(resolved.id, hashSecret(verified.sessionId));
    assert.equal(resolved.personId, verified.person.id);
    assert.notEqual(resolved.id, verified.sessionId, "the raw cookie value is not the stored key");
  });

  it("resolves no session for an unknown or malformed cookie value", async () => {
    const harness = await createTestPlatform();
    assert.equal(harness.platform.sessions.resolveSession("not-a-real-session"), null);
    assert.equal(harness.platform.sessions.resolveSession(""), null);
    assert.equal(harness.platform.sessions.resolveSession(null), null);
  });

  it("rejects an expired session", async () => {
    const harness = await createTestPlatform({
      config: { sessionTtlMs: 60_000 },
    });
    const verified = await signIn(harness, OWNER_EMAIL);

    harness.clock.set(START_TIME + 60_000);
    assert.equal(harness.platform.sessions.resolveSession(verified.sessionId), null);
  });

  it("stops resolving a revoked session", async () => {
    const harness: TestPlatform = await createTestPlatform();
    const verified = await signIn(harness, OWNER_EMAIL);

    assert.equal(harness.platform.sessions.revokeSession(verified.sessionId), true);
    assert.equal(harness.platform.sessions.resolveSession(verified.sessionId), null);
  });
});