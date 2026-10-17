/** Fail-closed time-stop for quote-less positions (simulated; no learning). */
export function tryStaleTimeClose(args: {
  p: {
    openedAt: number;
    symbol: string;
    qty: number;
    entryPrice: number;
    mark: number;
    chain?: string;
    venue?: string;
    priceSource?: string;
    entryScore?: number;
    entryChange24h?: number;
    entryLiquidityUsd?: number;
    entryVolume24h?: number;
    pairAgeHours?: number | null;
    lastFreshMarkAt?: number;
    exitRuntime?: unknown;
  };
  plan: { timeStopMinutes?: number | null };
  now: number;
  px: number;
  tickSource?: string;
  stamp: (prefix: string) => string;
}):
  | { kind: "close"; trade: Record<string, unknown>; cashAdd: number }
  | { kind: "hold"; positionPatch: Record<string, unknown> } {
  const { p, plan, now, px, tickSource, stamp } = args;
  const heldMs = now - p.openedAt;
  const timeStopMs = (plan.timeStopMinutes ?? 480) * 60_000;
  if (heldMs >= timeStopMs) {
    const holdMinutes = Math.round(heldMs / 60_000);
    return {
      kind: "close",
      cashAdd: p.qty * px,
      trade: {
        id: stamp("tr"),
        symbol: p.symbol,
        pnl: 0,
        reason: "TIME",
        simulated: true,
        closedAt: now,
        chain: p.chain,
        venue: p.venue,
        priceSource: p.priceSource,
        markSource: tickSource ?? p.priceSource,
        entryPrice: p.entryPrice,
        exitPrice: px,
        qty: p.qty,
        openedAt: p.openedAt,
        entryScore: p.entryScore,
        entryChange24h: p.entryChange24h,
        entryLiquidityUsd: p.entryLiquidityUsd,
        entryVolume24h: p.entryVolume24h,
        pairAgeHours: p.pairAgeHours,
        holdMinutes,
      },
    };
  }
  return {
    kind: "hold",
    positionPatch: {
      mark: px,
      exitRuntime: p.exitRuntime,
      lastFreshMarkAt: p.lastFreshMarkAt,
      markSimulated: true,
    },
  };
}
