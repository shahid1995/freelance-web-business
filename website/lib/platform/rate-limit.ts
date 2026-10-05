/**
 * Store-backed rate limiting.
 *
 * Counters live in the data store rather than in process memory, so limits hold
 * across restarts and across multiple server instances. Bucket names are built
 * from hashed identifiers, so an email address or client address is never used
 * verbatim as a key.
 *
 * The check and the increment are performed by the store in one atomic step (see
 * `PlatformStore.consumeRateLimit`). Doing the read here and the write here would
 * let two concurrent requests both observe the same pre-increment count and both
 * be admitted, which would make the limit advisory rather than enforced.
 *
 * This module holds no policy of its own: the caller supplies the rule, the store
 * applies it atomically, and this function turns a refusal into the error.
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
 * Returns the attempt number that was consumed, which the tests use to pin the
 * boundary.
 */
export function consumeRateLimit(input: {
  store: PlatformStore;
  clock: Clock;
  bucket: string;
  rule: RateLimitRule;
}): number {
  const decision = input.store.consumeRateLimit(input.bucket, {
    now: input.clock.now(),
    windowMs: input.rule.windowMs,
    limit: input.rule.limit,
  });

  if (!decision.allowed) {
    throw new RateLimitedError(decision.retryAfterSeconds);
  }
  return decision.count;
}