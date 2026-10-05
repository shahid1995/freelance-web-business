/**
 * Injectable clock.
 *
 * Expiry and rate-limit behaviour is time-dependent, so every time read in the
 * platform layer goes through this interface. Tests supply a controllable clock
 * instead of sleeping, and no module calls `Date.now()` directly.
 */

export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

export function fixedClock(startAt: number): Clock & { advance(ms: number): void; set(at: number): void } {
  let current = startAt;
  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
    },
    set(at: number) {
      current = at;
    },
  };
}