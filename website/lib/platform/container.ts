/**
 * Platform container.
 *
 * Wires the services to their adapters. `getPlatform()` builds one instance per
 * server process and is what routes use; `createPlatform()` is the same wiring
 * with explicit overrides and is what tests use.
 *
 * The SQLite adapter is imported dynamically so that loading the app — building
 * the site, statically rendering a public page — never opens a database. It also
 * keeps `node:sqlite`, which is still marked experimental, off any code path that
 * does not actually need it.
 */

import { randomUUID } from "node:crypto";

import { systemClock, type Clock } from "./clock";
import { loadPlatformConfig, type PlatformConfig, type EnvironmentLike } from "./config";
import { AuthService } from "./auth";
import { IntakeService } from "./intake";
import { LocalEmailSink } from "./local-email";
import { OrganizationService } from "./organizations";
import { ProjectService } from "./projects";
import { SessionService, sessionCookieSettings } from "./sessions";
import type { EmailDelivery, PlatformStore } from "./ports";

export interface Platform {
  config: PlatformConfig;
  clock: Clock;
  email: EmailDelivery;
  store: PlatformStore;
  sessions: SessionService;
  auth: AuthService;
  organizations: OrganizationService;
  projects: ProjectService;
  intake: IntakeService;
  close(): void;
}

export interface CreatePlatformOptions {
  config?: PlatformConfig;
  env?: EnvironmentLike;
  clock?: Clock;
  email?: EmailDelivery;
  store?: PlatformStore;
  /** Absolute or relative URL prefix for the one-time sign-in link. */
  signInPath?: string;
  newId?: () => string;
}

export async function createPlatform(
  options: CreatePlatformOptions = {},
): Promise<Platform> {
  const config = options.config ?? loadPlatformConfig(options.env);
  const clock = options.clock ?? systemClock;
  const email = options.email ?? new LocalEmailSink({ recordPath: config.mailLogPath });
  const newId = options.newId ?? (() => randomUUID());

  let resolvedStore: PlatformStore;
  let ownsStore = false;
  if (options.store) {
    resolvedStore = options.store;
  } else {
    const { SqlitePlatformStore } = await import("./sqlite-store");
    resolvedStore = new SqlitePlatformStore(config.databasePath);
    ownsStore = true;
  }

  const sessions = new SessionService({
    store: resolvedStore,
    clock,
    ttlMs: config.sessionTtlMs,
    cookie: sessionCookieSettings({
      isProduction: config.isProduction,
      ttlMs: config.sessionTtlMs,
    }),
  });

  const signInPath = options.signInPath ?? "/api/auth/verify";

  return {
    config,
    clock,
    email,
    store: resolvedStore,
    sessions,
    auth: new AuthService({
      store: resolvedStore,
      clock,
      email,
      sessions,
      buildSignInUrl: (token) => `${signInPath}?token=${encodeURIComponent(token)}`,
      signInLinkTtlMs: config.signInLinkTtlMs,
      newId,
      signInLimits: config.signInLimits,
      verifyLimits: config.verifyLimits,
    }),
    organizations: new OrganizationService({
      store: resolvedStore,
      clock,
      sessions,
      newId,
    }),
    projects: new ProjectService({ store: resolvedStore, clock, newId }),
    intake: new IntakeService({ store: resolvedStore, clock, newId }),
    close() {
      if (ownsStore) {
        resolvedStore.close();
      }
    },
  };
}

/**
 * The per-process instance used by route handlers and server components.
 *
 * Held on `globalThis` rather than in module scope: the development server loads
 * this module separately for each route bundle, and a module-level cache would
 * open a separate database connection per bundle. A cached promise rather than a
 * cached value means concurrent first requests do not each build a container.
 */
export function getPlatform(): Promise<Platform> {
  const holder = globalThis as typeof globalThis & {
    __customerPlatform?: Promise<Platform>;
  };
  holder.__customerPlatform ??= createPlatform();
  return holder.__customerPlatform;
}