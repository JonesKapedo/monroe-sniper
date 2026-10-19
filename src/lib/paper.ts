import { assessEdge } from "./intel/emh";
import {
  buildExitPlan,
  evaluateExit,
  initExitRuntime,
  type ExitProfile,
  type ExitRuntime,
} from "./sniper/exits";
import { resolveConcurrentSlots, DEFAULT_CONCURRENT } from "./sniper/slots";

export const DEMO_START = 500;
export const STARTING_CASH = DEMO_START;
/** Fallback only — Settings via resolveConcurrentSlots is authority. */
export const MAX_POSITIONS = DEFAULT_CONCURRENT;
export const MAX_IDEA = 0.2;
export const MAX_BOOK = 0.6;
export const MIN_SCORE = 52;
export const MIN_LIQ = 10_000;
/**
 * Ceiling for the learned entry floor on unknown-depth (CEX/index) candidates.
 * A top-liquidity major prints ~64 from the flow model (0.35·100 flow +
 * 0.45·~50 momentum + 0.2·30 novelty ≈ 64), and only clears the EMH gate on a
 * move that keeps it there — so this is exactly what a strong major can
 * deliver. A learned floor above it would be unreachable no matter how good the
 * tape and the desk would starve right after a losing streak. Losses still
 * raise the bar; they just can't push it past a reachable, disciplined level.
 */
export const CEX_ENTRY_FLOOR_CEIL = 64;

/**
 * Effective entry floor for one candidate. Unknown-depth rows are capped at
 * {@link CEX_ENTRY_FLOOR_CEIL} so a learned floor from deeper venues can never
 * demand a score a major cannot produce; known-depth rows use the floor as-is.
 * Every score gate must route through this so entry, sizing and telemetry agree.
 */
export function entryFloorFor(c: { liquidityUnknown?: boolean }, floor: number): number {
  return c.liquidityUnknown === true ? Math.min(floor, CEX_ENTRY_FLOOR_CEIL) : floor;
}
export const MIN_TICKET = 5;
