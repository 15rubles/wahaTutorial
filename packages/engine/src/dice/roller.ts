import { type RngState, nextFloat } from './rng.js';

/**
 * Source of D6 results. Engine functions take a Roller and report its final state, so the same input
 * state always gives the same results (replays, undo, tests). The scripted roller lets tutorials
 * force specific results ("roll a 6 to see a critical hit").
 */
export interface Roller {
  d6(): number;
  /** RNG state after all rolls so far. */
  state(): RngState;
}

export function seededRoller(initial: RngState): Roller {
  let current = initial;
  return {
    d6() {
      const [v, next] = nextFloat(current);
      current = next;
      return 1 + Math.floor(v * 6);
    },
    state: () => current,
  };
}

/** Returns the queued values first, then falls back to the seeded RNG. */
export function scriptedRoller(values: readonly number[], fallback: RngState): Roller {
  const queue = [...values];
  const seeded = seededRoller(fallback);
  return {
    d6() {
      const v = queue.shift();
      if (v !== undefined) {
        if (!Number.isInteger(v) || v < 1 || v > 6)
          throw new RangeError(`Scripted die must be 1-6, got ${v}`);
        return v;
      }
      return seeded.d6();
    },
    state: () => seeded.state(),
  };
}
