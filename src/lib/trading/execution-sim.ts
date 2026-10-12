/**
 * Execution-cost simulator for paper (and future live) fills.
 * Estimates slippage, pool price impact, protocol fees, and gas so a high
 * signal score is not treated as an executable opportunity.
 */

export type ExecutionSide = "buy" | "sell";

export type ExecutionSimInput = {
  side: ExecutionSide;
  /** Desired notional in USD. */
  notionalUsd: number;
  /** Mid / reference price (USD per token). */
  midPriceUsd: number;
  /** Observed pool liquidity in USD (null if unknown). */
  liquidityUsd: number | null;
  /** Expected protocol / DEX fee rate (e.g. 0.003 = 0.3%). */
  feeRate?: number;
  /** Network gas cost in USD (estimate). */
  gasUsd?: number;
  /** Additional fixed slippage buffer (fraction). */
  slippageBuffer?: number;
  /** Maximum acceptable total cost as fraction of notional. */
  maxCostPct?: number;
};

export type ExecutionSimResult = {
  /** Effective fill price after impact + buffer. */
  fillPriceUsd: number;
  /** Estimated quantity received/sold. */
  qty: number;
  /** Notional actually used (may be reduced if impact too high). */
  effectiveNotionalUsd: number;
  /** Estimated price impact as fraction of mid. */
  impactPct: number;
  /** Protocol fee in USD. */
  feeUsd: number;
  /** Gas in USD. */
  gasUsd: number;
  /** Total friction (impact + fee + gas + buffer) as fraction of notional. */
  totalCostPct: number;
  /** Whether the trade still satisfies the cost budget. */
  acceptable: boolean;
  /** Human-readable reasons when not acceptable. */
  reasons: string[];
};

const DEFAULT_FEE = 0.003;
const DEFAULT_GAS = 2; // conservative L2-ish; caller can override for L1
const DEFAULT_BUFFER = 0.005; // 0.5%
const DEFAULT_MAX_COST = 0.04; // 4%

/**
 * Simple constant-product style impact approximation:
 * impact ≈ notional / (2 * liquidity) for small trades.
 * Caps at 50% so extreme sizes remain bounded for simulation.
 */
export function estimateImpactPct(notionalUsd: number, liquidityUsd: number | null): number {
  if (!liquidityUsd || liquidityUsd <= 0 || notionalUsd <= 0) return 0.02; // unknown → assume 2%
  const raw = notionalUsd / (2 * liquidityUsd);
  return Math.min(0.5, Math.max(0, raw));
}

/**
 * Size a position from a loss budget and stop distance.
 * lossBudgetUsd / stopFraction, then optionally capped by liquidity.
 */
export function sizeFromLossBudget(
  lossBudgetUsd: number,
  stopFraction: number,
  liquidityUsd: number | null,
  maxImpactPct = 0.03,
): number {
  if (!(lossBudgetUsd > 0) || !(stopFraction > 0)) return 0;
  let notional = lossBudgetUsd / stopFraction;
  if (liquidityUsd && liquidityUsd > 0 && maxImpactPct > 0) {
    // notional / (2 * liq) <= maxImpact ⇒ notional <= 2 * liq * maxImpact
    const impactCap = 2 * liquidityUsd * maxImpactPct;
    notional = Math.min(notional, impactCap);
  }
  return Math.max(0, notional);
}

export function simulateExecution(input: ExecutionSimInput): ExecutionSimResult {
  const feeRate = input.feeRate ?? DEFAULT_FEE;
  const gasUsd = input.gasUsd ?? DEFAULT_GAS;
  const buffer = input.slippageBuffer ?? DEFAULT_BUFFER;
  const maxCost = input.maxCostPct ?? DEFAULT_MAX_COST;
  const mid = input.midPriceUsd;
  const notional = Math.max(0, input.notionalUsd);
  const reasons: string[] = [];

  if (!(mid > 0) || !(notional > 0)) {
    return {
      fillPriceUsd: mid || 0,
      qty: 0,
      effectiveNotionalUsd: 0,
      impactPct: 0,
      feeUsd: 0,
      gasUsd,
      totalCostPct: 1,
      acceptable: false,
      reasons: ["Invalid mid price or notional"],
    };
  }

  const impactPct = estimateImpactPct(notional, input.liquidityUsd);
  const feeUsd = notional * feeRate;
  // Directional fill: buy pays more, sell receives less
  const slip = impactPct + buffer;
  const fillPriceUsd =
    input.side === "buy" ? mid * (1 + slip) : mid * (1 - slip);
  const qty = notional / fillPriceUsd;
  const totalCostUsd = notional * impactPct + feeUsd + gasUsd + notional * buffer;
  const totalCostPct = notional > 0 ? totalCostUsd / notional : 1;
  const acceptable = totalCostPct <= maxCost;

  if (!acceptable) {
    reasons.push(
      `Total cost ${(totalCostPct * 100).toFixed(2)}% exceeds max ${(maxCost * 100).toFixed(1)}%`,
    );
  }
  if (impactPct > 0.05) {
    reasons.push(`High estimated impact ${(impactPct * 100).toFixed(2)}%`);
  }
  if (!input.liquidityUsd || input.liquidityUsd <= 0) {
    reasons.push("Unknown liquidity — impact assumed 2%");
  }

  return {
    fillPriceUsd,
    qty,
    effectiveNotionalUsd: notional,
    impactPct,
    feeUsd,
    gasUsd,
    totalCostPct,
    acceptable,
    reasons,
  };
}
