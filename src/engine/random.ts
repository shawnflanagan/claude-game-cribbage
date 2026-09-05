/**
 * Seeded randomness as a plain value. Every draw returns the next state
 * alongside its result, so the engine stays a pure function of its inputs
 * and a Game replays exactly from its seed (ADR 0002).
 */
export type Rng = {
  readonly state: number;
};

/** The result of consuming randomness: what came out, and the state after. */
export type Draw<T> = {
  readonly value: T;
  readonly rng: Rng;
};

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

// mulberry32: small, fast, and good enough to shuffle cards.
function nextUint32(rng: Rng): Draw<number> {
  const state = (rng.state + 0x6d2b79f5) | 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, rng: { state } };
}

/** A uniform integer in [0, bound). */
export function nextInt(rng: Rng, bound: number): Draw<number> {
  const draw = nextUint32(rng);
  return { value: Math.floor((draw.value / 2 ** 32) * bound), rng: draw.rng };
}

/** Fisher-Yates shuffle. Returns a new array; the input is untouched. */
export function shuffle<T>(items: readonly T[], rng: Rng): Draw<T[]> {
  const shuffled = [...items];
  let current = rng;
  for (let i = shuffled.length - 1; i > 0; i--) {
    const draw = nextInt(current, i + 1);
    current = draw.rng;
    const j = draw.value;
    const a = shuffled[i];
    const b = shuffled[j];
    if (a !== undefined && b !== undefined) {
      shuffled[i] = b;
      shuffled[j] = a;
    }
  }
  return { value: shuffled, rng: current };
}
