/**
 * Route-handler test harness.
 *
 * Loads a real Next.js route module under the plain Node test runner so the
 * handler itself — its guard, its ordering, and its redirects — is what the
 * tests exercise, rather than a restatement of the source. Three framework
 * seams are supplied because they exist only inside a running Next server;
 * nothing in the platform is mocked: the handler runs the real guard, the real
 * services, the real store, and the real email sink.
 *
 * 1. Route files import through the `@/` path alias, which tsc emits verbatim
 *    into the CommonJS test build. A resolver maps `@/…` onto the compiled
 *    `.test-build` tree before the route is required.
 * 2. `currentRequestContext` reads Next's ambient request headers via
 *    `next/headers`. That module is given a stub returning the headers each
 *    test declares, so origin, host, and forwarding headers are explicit, and
 *    a recording `cookies()` stand-in so a route that issues the session
 *    cookie can be asserted without a real jar.
 * 3. `getPlatform()` caches one platform on `globalThis`; a test installs its
 *    own harness platform there for the duration of one call and removes it
 *    afterwards.
 */

import { join } from "node:path";

import type { Platform } from "../../lib/platform/container";

/** Compiled output root: this file compiles to `.test-build/tests/support`. */
const BUILD_ROOT = join(__dirname, "..", "..");

type ResolveFilename = (
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown,
) => string;

let resolverInstalled = false;

/**
 * Makes `@/x` resolve to `<compiled root>/x`.
 *
 * tsc does not rewrite path aliases, so without this the compiled route would
 * require the literal specifier `@/lib/…`, which Node cannot resolve. The
 * patch wraps `Module._resolveFilename` and only rewrites the `@/` prefix.
 */
function installAliasResolver(): void {
  if (resolverInstalled) return;
  resolverInstalled = true;
  const internals = require("node:module") as unknown as {
    _resolveFilename: ResolveFilename;
  };
  const original = internals._resolveFilename;
  internals._resolveFilename = (request, parent, isMain, options) =>
    original.call(
      internals,
      request.startsWith("@/") ? join(BUILD_ROOT, request.slice(2)) : request,
      parent,
      isMain,
      options,
    );
}

/** The ambient request headers the next call to `currentRequestContext` sees. */
let currentHeaders = new Headers();

/**
 * Declares the headers the route under test will read.
 *
 * Called before every invocation so no test can inherit another's origin.
 */
export function setRouteHeaders(init: Record<string, string>): void {
  currentHeaders = new Headers(init);
}

let headersStubInstalled = false;

/** A cookie the route under test wrote. */
export interface RecordedCookie {
  name: string;
  value: string;
}

let recordedCookies: RecordedCookie[] = [];

/**
 * Cookies written since the last call; clears the recording.
 *
 * A test asserts against what a route actually issued — the session cookie
 * after verification, or the absence of one after a rejected attempt — without
 * any real cookie jar being touched.
 */
export function takeRecordedCookies(): RecordedCookie[] {
  const taken = recordedCookies;
  recordedCookies = [];
  return taken;
}

/**
 * Replaces `headers()` and `cookies()` on the real `next/headers` module.
 *
 * Both properties are read at each call site (`headers_1.headers()`), so
 * assigning them here is what the compiled `currentRequestContext` and
 * `issueSessionCookie` execute. Cookie writes are recorded rather than
 * applied: the cookie store is ambient request state that exists only inside a
 * running server, and the verify route issues the session cookie through it.
 */
function installHeadersStub(): void {
  if (headersStubInstalled) return;
  headersStubInstalled = true;
  const nextHeaders = require("next/headers") as {
    headers?: unknown;
    cookies?: unknown;
  };
  Object.defineProperty(nextHeaders, "headers", {
    value: async (): Promise<Headers> => currentHeaders,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  Object.defineProperty(nextHeaders, "cookies", {
    value: async (): Promise<{ set(name: string, value: string): void }> => ({
      set: (name: string, value: string): void => {
        recordedCookies.push({ name, value });
      },
    }),
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

/**
 * Installs the test's platform as the one `getPlatform()` returns, and returns
 * a restore function. The cache lives on `globalThis`, so it is set for the
 * duration of one route call and removed immediately after.
 */
export function installTestPlatform(platform: Platform): () => void {
  const holder = globalThis as typeof globalThis & {
    __customerPlatform?: Promise<Platform>;
  };
  const previous = holder.__customerPlatform;
  holder.__customerPlatform = Promise.resolve(platform);
  return () => {
    if (previous === undefined) {
      delete holder.__customerPlatform;
    } else {
      holder.__customerPlatform = previous;
    }
  };
}

/**
 * Requires a compiled route module by its path under `website/`, without the
 * extension, installing the framework seams first.
 *
 * Example: `loadRouteHandler("app/api/auth/request-link/route")`.
 */
export function loadRouteHandler<T>(sourcePath: string): T {
  installAliasResolver();
  installHeadersStub();
  return require(join(BUILD_ROOT, sourcePath)) as T;
}
