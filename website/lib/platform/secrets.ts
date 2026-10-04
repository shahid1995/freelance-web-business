/**
 * Secret handling for passwordless sign-in and sessions.
 *
 * Rules enforced here:
 * - every token is generated with the CSPRNG, never a counter or timestamp;
 * - only a SHA-256 digest of a secret is ever returned for persistence;
 * - comparisons are constant-time, so verification does not leak how much of a
 *   digest matched;
 * - email addresses are hashed before being used as a lookup or rate-limit key,
 *   so the raw address is not a stored join key and does not appear in
 *   bucket names.
 *
 * SHA-256 (not a password KDF) is the correct primitive here: the secrets are
 * high-entropy random values, so there is nothing to brute force. These are
 * also single-use and time-limited.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;
const REFERENCE_BYTES = 5;
/** Crockford-style alphabet: no I, L, O or U, so references read cleanly aloud. */
const REFERENCE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Generates an opaque, high-entropy secret. Never persisted or logged. */
export function generateSecret(byteLength: number = TOKEN_BYTES): string {
  return randomBytes(byteLength).toString("base64url");
}

/** SHA-256 digest, hex encoded. This is what gets stored in place of a secret. */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Constant-time comparison of two hex digests of equal expected length. */
export function secretsMatch(candidateHash: string, expectedHash: string): boolean {
  if (candidateHash.length !== expectedHash.length) {
    // Still perform a comparison so a length mismatch is not measurably faster.
    timingSafeEqual(Buffer.from(candidateHash, "utf8"), Buffer.from(candidateHash, "utf8"));
    return false;
  }
  return timingSafeEqual(Buffer.from(candidateHash, "utf8"), Buffer.from(expectedHash, "utf8"));
}

/** Normalises an email address for storage and lookup. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Stable, non-reversible key for an email address. */
export function emailHash(email: string): string {
  return hashSecret(normalizeEmail(email));
}

// Deliberately permissive: the goal is to reject obvious typos and malformed
// input, not to re-implement RFC 5322. Address validation belongs to the email
// delivery boundary, which this slice does not activate.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isValidEmailShape(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length <= 254 && EMAIL_SHAPE.test(normalized);
}

/**
 * Splits a one-time link token into the challenge id and the secret half.
 * The id is a lookup key, not a credential: without the secret half the
 * challenge cannot be consumed.
 */
export function parseChallengeToken(token: string): { challengeId: string; secret: string } | null {
  const separator = token.indexOf(".");
  if (separator <= 0 || separator === token.length - 1) {
    return null;
  }
  return { challengeId: token.slice(0, separator), secret: token.slice(separator + 1) };
}

export function buildChallengeToken(challengeId: string, secret: string): string {
  return `${challengeId}.${secret}`;
}

/**
 * Short, stable, non-sensitive project reference shown to customers in place
 * of internal identifiers. Not a secret and not a capability.
 */
export function generateProjectReference(): string {
  const bytes = randomBytes(REFERENCE_BYTES);
  let reference = "";
  for (const byte of bytes) {
    reference += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  }
  return `PRJ-${reference}`;
}

/**
 * Human-friendly invite-free action key used to make "Start Your Project"
 * idempotent. It is rendered into the form by the server and is not a
 * credential: creating a project never depends on it being unguessable.
 */
export function generateActionKey(): string {
  return randomBytes(16).toString("hex");
}