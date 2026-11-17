/** Seedable PRNG (mulberry32). The state is a plain number so it can live in serializable game state. */
export interface RngState {
  readonly seed: number;
  /** Number of values drawn so far; useful in logs. */
  readonly draws: number;
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0, draws: 0 };
}

/** Returns a float in [0, 1) and the next state. */
export function nextFloat(state: RngState): [number, RngState] {
  let t = (state.seed + 0x6d2b79f5) >>> 0;
  const seed = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, { seed, draws: state.draws + 1 }];
}
