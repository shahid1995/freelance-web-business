/**
 * Sessions.
 *
 * The browser holds an opaque, high-entropy value in an HttpOnly cookie. The
 * server stores only its SHA-256 digest, so the session table cannot be
 * replayed as a set of browser sessions, and a stale database copy cannot be
 * turned back into a usable cookie.
 *
 * Cookie handling is a pure function of the environment rather than a framework
 * default, so production cannot silently inherit development cookie settings.
 */

import type { Clock } from "./clock";
import type { Session } from "./domain";
import { UnauthenticatedError } from "./errors";
import { generateSecret, hashSecret } from "./secrets";
import type { PlatformStore } from "./ports";

export interface SessionCookieSettings {
  name: string;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  maxAgeSeconds: number;
  path: string;
}

export interface SessionServiceOptions {
  store: PlatformStore;
  clock: Clock;
  ttlMs: number;
  cookie: SessionCookieSettings;
}

/**
 * Cookie settings derived from the runtime environment.
 *
 * `Secure` is required in production. The `__Host-` prefix is used when the
 * cookie is Secure, which browsers enforce as Secure + Path=/ + no Domain, so a
 * subdomain cannot rewrite the session cookie.
 */
export function sessionCookieSettings(options: {
  isProduction: boolean;
  ttlMs: number;
}): SessionCookieSettings {
  return {
    name: options.isProduction ? "__Host-customer_session" : "customer_session",
    secure: options.isProduction,
    // Lax: the session is first-party and every mutation is a same-origin POST
    // that is additionally origin-checked. Lax rather than Strict so a customer
    // following a link back into the application from an email client is not
    // silently signed out.
    sameSite: "lax",
    maxAgeSeconds: Math.floor(options.ttlMs / 1000),
    path: "/",
  };
}

/**
 * Cookie attributes for issuing the session cookie.
 *
 * Used by the framework adapter for both issuing and clearing, so the two cannot
 * drift apart — a clearing cookie with different attributes does not clear.
 */
export interface SessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: SessionCookieSettings["sameSite"];
  path: string;
  maxAge: number;
}

export function sessionCookieOptions(settings: SessionCookieSettings): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: settings.secure,
    sameSite: settings.sameSite,
    path: settings.path,
    maxAge: settings.maxAgeSeconds,
  };
}

/** Clearing uses the issuing attributes with a zero lifetime. */
export function clearedSessionCookieOptions(
  settings: SessionCookieSettings,
): SessionCookieOptions {
  return { ...sessionCookieOptions(settings), maxAge: 0 };
}

export function serializeSessionCookie(
  settings: SessionCookieSettings,
  value: string,
): string {
  const parts = [
    `${settings.name}=${value}`,
    `Path=${settings.path}`,
    "HttpOnly",
    `SameSite=${settings.sameSite === "lax" ? "Lax" : settings.sameSite === "strict" ? "Strict" : "None"}`,
    `Max-Age=${settings.maxAgeSeconds}`,
  ];
  if (settings.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function parseSessionCookie(
  settings: SessionCookieSettings,
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== settings.name) continue;
    return part.slice(separator + 1).trim() || null;
  }
  return null;
}

export class SessionService {
  constructor(private readonly options: SessionServiceOptions) {}

  get cookie(): SessionCookieSettings {
    return this.options.cookie;
  }

  /**
   * Issues a new session and returns the raw cookie value. This is the only
   * place a usable session value exists outside the browser.
   */
  createSession(personId: string): { sessionId: string; session: Session } {
    const now = this.options.clock.now();
    const rawSessionId = generateSecret();
    const session: Session = {
      id: hashSecret(rawSessionId),
      personId,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: now + this.options.ttlMs,
      revokedAt: null,
    };
    this.options.store.createSession(session);
    return { sessionId: rawSessionId, session };
  }

  /**
   * Resolves a cookie value to its stored session, or null when it is unknown,
   * revoked, or expired. Every protected request goes through this before any
   * authorization decision.
   */
  resolveSession(rawSessionId: string | null): Session | null {
    if (!rawSessionId) return null;
    const session = this.options.store.findSessionById(hashSecret(rawSessionId));
    if (!session) return null;
    if (session.revokedAt !== null) return null;
    if (session.expiresAt <= this.options.clock.now()) return null;
    this.options.store.touchSession({
      id: session.id,
      now: this.options.clock.now(),
    });
    return session;
  }

  /**
   * Requires a live session. Throws rather than returning null so no route can
   * accidentally continue with a missing session.
   */
  requireSession(rawSessionId: string | null): Session {
    const session = this.resolveSession(rawSessionId);
    if (!session) {
      throw new UnauthenticatedError();
    }
    return session;
  }

  /** Server-side revocation: takes effect on the next request. */
  revokeSession(rawSessionId: string | null): boolean {
    if (!rawSessionId) return false;
    return this.options.store.revokeSession({
      id: hashSecret(rawSessionId),
      now: this.options.clock.now(),
    });
  }
}