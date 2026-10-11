export function nextRand(seed: number): [number, number] {
  let a = seed >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, a >>> 0];
}

export function nextGaussian(seed: number): [number, number] {
  const [u1, s1] = nextRand(seed);
  const [u2, s2] = nextRand(s1);
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-9))) * Math.cos(Math.PI * 2 * u2);
  return [z, s2];
}

export function takeId(seed: number, prefix: string): [string, number] {
  const [r, s] = nextRand(seed);
  return [`${prefix}-${s.toString(36)}-${Math.floor(r * 1e6).toString(36)}`, s];
}
