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
  maxPortfolioExposure: number; // % of equity at risk simultaneously
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
    maxRiskPerTrade: 0.005,      // 0.5%
    maxPositions: 1,
    maxPortfolioExposure: 0.25,  // 25%
    stopLossPct: 0.08,           // 8% fixed
    stopLossType: "fixed",
    atrMultiplier: 2.5,
    leverageCap: 1,
    minNotional: 5,
    compoundingAllowed: true,
    description: "Guarded growth - single position, wide stops, spot only",
  },
  seed: {
    name: "seed",
    minBalance: 50,
    maxBalance: 100,
    maxRiskPerTrade: 0.0075,     // 0.75%
    maxPositions: 1,
    maxPortfolioExposure: 0.30,  // 30%
    stopLossPct: 0.06,           // 6% ATR-based
    stopLossType: "atr",
    atrMultiplier: 2.0,
    leverageCap: 1,
    minNotional: 10,
    compoundingAllowed: true,
    description: "Early compounding - ATR stops, single focused position",
  },
  growth: {
    name: "growth",
    minBalance: 100,
    maxBalance: 250,
    maxRiskPerTrade: 0.01,       // 1.0%
    maxPositions: 2,
    maxPortfolioExposure: 0.40,  // 40%
    stopLossPct: 0.05,           // 5% ATR
    stopLossType: "atr",
    atrMultiplier: 1.8,
    leverageCap: 1,
    minNotional: 15,
    compoundingAllowed: true,
    description: "Dual-position scaling - diversification begins",
  },
  scale: {
    name: "scale",
    minBalance: 250,
    maxBalance: 500,
    maxRiskPerTrade: 0.0125,     // 1.25%
    maxPositions: 2,
    maxPortfolioExposure: 0.50,  // 50%
    stopLossPct: 0.04,           // 4% ATR
    stopLossType: "atr",
    atrMultiplier: 1.6,
    leverageCap: 1,
    minNotional: 25,
    compoundingAllowed: true,
    description: "Position scaling - 50% exposure, tighter stops",
  },
  accelerate: {
    name: "accelerate",
    minBalance: 500,
    maxBalance: 1000,
    maxRiskPerTrade: 0.015,      // 1.5%
    maxPositions: 3,
    maxPortfolioExposure: 0.60,  // 60%
    stopLossPct: 0.035,          // 3.5% ATR
    stopLossType: "atr",
    atrMultiplier: 1.4,
    leverageCap: 2,
    minNotional: 50,
    compoundingAllowed: true,
    description: "Leverage unlock - 2x cap, 3 positions, 60% exposure",
  },
  momentum: {
    name: "momentum",
    minBalance: 1000,
    maxBalance: 5000,
    maxRiskPerTrade: 0.02,       // 2.0%
    maxPositions: 3,
    maxPortfolioExposure: 0.70,  // 70%
    stopLossPct: 0.03,           // 3% ATR
    stopLossType: "atr",
    atrMultiplier: 1.3,
    leverageCap: 2,
    minNotional: 100,
    compoundingAllowed: true,
    description: "Momentum scaling - 70% exposure, 3% ATR stops",
  },
  professional: {
    name: "professional",
    minBalance: 5000,
    maxBalance: 10000,
    maxRiskPerTrade: 0.025,      // 2.5%
    maxPositions: 4,
    maxPortfolioExposure: 0.75,  // 75%
    stopLossPct: 0.025,          // 2.5% ATR
    stopLossType: "atr",
    atrMultiplier: 1.2,
    leverageCap: 3,
    minNotional: 250,
    compoundingAllowed: true,
    description: "Professional tier - 3x leverage, 4 positions, 75% exposure",
  },
  institutional: {
    name: "institutional",
    minBalance: 10000,
    maxBalance: null,
    maxRiskPerTrade: 0.03,       // 3.0%
    maxPositions: 4,
    maxPortfolioExposure: 0.80,  // 80%
    stopLossPct: 0.02,           // 2% ATR
    stopLossType: "atr",
    atrMultiplier: 1.1,
    leverageCap: 3,
    minNotional: 500,
    compoundingAllowed: true,
    description: "Institutional scale - max exposure, tightest stops",
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