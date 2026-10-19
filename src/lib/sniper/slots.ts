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
 * Soft viable ticket floor for paper learning. The old hard $45 floor
 * (fee-drag guard for live) starved multi-slot books: a $500 desk with 40%
 * stake budget ($200) and 6 slots produced ~$33 equal-share tickets that
 * failed the floor and never opened. Paper must generate closed outcomes
 * so learning can run; live still applies real cost checks downstream.
 *
 * Scale: micro ≤$50 → $5 · seed/growth → $8 · scale+ → $12 · large → $25.
 * Callers that need the live fee floor pass it explicitly.
 */
export const VIABLE_TICKET_FLOOR = 12;

/** Equity-aware ticket floor used by viableConcurrentSlots when no override. */
export function viableTicketFloorFor(equityOrBudget: number): number {
  if (!(equityOrBudget > 0)) return VIABLE_TICKET_FLOOR;
  if (equityOrBudget < 50) return 5;
  if (equityOrBudget < 150) return 8;
  if (equityOrBudget < 400) return 12;
  if (equityOrBudget < 1500) return 18;
  return 25;
}

/**
 * Balance-aware concurrent slots: never split the stake budget so thin that a
 * ticket falls under the fee floor. A small book trades fewer, larger positions
 * and earns more slots as equity grows — up to the operator's Settings cap.
 */
export function viableConcurrentSlots(
  settingsMax: number,
  stakeBudget: number,
  ticketFloor?: number,
): number {
  const max = clampConcurrent(settingsMax);
  const floor = ticketFloor ?? viableTicketFloorFor(stakeBudget);
  if (!(stakeBudget > 0) || !(floor > 0)) return max;
  return Math.max(MIN_CONCURRENT, Math.min(max, Math.floor(stakeBudget / floor)));
}
