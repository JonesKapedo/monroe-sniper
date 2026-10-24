export type WorkingOrderType = "limit" | "stop";
export type WorkingSide = "buy" | "sell";

/**
 * Default time-to-live for resting limit/stop orders. A delayed order that
 * never prints its trigger occupies a slot and its reserved stake forever;
 * after this many minutes it is cancelled so the stake returns to the book.
 */
export const DEFAULT_ORDER_TTL_MINUTES = 20;

/**
 * Whether a resting limit/stop order fires when the tape prints `price`.
 * Buy limit fills at or below its limit; a buy stop at or above. Sells mirror.
 * Non-finite inputs never trigger.
 */
export function shouldTrigger(
  type: WorkingOrderType,
  side: WorkingSide,
  trigger: number,
  price: number,
): boolean {
  if (!Number.isFinite(price) || !Number.isFinite(trigger)) return false;
  if (side === "buy") {
    return type === "limit" ? price <= trigger : price >= trigger;
  }
  return type === "limit" ? price >= trigger : price <= trigger;
}

/**
 * Whether a resting order has outlived its time-to-live. An order that has
 * been WORKING longer than `ttlMinutes` without filling is stale — the quote
 * never reached its trigger — and should be cancelled so its reserved stake
 * frees back to the book. Non-finite inputs never expire.
 */
export function shouldExpire(
  createdAt: number,
  now: number,
  ttlMinutes: number = DEFAULT_ORDER_TTL_MINUTES,
): boolean {
  if (!Number.isFinite(createdAt) || !Number.isFinite(now) || !(ttlMinutes > 0)) return false;
  return now - createdAt >= ttlMinutes * 60_000;
}
