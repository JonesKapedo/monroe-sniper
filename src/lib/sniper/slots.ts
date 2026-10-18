/**
 * Single source of truth for concurrent open positions.
 *
 * Operator Settings.maxPositions is the authority.
 * Paper, risk-engine, stake budget, and desk autoStep all call resolveConcurrentSlots.
 */

export const MIN_CONCURRENT = 1;
export const MAX_CONCURRENT = 8;
/** Default when settings are missing or invalid. */
export const DEFAULT_CONCURRENT = 6;

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

/**
 * Round-trip cost floor for a viable ticket. A ~$0.45 execution cost against a
 * 4% profit target must stay under the 25% fee-drag guard → ≈ $45. Below this,
 * an entry is eaten by friction and the academic audit correctly rejects it.
 */
export const VIABLE_TICKET_FLOOR = 45;

/**
 * Balance-aware concurrent slots: never split the stake budget so thin that a
 * ticket falls under the fee floor. A small book trades fewer, larger positions
 * and earns more slots as equity grows — up to the operator's Settings cap.
 */
export function viableConcurrentSlots(
  settingsMax: number,
  stakeBudget: number,
  ticketFloor: number = VIABLE_TICKET_FLOOR,
): number {
  const max = clampConcurrent(settingsMax);
  if (!(stakeBudget > 0) || !(ticketFloor > 0)) return max;
  return Math.max(MIN_CONCURRENT, Math.min(max, Math.floor(stakeBudget / ticketFloor)));
}
