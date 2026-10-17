/**
 * Dynamic Tier Configuration System
 * 8 balance tiers with graduated risk parameters for sustainable wealth creation
 */

export type TierName =
  | "micro"
  | "seed"
  | "growth"
  | "scale"
  | "accelerate"
  | "momentum"
  | "professional"
  | "institutional";

export interface TierConfig {
  name: TierName;
  minBalance: number;
  maxBalance: number | null;
  maxRiskPerTrade: number;      // % of equity per trade
  maxPositions: number;
  maxPortfolioExposure: number; // % of equity staked across ALL open positions (hard budget)
  stopLossPct: number;          // ATR multiplier or fixed %
  stopLossType: "fixed" | "atr";
  atrMultiplier: number;
  leverageCap: number;          // max leverage
  minNotional: number;          // minimum position size
  compoundingAllowed: boolean;
  description: string;
}

export const TIER_CONFIGS: Record<TierName, TierConfig> = {
  micro: {
    name: "micro",
    minBalance: 0,
    maxBalance: 50,
    maxRiskPerTrade: 0.01,
    maxPositions: 3,
    maxPortfolioExposure: 0.45,
    stopLossPct: 0.08,
    stopLossType: "fixed",
    atrMultiplier: 2.5,
    leverageCap: 1,
    minNotional: 1.5,
    compoundingAllowed: true,
    description: "Micro multi-slot: up to 3 tickets, 45% staked max — never all-in one trade",
  },
  seed: {
    name: "seed",
    minBalance: 50,
    maxBalance: 100,
    maxRiskPerTrade: 0.012,
    maxPositions: 3,
    maxPortfolioExposure: 0.40,
    stopLossPct: 0.06,
    stopLossType: "atr",
    atrMultiplier: 2.0,
    leverageCap: 1,
    minNotional: 3,
    compoundingAllowed: true,
    description: "Seed multi-slot: 3 positions, 40% exposure, ATR stops",
  },
  growth: {
    name: "growth",
    minBalance: 100,
    maxBalance: 250,
    maxRiskPerTrade: 0.0125,
    maxPositions: 3,
    maxPortfolioExposure: 0.40,
    stopLossPct: 0.05,
    stopLossType: "atr",
    atrMultiplier: 1.8,
    leverageCap: 1,
    minNotional: 8,
    compoundingAllowed: true,
    description: "Growth multi-slot: 3 positions, 40% exposure",
  },
  scale: {
    name: "scale",
    minBalance: 250,
    maxBalance: 500,
    maxRiskPerTrade: 0.0125,     // 1.25%
    maxPositions: 3,
    maxPortfolioExposure: 0.40,  // 40%
    stopLossPct: 0.04,           // 4% ATR
    stopLossType: "atr",
    atrMultiplier: 1.6,
    leverageCap: 1,
    minNotional: 25,
    compoundingAllowed: true,
    description: "Position scaling - 35% exposure, tighter stops",
  },
  accelerate: {
    name: "accelerate",
    minBalance: 500,
    maxBalance: 1000,
    maxRiskPerTrade: 0.015,      // 1.5%
    maxPositions: 4,
    maxPortfolioExposure: 0.50,  // 50%
    stopLossPct: 0.035,          // 3.5% ATR
    stopLossType: "atr",
    atrMultiplier: 1.4,
    leverageCap: 2,
    minNotional: 25,
    compoundingAllowed: true,
    description: "Leverage unlock - 2x cap, 3 positions, 45% exposure",
  },
  momentum: {
    name: "momentum",
    minBalance: 1000,
    maxBalance: 5000,
    maxRiskPerTrade: 0.02,       // 2.0%
    maxPositions: 3,
    maxPortfolioExposure: 0.55,  // 55%
    stopLossPct: 0.03,           // 3% ATR
    stopLossType: "atr",
    atrMultiplier: 1.3,
    leverageCap: 2,
    minNotional: 100,
    compoundingAllowed: true,
    description: "Momentum scaling - 55% exposure, 3% ATR stops",
  },
  professional: {
    name: "professional",
    minBalance: 5000,
    maxBalance: 10000,
    maxRiskPerTrade: 0.025,      // 2.5%
    maxPositions: 4,
    maxPortfolioExposure: 0.60,  // 60%
    stopLossPct: 0.025,          // 2.5% ATR
    stopLossType: "atr",
    atrMultiplier: 1.2,
    leverageCap: 3,
    minNotional: 250,
    compoundingAllowed: true,
    description: "Professional tier - 3x leverage, 4 positions, 60% exposure",
  },
  institutional: {
    name: "institutional",
    minBalance: 10000,
    maxBalance: null,
    maxRiskPerTrade: 0.03,       // 3.0%
    maxPositions: 4,
    maxPortfolioExposure: 0.65,  // 65%
    stopLossPct: 0.02,           // 2% ATR
    stopLossType: "atr",
    atrMultiplier: 1.1,
    leverageCap: 3,
    minNotional: 500,
    compoundingAllowed: true,
    description: "Institutional scale - max 65% exposure, tightest stops",
  },
};

export const TIER_ORDER: TierName[] = [
  "micro",
  "seed",
  "growth",
  "scale",
  "accelerate",
  "momentum",
  "professional",
  "institutional",
];

/**
 * Detect tier from current equity with 5% hysteresis buffer
 * Prevents flickering at tier boundaries
 */
export function detectTier(
  equity: number,
  previousTier: TierName | null = null
): TierName {
  // Check from highest to lowest for proper boundary handling
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i];
    const config = TIER_CONFIGS[tier];
    if (equity >= config.minBalance) {
      // Hysteresis: if we were in a higher tier, require 5% buffer to drop
      if (previousTier && TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(previousTier)) {
        const higherConfig = TIER_CONFIGS[previousTier];
        const dropThreshold = higherConfig.minBalance * 0.95;
        if (equity >= dropThreshold) {
          return previousTier;
        }
      }
      return tier;
    }
  }
  return "micro";
}

/**
 * Get tier config by name
 */
export function getTierConfig(tier: TierName): TierConfig {
  return TIER_CONFIGS[tier];
}

/**
 * Get tier badge color for UI
 */
export function getTierColor(tier: TierName): string {
  const colors: Record<TierName, string> = {
    micro: "text-red-400",
    seed: "text-amber-400",
    growth: "text-yellow-400",
    scale: "text-emerald-400",
    accelerate: "text-blue-400",
    momentum: "text-purple-400",
    professional: "text-amber-300",
    institutional: "text-gray-300",
  };
  return colors[tier];
}

/**
 * Get tier badge background for UI
 */
export function getTierBg(tier: TierName): string {
  const bgs: Record<TierName, string> = {
    micro: "bg-red-500/20",
    seed: "bg-amber-500/20",
    growth: "bg-yellow-500/20",
    scale: "bg-emerald-500/20",
    accelerate: "bg-blue-500/20",
    momentum: "bg-purple-500/20",
    professional: "bg-amber-500/20",
    institutional: "bg-gray-500/20",
  };
  return bgs[tier];
}

/**
 * Calculate position size using tier parameters + dynamic factors
 */
export interface SizingInput {
  equity: number;
  tier: TierConfig;
  atrPct: number;              // ATR / price (e.g., 0.04 = 4%)
  conviction: number;          // 0.5 - 1.5 from signal quality
  stopLossPct?: number;        // Override stop distance
  currentExposure?: number;    // Current portfolio exposure
}

export function calculatePositionSize(input: SizingInput): number {
  const { equity, tier, atrPct, conviction, stopLossPct, currentExposure = 0 } = input;
  
  // Base risk = equity × maxRiskPerTrade
  const baseRisk = equity * tier.maxRiskPerTrade;
  
  // Conviction scaling (0.5 to 1.5)
  const convictionAdj = Math.min(1.5, Math.max(0.5, conviction));
  
  // Volatility normalization (target ~3% stop equivalent)
  // If asset is more volatile (higher ATR), reduce size
  const targetStop = 0.03;
  const effectiveStop = stopLossPct ?? (atrPct * tier.atrMultiplier);
  const volAdj = Math.min(2.0, Math.max(0.3, targetStop / effectiveStop));
  
  // Raw notional from risk budget
  const notional = (baseRisk / effectiveStop) * convictionAdj * volAdj;
  
  // Tier ceilings
  const maxNotionalPerPosition = equity * tier.maxPortfolioExposure / tier.maxPositions;
  const maxNotionalByRisk = equity * tier.maxRiskPerTrade * 5; // 5x risk budget ceiling
  
  let result = Math.min(notional, maxNotionalPerPosition, maxNotionalByRisk);
  
  // Ensure minimum notional
  result = Math.max(result, tier.minNotional);
  
  // Don't exceed available equity
  result = Math.min(result, equity * 0.95);
  
  // Respect current exposure limit
  const remainingCapacity = equity * tier.maxPortfolioExposure - currentExposure;
  if (remainingCapacity <= 0) return 0;
  result = Math.min(result, remainingCapacity);
  
  return Math.round(result * 100) / 100;
}

/**
 * Calculate stop loss price based on tier config
 */
export function calculateStopPrice(
  entryPrice: number,
  side: "LONG" | "SHORT",
  tier: TierConfig,
  atrPct: number
): number {
  const stopPct = tier.stopLossType === "fixed" 
    ? tier.stopLossPct 
    : atrPct * tier.atrMultiplier;
  
  if (side === "LONG") {
    return entryPrice * (1 - stopPct);
  } else {
    return entryPrice * (1 + stopPct);
  }
}

/**
 * Calculate target price based on tier config and R:R
 */
export function calculateTargetPrice(
  entryPrice: number,
  side: "LONG" | "SHORT",
  stopPrice: number,
  rewardMultiple: number = 2.5
): number {
  const risk = Math.abs(entryPrice - stopPrice);
  if (side === "LONG") {
    return entryPrice + risk * rewardMultiple;
  } else {
    return entryPrice - risk * rewardMultiple;
  }
}

/**
 * Tier display helpers
 */
export function getTierDisplayName(tier: TierName): string {
  const names: Record<TierName, string> = {
    micro: "Micro (≤$50)",
    seed: "Seed ($50-$100)",
    growth: "Growth ($100-$250)",
    scale: "Scale ($250-$500)",
    accelerate: "Accelerate ($500-$1K)",
    momentum: "Momentum ($1K-$5K)",
    professional: "Professional ($5K-$10K)",
    institutional: "Institutional (>$10K)",
  };
  return names[tier];
}

export function getTierShortName(tier: TierName): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Portfolio stake budget — the SINGLE source of truth for how much of the
 * book may sit in open positions at once. Small books are guarded hardest:
 * a $50 book may never have more than $10 staked across ALL positions.
 */
export function stakeBudgetFor(equityValue: number): {
  budget: number;
  pct: number;
  tier: TierName;
} {
  const tier = detectTier(Math.max(0, equityValue));
  const config = TIER_CONFIGS[tier];
  const budget = Math.max(0, Math.round(equityValue * config.maxPortfolioExposure * 100) / 100);
  return { budget, pct: config.maxPortfolioExposure, tier };
}

export interface StakeBudgetInput {
  equity: number;
  tier: TierConfig;
  /** Current staked total across open positions (use exposure(book)). */
  currentExposure: number;
  /** Risk-sized notional from the sizing model, before budget rules.
   *  NOTE: the desk applies the equity-guard riskMultiplier to this value
   *  BEFORE calling in (verdict.notional * guardRisk), so a 0.5× guard
   *  arrives here as an already-halved notional. */
  riskNotional: number;
  /** Expected upside of THIS position as a fraction, e.g. 0.06 = +6% target. */
  targetPct: number;
  /** Open positions already held — reserve stake for remaining slots. */
  openPositionCount?: number;
}

export interface StakeBudgetResult {
  notional: number;
  blocked: boolean;
  reason: string;
  budget: number;
  remaining: number;
  targetScale: number;
}

/** Number of consecutive admissible tickets the budget must always reserve (I1). */
export const FLOW_RESERVE_TICKETS = 3;

/**
 * Split the stakable budget proportionally to each position's target.
 * Bigger targets earn a bigger share of the remaining budget (anchored to a
 * 6% reference target, clamped 0.5x–1.5x), but the portfolio total can never
 * exceed the tier budget — so losses can never take the whole book.
 *
 * Flow reservation (Architecture Blueprint v2, invariant I1): whenever the
 * desk is not hard-halted, at least 3 consecutive entries must stay
 * admissible. Two mechanisms enforce that here:
 *   1. perSlotCap divides the remaining stake by min(slotsLeft, 3) so up to
 *      three tickets can fill concurrently instead of the first trade
 *      eating the whole budget.
 *   2. If even the guard-scaled minimum floor would starve 3 tickets
 *      (remaining < 3 × floor), the floor adapts down to remaining/3 —
 *      never below $5 — with a "flow reserve" note in the rejection reason.
 *      Genuinely insufficient capital (remaining < $5) is the only allowed
 *      block, and it says so explicitly.
 */
export function applyStakeBudget(input: StakeBudgetInput): StakeBudgetResult {
  const { equity, tier, currentExposure, riskNotional, targetPct, openPositionCount = 0 } = input;
  const budget = Math.max(0, Math.round(equity * tier.maxPortfolioExposure * 100) / 100);
  const remaining = Math.max(0, Math.round((budget - currentExposure) * 100) / 100);
  // The tier minimum ticket must clamp to the (guard-scaled) risk notional:
  // after a REDUCE_RISK the desk halves tickets, and an unscaled floor would
  // reject every shrunk ticket forever — REDUCE_RISK must shrink entries,
  // never deadlock them. Full-guard (riskNotional >= floor) keeps the floor.
  const absTicketFloor = equity < 30 ? 1 : equity < 100 ? 2 : 5;
  const baseFloor = Math.max(
    absTicketFloor,
    Math.round(Math.min(tier.minNotional, riskNotional) * 100) / 100,
  );
  // I1 flow reserve: adapt the floor so 3 consecutive tickets stay admissible.
  let floor = baseFloor;
  let flowReserve = false;
  if (remaining > 0 && remaining < baseFloor * FLOW_RESERVE_TICKETS) {
    const absFloor = equity < 30 ? 1 : equity < 100 ? 2 : 5;
    const flowFloor = Math.max(absFloor, Math.round((remaining / FLOW_RESERVE_TICKETS) * 100) / 100);
    if (flowFloor < baseFloor) {
      floor = flowFloor;
      flowReserve = true;
    }
  }
  if (remaining < floor) {
    return {
      notional: 0,
      blocked: true,
      reason: `Stake budget exhausted: $${currentExposure.toFixed(2)} of $${budget.toFixed(2)} already staked`,
      budget,
      remaining,
      targetScale: 1,
    };
  }
  // Reserve equal slices so concurrent positions can fill (don't stuff one trade).
  const slotsLeft = Math.max(1, tier.maxPositions - openPositionCount);
  // Single-slot tiers (micro/seed, maxPositions 1): slotsLeft is always 1,
  // which handed the whole remaining budget to the first trade and starved
  // every later signal. Cap a lone slot at 60% of remaining stake instead.
  // Multi-slot tiers split by min(slotsLeft, 3) so THREE tickets can fill
  // concurrently — the flow guarantee.
  const perSlotCap =
    slotsLeft === 1 ? remaining * 0.6 : remaining / Math.min(slotsLeft, FLOW_RESERVE_TICKETS);
  const targetScale = Math.min(1.5, Math.max(0.5, targetPct / 0.06));
  const notional = Math.max(
    0,
    Math.min(riskNotional * targetScale, perSlotCap, remaining, Math.max(0, equity * 0.95)),
  );
  const rounded = Math.round(notional * 100) / 100;
  if (rounded < floor) {
    return {
      notional: 0,
      blocked: true,
      reason: `Budget share $${rounded.toFixed(2)} below $${floor.toFixed(2)} minimum ticket${flowReserve ? " (flow reserve active — floor adapted so 3 consecutive tickets stay admissible)" : ""}`,
      budget,
      remaining,
      targetScale,
    };
  }
  return { notional: rounded, blocked: false, reason: "", budget, remaining, targetScale };
}
