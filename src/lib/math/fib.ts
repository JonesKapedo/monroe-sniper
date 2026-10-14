/**
 * Fibonacci price geometry: retracements, extensions, and time delays.
 * Pure functions — the risk engine snaps turbo brackets to these levels and
 * spaces re-entries on fib minutes.
 */

export const FIB_RETRACE = [0.236, 0.382, 0.5, 0.618, 0.786] as const;
export const FIB_EXTEND = [1.272, 1.618, 2.618] as const;
/** Re-entry delays (minutes) after consecutive stops on one symbol. */
export const FIB_DELAYS_MIN = [3, 5, 8, 13, 21] as const;

export type FibLevel = { ratio: number; price: number };

/** Retracement levels of a swing, ordered high → low. */
export function fibRetracements(high: number, low: number): FibLevel[] {
  const top = Math.max(high, low);
  const bottom = Math.min(high, low);
  const range = top - bottom;
  if (!(range > 0)) return [];
  return FIB_RETRACE.map((ratio) => ({ ratio, price: top - range * ratio }));
}

/** Extension targets above an entry given its stop distance. */
export function fibExtensions(entry: number, stopDistance: number): FibLevel[] {
  if (!(entry > 0) || !(stopDistance > 0)) return [];
  return FIB_EXTEND.map((ratio) => ({ ratio, price: entry + stopDistance * ratio }));
}

/** Nearest retracement level to a price, with its distance as a fraction. */
export function nearestFibLevel(
  price: number,
  high: number,
  low: number,
): (FibLevel & { distancePct: number }) | null {
  if (!(price > 0)) return null;
  const levels = fibRetracements(high, low);
  if (!levels.length) return null;
  let best = levels[0];
  let bestDist = Math.abs(price - best.price) / price;
  for (const level of levels.slice(1)) {
    const dist = Math.abs(price - level.price) / price;
    if (dist < bestDist) {
      best = level;
      bestDist = dist;
    }
  }
  return { ...best, distancePct: bestDist };
}

/**
 * Snap a bracket price to the nearest fib level when it sits within
 * maxSnapPct — otherwise leave it. Keeps stops/targets on levels the market
 * respects instead of arbitrary decimals.
 */
export function snapToFib(price: number, high: number, low: number, maxSnapPct = 0.0015): number {
  const near = nearestFibLevel(price, high, low);
  if (!near || near.distancePct > maxSnapPct) return price;
  return near.price;
}

/** Fib-spaced re-entry delay after `consecutiveStops` on one symbol. */
export function fibReentryDelayMin(consecutiveStops: number): number {
  if (!(consecutiveStops > 0)) return 0;
  return FIB_DELAYS_MIN[Math.min(consecutiveStops, FIB_DELAYS_MIN.length) - 1];
}
