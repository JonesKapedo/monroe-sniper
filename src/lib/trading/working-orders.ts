export type WorkingOrderType = "limit" | "stop";
export type WorkingSide = "buy" | "sell";

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
