import { clip } from "./format.ts";

/**
 * Per-call ceiling, counted in TICKS — not minutes. At the default 2s cadence
 * 240 ticks replay 8 minutes of sim; anything older is dropped, never replayed.
 */
export const MAX_CATCHUP_TICKS = 240;

/** Per-call ceiling the store's `runTicks` enforces. */
export const MAX_TICK_BATCH = 240;

/**
 * How many missed ticks are due when the desk wakes up.
 *
 * The desk keeps stepping on a `scanSeconds` cadence even while the tab is
 * closed. On the first tick there is no recorded wall clock, so one tick is
 * due. After that the gap is divided down by the cadence, capped at
 * MAX_CATCHUP_TICKS, and clamped to a non-negative, finite integer — a clock
 * rollback (a saved `lastWall` in the future) yields 0 instead of a negative
 * count, and a non-finite timestamp yields 1 rather than `NaN`.
 */
export function dueTicks(now: number, lastWall: number, scanSeconds: number): number {
  const intervalMs = Math.max(1, scanSeconds) * 1000;
  if (!Number.isFinite(now) || !Number.isFinite(lastWall) || lastWall <= 0) return 1;
  const elapsed = now - lastWall;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  return clip(Math.floor(elapsed / intervalMs), 0, MAX_CATCHUP_TICKS);
}

/** The ticks to actually run, bounded by both the cap and the store's batch. */
export function catchUpTicks(now: number, lastWall: number, scanSeconds: number): number {
  return Math.min(dueTicks(now, lastWall, scanSeconds), MAX_TICK_BATCH);
}

/**
 * Wall-clock milliseconds of sim history discarded by the cap — surfaced in
 * the log so a dropped gap is never mistaken for a replayed one.
 */
export function unreplayedMs(
  now: number,
  lastWall: number,
  scanSeconds: number,
  ranTicks: number,
): number {
  if (!Number.isFinite(now) || !Number.isFinite(lastWall) || lastWall <= 0) return 0;
  const elapsed = now - lastWall;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  return Math.max(0, elapsed - ranTicks * Math.max(1, scanSeconds) * 1000);
}
