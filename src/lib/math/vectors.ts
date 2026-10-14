/**
 * Vector market geometry: setups and regimes as feature vectors.
 * Cosine similarity answers "does this resemble past winners?" and the dot
 * product answers "am I already holding this trade?". All inputs are small
 * plain arrays — O(n) over a handful of positions, cached per evaluation.
 */

export type SetupVector = {
  /** 24h momentum clamped to [-1, 1]. */
  momentum: number;
  /** Volume-to-liquidity activity clamped to [0, 1]. */
  activity: number;
  /** Signal conviction (score) in [0, 1]. */
  conviction: number;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));

export function setupVector(input: {
  change24h?: number | null;
  volume24h?: number | null;
  liquidityUsd?: number | null;
  score?: number | null;
}): SetupVector {
  const momentum = clamp((input.change24h ?? 0) / 100, -1, 1);
  const liq = input.liquidityUsd ?? 0;
  const activity = liq > 0 ? clamp((input.volume24h ?? 0) / liq / 2, 0, 1) : 0.25;
  return { momentum, activity, conviction: clamp((input.score ?? 50) / 100, 0, 1) };
}

function asArray(v: SetupVector): [number, number, number] {
  return [v.momentum, v.activity, v.conviction];
}

/** Cosine similarity in [-1, 1]; 1 = identical direction. */
export function cosineSimilarity(a: SetupVector, b: SetupVector): number {
  const [a1, a2, a3] = asArray(a);
  const [b1, b2, b3] = asArray(b);
  const dot = a1 * b1 + a2 * b2 + a3 * b3;
  const mag = Math.sqrt(a1 * a1 + a2 * a2 + a3 * a3) * Math.sqrt(b1 * b1 + b2 * b2 + b3 * b3);
  if (!(mag > 0)) return 0;
  return Math.max(-1, Math.min(1, dot / mag));
}

/**
 * Mean similarity of a setup to past winners, mapped to [0, 1].
 * Empty winner history is neutral (0.5) — never a veto.
 */
export function winnerResemblance(current: SetupVector, winners: SetupVector[]): number {
  if (!winners.length) return 0.5;
  const mean = winners.reduce((s, w) => s + cosineSimilarity(current, w), 0) / winners.length;
  return (mean + 1) / 2;
}

/**
 * True when a candidate is essentially a duplicate of an open position
 * (same market character). Guards against stacking correlated bets.
 */
export function isCorrelatedDuplicate(
  candidate: SetupVector,
  open: SetupVector[],
  threshold = 0.985,
): boolean {
  return open.some((v) => cosineSimilarity(candidate, v) >= threshold);
}
