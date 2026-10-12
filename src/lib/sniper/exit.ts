import type { BookSide, Position, ExitReason } from "./types";

export type ExitHit = { reason: ExitReason; fill: number };

/**
 * The bracket that takes a position out of the book this minute, or `null`.
 *
 * Stop and target are checked against the live price first — a stop wins if a
 * bar somehow spans both levels. The time stop is the fallback once the
 * position has been open for `timeStop` minutes, and it exits at whatever the
 * current price is. Pure: no clock, no book, just the position and the minute.
 */
export function exitHit(pos: Position, price: number, minute: number, timeStop: number): ExitHit | null {
  if (pos.side === "LONG") {
    if (price <= pos.stop) return { reason: "STOP", fill: price };
    if (price >= pos.target) return { reason: "TARGET", fill: price };
  } else {
    if (price >= pos.stop) return { reason: "STOP", fill: price };
    if (price <= pos.target) return { reason: "TARGET", fill: price };
  }
  if (minute - pos.openedAt >= timeStop) return { reason: "TIME", fill: price };
  return null;
}

/**
 * Whether a fresh signal unwinds an open position in the other direction.
 *
 * A long is closed by an actionable SELL, a short by a BUY. The action is
 * already gated on confidence by the caller, so this only reads direction.
 */
export function oppositeExit(side: BookSide, action: "BUY" | "SELL" | "FLAT"): boolean {
  if (side === "LONG") return action === "SELL";
  return action === "BUY";
}
