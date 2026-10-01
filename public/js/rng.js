// mulberry32; state.rng is a 32-bit integer stored in the game state
export function next(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: (seed + 0x6d2b79f5) >>> 0 };
}
// Reducers call next(state.rng) and store the returned seed back into the new state.

// Convenience for reducers: a local generator; read the final position with r.seed().
export function makeRng(seed) {
  let s = seed >>> 0;
  const r = () => { const o = next(s); s = o.seed; return o.value; };
  r.seed = () => s;
  return r;
}
