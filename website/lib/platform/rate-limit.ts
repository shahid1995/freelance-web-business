/**
 * Store-backed rate limiting.
 *
 * Counters live in the data store rather than in process memory, so limits hold
 * across restarts and across multiple server instances. Bucket names are built
 * from hashed identifiers, so an email address or client address is never used
 * verbatim as a key.
 *
 * Call this outside any surrounding transaction: a rolled-back transaction must
 * not erase the record of an attempt that already happened.
 */

import type { Clock } from "./clock";
import { RateLimitedError } from "./errors";
import type { PlatformStore } from "./ports";

export interface RateLimitRule {
  /** Attempts permitted within the window. */
  limit: number;
  windowMs: number;
}

/**
 * Counts one attempt against `bucket` and throws when the limit is reached.
 * The returned count is the attempt number that was just consumed, which the
 * tests use to pin the boundary.
 */
export function consumeRateLimit(input: {
  store: PlatformStore;
  clock: Clock;
  bucket: string;
  rule: RateLimitRule;
}): number {
  const { store, clock, bucket, rule } = input;
  const now = clock.now();
  const existing = store.readRateLimit(bucket);
  const withinWindow =
    existing !== null && now - existing.windowStart < rule.windowMs;
  const windowStart = withinWindow ? existing.windowStart : now;
  const count = withinWindow ? existing.count : 0;

  if (count >= rule.limit) {
    const retryAfterMs = Math.max(1, windowStart + rule.windowMs - now);
    throw new RateLimitedError(Math.ceil(retryAfterMs / 1000));
  }

  store.writeRateLimit(bucket, { windowStart, count: count + 1 });
  return count + 1;
}