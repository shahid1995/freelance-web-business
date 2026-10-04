/**
 * Platform configuration.
 *
 * Every value has an explicit default and every environment-dependent setting —
 * cookie security, origin allow-list, database location, timeouts, limits — is
 * resolved here rather than being inherited from a framework default. Nothing in
 * this file reads or writes a secret; the database path is a location, not a
 * credential.
 */

import type { RateLimitRule } from "./rate-limit";

export interface PlatformConfig {
  /** SQLite file location, or `:memory:`. Never a remote production service in this slice. */
  databasePath: string;
  isProduction: boolean;
  sessionTtlMs: number;
  /**
   * How stale a session's `lastUsedAt` may get before it is rewritten.
   *
   * Without this every authenticated request would write to the sessions table.
   */
  sessionRefreshMs: number;
  signInLinkTtlMs: number;
  /**
   * Number of trusted proxies in front of this process. Zero (the default) means
   * no proxy is trusted, so `X-Forwarded-For` is ignored for rate-limit identity.
   */
  trustedProxyHops: number;
  sessionCookieSameSite: "lax" | "strict";
  /**
   * Origins accepted for state-changing requests. Production should set
   * CUSTOMER_PLATFORM_APP_ORIGIN so the allow-list is explicit instead of being
   * derived from the incoming Host header.
   */
  allowedOrigins: string[];
  /**
   * Development-only mail log for the local email sink. Forced to null in
   * production, so a configured value can never cause sign-in links to be written
   * to a file on a deployed environment.
   */
  mailLogPath: string | null;
  signInLimits: { perAddress: RateLimitRule; perClient: RateLimitRule };
  verifyLimits: { perClient: RateLimitRule; perLink: RateLimitRule };
}

const MINUTE = 60_000;

export const DEFAULT_CONFIG: PlatformConfig = {
  databasePath: ".local/customer-platform.sqlite",
  isProduction: false,
  sessionTtlMs: 7 * 24 * 60 * MINUTE,
  sessionRefreshMs: MINUTE,
  signInLinkTtlMs: 15 * MINUTE,
  trustedProxyHops: 0,
  sessionCookieSameSite: "lax",
  allowedOrigins: [],
  mailLogPath: null,
  signInLimits: {
    perAddress: { limit: 5, windowMs: 15 * MINUTE },
    perClient: { limit: 20, windowMs: 15 * MINUTE },
  },
  verifyLimits: {
    perClient: { limit: 30, windowMs: 15 * MINUTE },
    perLink: { limit: 10, windowMs: 15 * MINUTE },
  },
};

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function readNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

function readOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export type EnvironmentLike = Record<string, string | undefined>;

/**
 * Builds configuration for the current runtime.
 *
 * `CUSTOMER_PLATFORM_DATABASE_PATH` keeps the local data file outside the
 * published source tree; the `.local/` directory it defaults to is ignored by
 * version control so customer records can never be committed.
 */
export function loadPlatformConfig(
  env: EnvironmentLike = process.env as EnvironmentLike,
): PlatformConfig {
  const isProduction = env.NODE_ENV === "production";
  return {
    ...DEFAULT_CONFIG,
    databasePath: env.CUSTOMER_PLATFORM_DATABASE_PATH ?? DEFAULT_CONFIG.databasePath,
    isProduction,
    sessionTtlMs:
      readPositiveInt(env.CUSTOMER_PLATFORM_SESSION_TTL_MINUTES, 7 * 24 * 60) * MINUTE,
    sessionRefreshMs:
      readPositiveInt(env.CUSTOMER_PLATFORM_SESSION_REFRESH_SECONDS, 60) * 1000,
    // Defaults to 0: forwarding headers are not trusted unless a deployment says so.
    trustedProxyHops: readNonNegativeInt(env.CUSTOMER_PLATFORM_TRUSTED_PROXY_HOPS, 0),
    signInLinkTtlMs:
      readPositiveInt(env.CUSTOMER_PLATFORM_SIGN_IN_LINK_TTL_MINUTES, 15) * MINUTE,
    sessionCookieSameSite:
      env.CUSTOMER_PLATFORM_COOKIE_SAMESITE === "strict" ? "strict" : "lax",
    allowedOrigins: readOrigins(env.CUSTOMER_PLATFORM_APP_ORIGIN),
    // Never write delivered sign-in links to a file on a deployed environment,
    // whatever the configuration says.
    mailLogPath: isProduction ? null : (env.CUSTOMER_PLATFORM_MAIL_LOG ?? null),
  };
}