/**
 * Passwordless authentication.
 *
 * Enters email → issues a single-use link → verifies the link → establishes a
 * session. Design points that matter here:
 *
 * - the link secret is generated, emailed, and immediately discarded; only its
 *   SHA-256 digest is stored;
 * - verification checks the secret before consuming the challenge, so a wrong
 *   guess cannot burn somebody's valid link, and consumption itself is atomic,
 *   so a replayed link cannot be used twice even concurrently;
 * - the Person record is created *after* successful verification, which means the
 *   sign-in request path behaves identically for an unknown address and a known
 *   one, and never reveals whether an email is registered;
 * - the raw secret and the resulting session value are never returned to a
 *   caller other than the cookie that has to carry it.
 */

import type { Clock } from "./clock";
import type { AuthenticationChallenge, Person, Session } from "./domain";
import { PlatformError, ValidationError } from "./errors";
import type { EmailDelivery, PlatformStore } from "./ports";
import { consumeRateLimit, type RateLimitRule } from "./rate-limit";
import {
  buildChallengeToken,
  emailHash,
  generateSecret,
  hashSecret,
  isValidEmailShape,
  normalizeEmail,
  parseChallengeToken,
  secretsMatch,
} from "./secrets";
import type { SessionService } from "./sessions";

/** Raised for any unusable link. One type for every failure so links are indistinguishable. */
export class InvalidSignInLinkError extends PlatformError {
  constructor(
    message = "This sign-in link is no longer valid. Request a new one to continue.",
  ) {
    super("invalid_sign_in_link", message, 400);
  }
}

export interface SignInResult {
  /**
   * Deliberately constant for every accepted address. The caller must render
   * this same message whether or not the address has an account.
   */
  status: "link_sent";
  expiresAt: number;
  expiresInSeconds: number;
}

export interface VerifiedSession {
  person: Person;
  session: Session;
  /** The raw cookie value. Hand it straight to the cookie, never to a response body. */
  sessionId: string;
}

export interface AuthServiceOptions {
  store: PlatformStore;
  clock: Clock;
  email: EmailDelivery;
  sessions: SessionService;
  /** Builds the one-time URL. Injected so the core stays free of framework concerns. */
  buildSignInUrl: (token: string) => string;
  signInLinkTtlMs: number;
  newId: () => string;
  signInLimits: { perAddress: RateLimitRule; perClient: RateLimitRule };
  verifyLimits: { perClient: RateLimitRule; perLink: RateLimitRule };
}

export class AuthService {
  constructor(private readonly options: AuthServiceOptions) {}

  /**
   * Issues a one-time sign-in link.
   *
   * Performs no lookup against existing accounts, so the response and the work
   * performed are the same for a registered and an unregistered address.
   */
  async requestSignInLink(input: {
    email: string;
    clientKey: string;
  }): Promise<SignInResult> {
    const email = normalizeEmail(input.email);
    if (!isValidEmailShape(email)) {
      throw new ValidationError("Enter a valid email address.");
    }
    const addressKey = emailHash(email);

    // Both limits are checked before any work is done, and neither bucket name
    // contains the raw address.
    consumeRateLimit({
      store: this.options.store,
      clock: this.options.clock,
      bucket: `signin:address:${addressKey}`,
      rule: this.options.signInLimits.perAddress,
    });
    consumeRateLimit({
      store: this.options.store,
      clock: this.options.clock,
      bucket: `signin:client:${hashSecret(input.clientKey)}`,
      rule: this.options.signInLimits.perClient,
    });

    const now = this.options.clock.now();
    const expiresAt = now + this.options.signInLinkTtlMs;
    const secret = generateSecret();
    const challenge: AuthenticationChallenge = {
      id: this.options.newId(),
      email,
      emailHash: addressKey,
      secretHash: hashSecret(secret),
      createdAt: now,
      expiresAt,
      consumedAt: null,
    };
    this.options.store.createChallenge(challenge);

    await this.options.email.sendSignInLink({
      to: email,
      signInUrl: this.options.buildSignInUrl(buildChallengeToken(challenge.id, secret)),
      expiresAt,
    });

    return {
      status: "link_sent",
      expiresAt,
      expiresInSeconds: Math.max(1, Math.floor(this.options.signInLinkTtlMs / 1000)),
    };
  }

  /**
   * Verifies a one-time link and establishes a session.
   *
   * Unknown id, wrong secret, expired link, and already-consumed link all raise
   * the same error and produce the same message, so a caller cannot use the
   * response to probe which links exist.
   */
  verifySignInLink(input: {
    token: string;
    clientKey: string;
  }): VerifiedSession {
    consumeRateLimit({
      store: this.options.store,
      clock: this.options.clock,
      bucket: `verify:client:${hashSecret(input.clientKey)}`,
      rule: this.options.verifyLimits.perClient,
    });

    const parsed = parseChallengeToken(input.token);
    if (!parsed) {
      throw new InvalidSignInLinkError();
    }
    consumeRateLimit({
      store: this.options.store,
      clock: this.options.clock,
      bucket: `verify:link:${hashSecret(parsed.challengeId)}`,
      rule: this.options.verifyLimits.perLink,
    });

    return this.options.store.transaction(() => {
      const now = this.options.clock.now();
      const challenge = this.options.store.findChallenge(parsed.challengeId);
      if (!challenge) {
        throw new InvalidSignInLinkError();
      }
      // Check the secret first: a wrong secret must not consume the challenge,
      // or a guessed id could invalidate somebody's live link.
      if (!secretsMatch(hashSecret(parsed.secret), challenge.secretHash)) {
        throw new InvalidSignInLinkError();
      }
      if (challenge.expiresAt <= now) {
        throw new InvalidSignInLinkError();
      }
      // Atomic check-and-consume. A replay changes zero rows and is rejected.
      const consumed = this.options.store.consumeChallenge({ id: challenge.id, now });
      if (!consumed) {
        throw new InvalidSignInLinkError();
      }

      // Create or load. Because this runs only after a successful verification,
      // the sign-in request path never has to know whether an account exists.
      const existing = this.options.store.findPersonByEmailHash(challenge.emailHash);
      const person =
        existing ??
        this.options.store.createPerson({
          id: this.options.newId(),
          email: challenge.email,
          emailHash: challenge.emailHash,
          displayName: null,
          now,
        });
      if (!existing) {
        this.options.store.appendAuditEvent({
          id: this.options.newId(),
          organizationId: null,
          personId: person.id,
          projectId: null,
          type: "person.created",
          occurredAt: now,
          metadata: { source: "passwordless_verification" },
        });
      }

      const { sessionId, session } = this.options.sessions.createSession(person.id);
      this.options.store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: null,
        personId: person.id,
        projectId: null,
        type: "session.created",
        occurredAt: now,
        metadata: null,
      });

      return { person, session, sessionId };
    });
  }
}