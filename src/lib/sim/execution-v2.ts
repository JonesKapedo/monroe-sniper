/**
 * Execution Simulator v2 — realistic cost model (Blueprint I4).
 *
 * Realized P&L must include venue fees, depth-based price impact, and
 * slippage so the adaptive floors learn NET-of-cost edges. The legacy
 * cosmetic slippageBps constants on the tape UI stay untouched.
 *
 * Pure functions, no I/O.
 */

export type FeeVenue = "cex" | "dex" | "perp";

export interface FillQuoteInput {
  venue: FeeVenue;
  /** Intended trade notional in USD. */
  notionalUsd: number;
  /** Pool/liquidity depth in USD. depth 0 = CEX-style, use flat model. */
  liquidityUsd?: number;
  /** True when depth is unpublished (CEX majors) — flat cost model. */
  liquidityUnknown?: boolean;
  /** Taker (default) or maker fill. */
  taker?: boolean;
}

export interface FillQuote {
  /** Effective average fill price relative to mid, e.g. 0.0031 = +0.31%. */
  costPct: number;
  /** Cost in USD for this notional. */
  feeUsd: number;
  /** Impact share of costPct, for diagnostics. */
  impactPct: number;
  venue: FeeVenue;
}

/** Base taker fee by venue. Maker rebate modeled as a reduced fee. */
const VENUE_TAKER_FEE_PCT: Record<FeeVenue, number> = {
  cex: 0.001, // 0.10% — Binance spot taker
  dex: 0.003, // 0.30% — Raydium/Uniswap v3 typical
  perp: 0.00045, // 0.045% — Hyperliquid taker
};

/** Round-trip multiplier: entries and exits both pay the fee. */
export function venueFee(venue: FeeVenue, taker = true): number {
  const base = VENUE_TAKER_FEE_PCT[venue];
  return taker ? base : base * 0.2;
}

/**
 * Square-root depth impact model. impact = k × sqrt(notional / depth),
 * clamped to a sane ceiling so a thin pool cannot produce infinite slippage
 * (the position would simply be sized down by the risk engine first).
 */
export function priceImpactPct(notionalUsd: number, liquidityUsd: number): number {
  if (!(liquidityUsd > 0) || !(notionalUsd > 0)) return 0;
  const k = 0.08; // empirical curve coefficient
  const ratio = Math.min(1, notionalUsd / liquidityUsd);
  return Math.min(0.05, k * Math.sqrt(ratio));
}

/**
 * Full entry cost quote: fee + impact + latency slippage allowance.
 * Unknown-depth CEX majors get the flat model (fee + small fixed slip).
 */
export function quoteFill(input: FillQuoteInput): FillQuote {
  const taker = input.taker ?? true;
  const fee = venueFee(input.venue, taker);
  const unknown = input.liquidityUnknown === true || !(input.liquidityUsd! > 0);

  if (unknown) {
    // CEX majors: depth unpublished — flat model with fixed slippage.
    return { costPct: fee + 0.0008, feeUsd: fee * input.notionalUsd, impactPct: 0, venue: input.venue };
  }

  const impact = priceImpactPct(input.notionalUsd, input.liquidityUsd!);
  const slip = 0.0004; // latency/microstructure allowance
  const costPct = fee + impact + slip;
  return {
    costPct,
    feeUsd: costPct * input.notionalUsd,
    impactPct: impact,
    venue: input.venue,
  };
}

/** Exit costs equal entry costs on the remaining (scaled) notional. */
export function quoteExitFill(input: FillQuoteInput): FillQuote {
  return quoteFill(input);
}

/**
 * Net realized P&L for one tranche, gross → net. Fees applied per side.
 * fundingCostUsd covers perp positions (accumulated funding over the hold).
 */
export function netPnl(args: {
  grossPnlUsd: number;
  entryNotionalUsd: number;
  exitNotionalUsd: number;
  venue: FeeVenue;
  liquidityUsd?: number;
  liquidityUnknown?: boolean;
  fundingCostUsd?: number;
}): number {
  const entryCost = quoteFill({
    venue: args.venue,
    notionalUsd: args.entryNotionalUsd,
    liquidityUsd: args.liquidityUsd,
    liquidityUnknown: args.liquidityUnknown,
  }).feeUsd;
  const exitCost = quoteExitFill({
    venue: args.venue,
    notionalUsd: args.exitNotionalUsd,
    liquidityUsd: args.liquidityUsd,
    liquidityUnknown: args.liquidityUnknown,
  }).feeUsd;
  const funding = args.fundingCostUsd ?? 0;
  return args.grossPnlUsd - entryCost - exitCost - funding;
}

/**
 * Cumulative funding bleed for perp holds — exit the position when this
 * exceeds 0.75× the expected edge (wired by the desk, threshold in the
 * exit profile).
 */
export function fundingBleedUsd(
  entryNotionalUsd: number,
  fundingRatePerHour: number,
  heldHours: number,
): number {
  if (!(heldHours > 0) || !(entryNotionalUsd > 0)) return 0;
  return Math.max(0, entryNotionalUsd * fundingRatePerHour * heldHours);
}

/**
 * Breakeven buffer in price units for the exit engine: costs must be paid
 * twice (in and out), so the +1R breakeven stop carries a cost buffer.
 */
export function breakevenBufferPriceUnits(
  riskPerUnit: number,
  venue: FeeVenue,
  liquidityUsd?: number,
  liquidityUnknown?: boolean,
): number {
  const cost = quoteFill({ venue, notionalUsd: 1000, liquidityUsd, liquidityUnknown }).costPct;
  // Rough mapping: cost fraction of a typical notional scales the buffer.
  return riskPerUnit * cost * 4;
}
