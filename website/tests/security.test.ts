/**
 * Security properties: secrets are neither persisted nor logged, cookies are
 * hardened per environment, and state-changing requests are origin-checked.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  OriginRejectedError,
  PLATFORM_ERROR_CODES,
  UnauthenticatedError,
  isPlatformError,
} from "../lib/platform/errors";
import { assertSameOrigin, clientKeyFromHeaders, requireProtectedRequest, sanitizeReturnTo } from "../lib/platform/http";
import { hashSecret, parseChallengeToken } from "../lib/platform/secrets";
import {
  clearedSessionCookieOptions,
  parseSessionCookie,
  serializeSessionCookie,
  sessionCookieOptions,
  sessionCookieSettings,
} from "../lib/platform/sessions";
import { loadPlatformConfig } from "../lib/platform/config";
import { CLIENT_KEY, OWNER_EMAIL, createTestPlatform, requestToken, signUpAsOwner } from "./support/harness";
import type { RequestSecurityContext } from "../lib/platform/http";

const SELF_ORIGIN = "https://portal.synthetic.example";

function context(overrides: Partial<RequestSecurityContext> = {}): RequestSecurityContext {
  return {
    method: "GET",
    origin: SELF_ORIGIN,
    selfOrigin: SELF_ORIGIN,
    clientKey: CLIENT_KEY,
    cookieHeader: null,
    ...overrides,
  };
}

describe("secret handling", () => {
  it("persists no raw authentication or session secret on disk", async () => {
    const directory = mkdtempSync(join(tmpdir(), "customer-platform-secret-"));
    const databasePath = join(directory, "platform.sqlite");
    const harness = await createTestPlatform({ config: { databasePath } });

    const token = await requestToken(harness, OWNER_EMAIL);
    const parsed = parseChallengeToken(token);
    assert.ok(parsed);

    const { sessionId } = await signUpAsOwner(harness, OWNER_EMAIL);
    harness.platform.close();

    try {
      const files = readdirSync(directory);
      const onDisk = files
        .map((file) => readFileSync(join(directory, file)).toString("latin1"))
        .join("\n");

      assert.ok(!onDisk.includes(parsed.secret), "the raw link secret must not be persisted");
      assert.ok(!onDisk.includes(token), "the raw link token must not be persisted");
      assert.ok(!onDisk.includes(sessionId), "the raw session value must not be persisted");

      // The digests are present, so the checks above are reading real data
      // rather than an empty file.
      assert.ok(
        onDisk.includes(hashSecret(sessionId)),
        "the stored session must be the hash of the cookie value",
      );
      assert.ok(
        onDisk.includes(hashSecret(parsed.secret)),
        "the stored challenge must be the hash of the link secret",
      );
    } finally {
      harness.platform.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("never returns the link secret from verification", async () => {
    const harness = await createTestPlatform();
    const token = await requestToken(harness, OWNER_EMAIL);
    const parsed = parseChallengeToken(token);
    assert.ok(parsed);

    const verified = harness.platform.auth.verifySignInLink({
      token,
      clientKey: CLIENT_KEY,
    });

    const serialized = JSON.stringify(verified);
    assert.ok(!serialized.includes(parsed.secret), "verification must not echo the secret");
    assert.ok(!serialized.includes(token), "verification must not echo the token");
  });

  it("contains no logging of secrets in the platform layer", () => {
    // Compiled tests live in .test-build/tests, so the source tree is two
    // levels up from this file.
    const directory = join(__dirname, "..", "..", "lib", "platform");
    const sources = readdirSync(directory).filter((file) => file.endsWith(".ts"));
    assert.ok(sources.length > 0, "the platform source directory must be readable");

    for (const file of sources) {
      const contents = readFileSync(join(directory, file), "utf8");
      assert.ok(
        !/\bconsole\.[a-z]+\s*\(/.test(contents),
        `${file} must not write to the console: the platform layer handles secrets`,
      );
      assert.ok(
        !/\bprocess\.(stdout|stderr)\b/.test(contents),
        `${file} must not write to stdout or stderr`,
      );
    }
  });
});

describe("session cookie", () => {
  it("marks the cookie HttpOnly and SameSite in every environment", () => {
    for (const isProduction of [false, true]) {
      const settings = sessionCookieSettings({ isProduction, ttlMs: 60_000 });
      const header = serializeSessionCookie(settings, "opaque-session-value");

      assert.ok(header.includes("HttpOnly"));
      assert.ok(header.includes("SameSite=Lax"));
      assert.ok(header.includes("Path=/"));
      assert.ok(header.includes("Max-Age=60"));
    }
  });

  it("requires Secure and the __Host- prefix in production", () => {
    const settings = sessionCookieSettings({ isProduction: true, ttlMs: 60_000 });
    const header = serializeSessionCookie(settings, "opaque-session-value");

    assert.equal(settings.name, "__Host-customer_session");
    assert.equal(settings.secure, true);
    assert.ok(header.includes("Secure"));
    assert.ok(!header.includes("Domain="), "a __Host- cookie must not set Domain");
  });

  it("omits Secure outside production so local http development still works", () => {
    const settings = sessionCookieSettings({ isProduction: false, ttlMs: 60_000 });
    assert.equal(settings.secure, false);
    assert.ok(!serializeSessionCookie(settings, "v").includes("Secure"));
  });

  it("reads back only its own cookie", () => {
    const settings = sessionCookieSettings({ isProduction: true, ttlMs: 60_000 });

    assert.equal(
      parseSessionCookie(settings, `${settings.name}=abc123; Path=/; HttpOnly`),
      "abc123",
    );
    assert.equal(
      parseSessionCookie(settings, `other=zzz; ${settings.name}=abc123`),
      "abc123",
    );
    assert.equal(parseSessionCookie(settings, "other=zzz"), null);
    assert.equal(parseSessionCookie(settings, null), null);
  });

  it("clears the cookie with the same attributes it was issued with", () => {
    for (const isProduction of [false, true]) {
      const settings = sessionCookieSettings({ isProduction, ttlMs: 60_000 });
      const issued = sessionCookieOptions(settings);
      const cleared = clearedSessionCookieOptions(settings);

      // A clearing cookie with different attributes does not clear the cookie, so
      // only the lifetime may differ.
      assert.equal(cleared.httpOnly, issued.httpOnly);
      assert.equal(cleared.secure, issued.secure);
      assert.equal(cleared.sameSite, issued.sameSite);
      assert.equal(cleared.path, issued.path);
      assert.equal(cleared.maxAge, 0);
      assert.equal(issued.httpOnly, true);
      assert.equal(issued.maxAge, 60);
    }
  });

  it("derives cookie security from the environment rather than a framework default", () => {
    assert.equal(loadPlatformConfig({ NODE_ENV: "production" }).isProduction, true);
    assert.equal(loadPlatformConfig({ NODE_ENV: "development" }).isProduction, false);
    assert.deepEqual(loadPlatformConfig({ CUSTOMER_PLATFORM_APP_ORIGIN: "https://a.test , https://b.test" }).allowedOrigins, [
      "https://a.test",
      "https://b.test",
    ]);
  });

  it("never enables the development mail log in production", () => {
    assert.equal(
      loadPlatformConfig({
        NODE_ENV: "production",
        CUSTOMER_PLATFORM_MAIL_LOG: "/tmp/should-be-ignored.log",
      }).mailLogPath,
      null,
      "delivered sign-in links must never be written to a file in production",
    );
    assert.equal(
      loadPlatformConfig({ NODE_ENV: "development", CUSTOMER_PLATFORM_MAIL_LOG: "/tmp/dev.log" })
        .mailLogPath,
      "/tmp/dev.log",
    );
    assert.equal(loadPlatformConfig({}).mailLogPath, null);
  });
});

describe("origin protection", () => {
  it("rejects a state-changing request with no Origin", () => {
    assert.throws(
      () => assertSameOrigin(context({ method: "POST", origin: null }), loadPlatformConfig({})),
      OriginRejectedError,
    );
  });

  it("rejects a cross-origin state-changing request", () => {
    assert.throws(
      () =>
        assertSameOrigin(
          context({ method: "POST", origin: "https://attacker.example" }),
          loadPlatformConfig({}),
        ),
      OriginRejectedError,
    );
  });

  it("rejects a cross-origin request even when an origin is configured", () => {
    const config = loadPlatformConfig({ CUSTOMER_PLATFORM_APP_ORIGIN: "https://other.example" });
    assert.throws(
      () => assertSameOrigin(context({ method: "POST" }), config),
      OriginRejectedError,
    );
  });

  it("accepts a same-origin state-changing request", () => {
    assert.doesNotThrow(() => assertSameOrigin(context({ method: "POST" }), loadPlatformConfig({})));
  });

  it("exempts read-only methods", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      assert.doesNotThrow(() =>
        assertSameOrigin(context({ method, origin: null }), loadPlatformConfig({})),
      );
    }
  });

  it("checks origin before the session, so a cross-origin write fails first", async () => {
    const harness = await createTestPlatform();
    const { sessionId } = await signUpAsOwner(harness, OWNER_EMAIL);

    assert.throws(
      () =>
        requireProtectedRequest(
          context({
            method: "POST",
            origin: "https://attacker.example",
            cookieHeader: `${harness.platform.sessions.cookie.name}=${sessionId}`,
          }),
          harness.platform,
        ),
      OriginRejectedError,
    );
  });
});

describe("protected request guard", () => {
  it("rejects a request with no session cookie", async () => {
    const harness = await createTestPlatform();

    assert.throws(
      () => requireProtectedRequest(context(), harness.platform),
      UnauthenticatedError,
    );
  });

  it("rejects a tampered session cookie", async () => {
    const harness = await createTestPlatform();
    const { sessionId } = await signUpAsOwner(harness, OWNER_EMAIL);
    const cookie = harness.platform.sessions.cookie;

    assert.throws(
      () =>
        requireProtectedRequest(context({ cookieHeader: `${cookie.name}=${sessionId}x` }), harness.platform),
      UnauthenticatedError,
    );
    // A value from a different session must not resolve either.
    assert.throws(
      () =>
        requireProtectedRequest(context({ cookieHeader: `${cookie.name}=${sessionId.slice(0, -2)}` }), harness.platform),
      UnauthenticatedError,
    );
  });

  it("returns the server-held person for a valid session", async () => {
    const harness = await createTestPlatform();
    const { personId, sessionId } = await signUpAsOwner(harness, OWNER_EMAIL);
    const cookie = harness.platform.sessions.cookie;

    const protectedRequest = requireProtectedRequest(
      context({ cookieHeader: `${cookie.name}=${sessionId}` }),
      harness.platform,
    );

    assert.equal(protectedRequest.personId, personId);
  });
});

describe("error identification across bundles", () => {
  it("recognizes a platform error by code, not by class identity", () => {
    // Next compiles each route into its own bundle, so an error raised inside a
    // route handler is a different class object than the one a page imports.
    // A structural copy with the same code must still be recognized, or an
    // expected redirect turns into a 500.
    const foreign = {
      name: "UnauthenticatedError",
      code: PLATFORM_ERROR_CODES.unauthenticated,
      status: 401,
      message: "Sign in to continue.",
    };

    assert.equal(foreign instanceof UnauthenticatedError, false);
    assert.equal(isPlatformError(foreign), true);
    assert.equal(isPlatformError(foreign, PLATFORM_ERROR_CODES.unauthenticated), true);
    assert.equal(isPlatformError(foreign, PLATFORM_ERROR_CODES.forbidden), false);
  });

  it("does not mistake arbitrary errors for platform errors", () => {
    assert.equal(isPlatformError(new Error("boom")), false);
    assert.equal(isPlatformError(null), false);
    assert.equal(isPlatformError(undefined), false);
    assert.equal(isPlatformError("unauthenticated"), false);
    assert.equal(isPlatformError({ code: "unauthenticated" }), false, "a status is required");
    assert.equal(isPlatformError({ status: 401 }), false, "a code is required");
  });
});

describe("post-sign-in destination", () => {
  it("accepts a same-site path", () => {
    assert.equal(sanitizeReturnTo("/dashboard"), "/dashboard");
    assert.equal(
      sanitizeReturnTo("/dashboard/projects/PRJ-ABCDE/intake"),
      "/dashboard/projects/PRJ-ABCDE/intake",
    );
    assert.equal(sanitizeReturnTo("/sign-in?returnTo=/dashboard"), "/sign-in?returnTo=/dashboard");
  });

  it("refuses anything that could leave the site", () => {
    for (const value of [
      "https://attacker.example",
      "//attacker.example",
      "/\\attacker.example",
      "javascript:alert(1)",
      "dashboard",
      "",
      null,
      undefined,
      42,
    ]) {
      assert.equal(sanitizeReturnTo(value), null, `${String(value)} must be refused`);
    }
  });
});

describe("rate-limit client identity", () => {
  it("uses the originating forwarded address", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" });
    assert.equal(clientKeyFromHeaders(headers), "198.51.100.7");
  });

  it("falls back to a single shared bucket rather than a fresh one", () => {
    assert.equal(clientKeyFromHeaders(new Headers()), "unknown-client");
    assert.equal(
      clientKeyFromHeaders(new Headers({ "x-forwarded-for": "  " })),
      "unknown-client",
    );
    assert.equal(
      clientKeyFromHeaders(new Headers({ "x-real-ip": "203.0.113.9" })),
      "203.0.113.9",
    );
  });
});