/**
 * Single source of truth for concurrent open positions.
 *
 * Operator Settings.maxPositions is the authority.
 * Paper, risk-engine, stake budget, and desk autoStep all call resolveConcurrentSlots.
 */

export const MIN_CONCURRENT = 1;
export const MAX_CONCURRENT = 8;
/** Default when settings are missing or invalid. */
export const DEFAULT_CONCURRENT = 4;

export function clampConcurrent(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return DEFAULT_CONCURRENT;
  return Math.max(MIN_CONCURRENT, Math.min(MAX_CONCURRENT, v));
}

/**
 * Resolve how many concurrent open positions the desk may hold.
 * Settings win — tier/profile caps must not silently reduce this.
 */
export function resolveConcurrentSlots(settingsMaxPositions: number | undefined | null): number {
  return clampConcurrent(settingsMaxPositions ?? DEFAULT_CONCURRENT);
}

/** Equal stake share of locked budget for one ticket. */
export function equalSlotCap(lockedBudget: number, maxConcurrent: number): number {
  const n = clampConcurrent(maxConcurrent);
  if (!(lockedBudget > 0) || n <= 0) return 0;
  return Math.round((lockedBudget / n) * 100) / 100;
}
