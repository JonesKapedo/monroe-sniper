import { clip } from "./format.ts";

/** Longest wall-clock gap the desk will replay in one catch-up pass. */
export const MAX_CATCHUP_MINUTES = 240;

/** Per-call ceiling the store's `runTicks` enforces. */
export const MAX_TICK_BATCH = 240;

/**
 * How many missed minutes are due when the desk wakes up.
 *
 * The desk keeps stepping on a `scanSeconds` cadence even while the tab is
 * closed. On the first tick there is no recorded wall clock, so one minute is
 * due. After that the gap is divided down by the cadence, capped at four hours
 * of missed minutes, and clamped to a non-negative, finite integer — a clock
 * rollback (a saved `lastWall` in the future) yields 0 instead of a negative
 * count, and a non-finite timestamp yields 1 rather than `NaN`.
 */
export function dueTicks(now: number, lastWall: number, scanSeconds: number): number {
  const intervalMs = Math.max(1, scanSeconds) * 1000;
  if (!Number.isFinite(now) || !Number.isFinite(lastWall) || lastWall <= 0) return 1;
  const elapsed = now - lastWall;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  return clip(Math.floor(elapsed / intervalMs), 0, MAX_CATCHUP_MINUTES);
}

/** The ticks to actually run, bounded by both the cap and the store's batch. */
export function catchUpTicks(now: number, lastWall: number, scanSeconds: number): number {
  return Math.min(dueTicks(now, lastWall, scanSeconds), MAX_TICK_BATCH);
}
