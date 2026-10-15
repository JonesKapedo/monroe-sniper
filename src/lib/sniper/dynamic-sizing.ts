/**
 * Dynamic Position Sizing Engine
 * Combines tier config, ATR volatility, conviction, and equity guard state
 * to calculate optimal position sizes for sustainable growth
 */

import { TierConfig, calculatePositionSize as tierCalculateSize, calculateStopPrice, calculateTargetPrice, SizingInput } from "./tier-config";
import { EquityGuardState } from "./equity-guard";

export interface SizingContext {
  equity: number;
  tier: TierConfig;
  atrPct: number;
  conviction: number;
  stopLossPct?: number;
  currentExposure: number;
  equityGuard: EquityGuardState;
}

export interface SizingResult {
  notional: number;
  qty: number;
  stopPrice: number;
  targetPrice: number;
  riskRewardRatio: number;
  riskAmount: number;
  maxNotionalAllowed: number;
  tier: TierConfig;
  conviction: number;
  atrPct: number;
  effectiveStopPct: number;
  riskMultiplier: number;
  exposureUtilization: number;
  warnings: string[];
}

/**
 * Calculate dynamic position size with all factors
 */
export function calculateDynamicSize(
  context: SizingContext,
  entryPrice: number,
  side: "LONG" | "SHORT",
  rewardMultiple: number = 2.5
): SizingResult {
  const { equity, tier, atrPct, conviction, stopLossPct, currentExposure, equityGuard } = context;
  
  const warnings: string[] = [];
  
  // 1. Apply equity guard risk multiplier
  const riskMultiplier = equityGuard.riskMultiplier ?? 1.0;
  if (riskMultiplier < 1.0) {
    warnings.push(`Risk reduced to ${(riskMultiplier * 100).toFixed(0)}% by equity guard`);
  }
  
  // 2. Check if halted
  if (equityGuard.isHalted) {
    warnings.push("TRADING HALTED: " + (equityGuard.haltReason || "Unknown"));
    return {
      notional: 0,
      qty: 0,
      stopPrice: entryPrice,
      targetPrice: entryPrice,
      riskRewardRatio: 0,
      riskAmount: 0,
      maxNotionalAllowed: 0,
      tier,
      conviction,
      atrPct,
      effectiveStopPct: 0,
      riskMultiplier,
      exposureUtilization: currentExposure / (equity * tier.maxPortfolioExposure),
      warnings,
    };
  }
  
  // 3. Calculate effective stop loss percentage
  const effectiveStopPct = stopLossPct ?? (atrPct * tier.atrMultiplier);
  
  // 4. Calculate base notional using tier formula
  const baseNotional = tierCalculateSize({
    equity,
    tier,
    atrPct,
    conviction: conviction * riskMultiplier, // Apply risk multiplier to conviction
    stopLossPct: effectiveStopPct,
    currentExposure,
  });
  
  // 4.5 Apply minimum notional floor
  const notional = Math.max(baseNotional, tier.minNotional);
  
  // 5. Calculate stop and target prices
  const stopPrice = calculateStopPrice(entryPrice, side, tier, atrPct);
  const targetPrice = calculateTargetPrice(entryPrice, side, stopPrice, rewardMultiple);
  
  // 6. Calculate actual risk/reward
  const riskAmount = notional * effectiveStopPct;
  const actualRewardMultiple = Math.abs(targetPrice - entryPrice) / Math.abs(entryPrice - stopPrice);
  
  // 7. Calculate quantity
  const qty = notional / entryPrice;
  
  // 8. Exposure utilization
  const maxPortfolioNotional = equity * tier.maxPortfolioExposure;
  const exposureUtilization = maxPortfolioNotional > 0 
    ? (currentExposure + notional) / maxPortfolioNotional 
    : 0;
  
  if (exposureUtilization > 0.9) {
    warnings.push(`Portfolio exposure at ${(exposureUtilization * 100).toFixed(0)}%`);
  }
  
  if (notional < tier.minNotional) {
    warnings.push(`Notional below minimum ${tier.minNotional}`);
  }
  
  return {
    notional,
    qty,
    stopPrice,
    targetPrice,
    riskRewardRatio: actualRewardMultiple,
    riskAmount,
    maxNotionalAllowed: Math.min(
      equity * tier.maxPortfolioExposure / tier.maxPositions,
      equity * tier.maxRiskPerTrade * 5
    ),
    tier,
    conviction,
    atrPct,
    effectiveStopPct,
    riskMultiplier,
    exposureUtilization,
    warnings,
  };
}

/**
 * Calculate position size for a specific candidate from tape
 */
export interface CandidateSizingInput {
  candidate: {
    symbol: string;
    priceUsd: number;
    chain: string;
    venue: string;
    score: number;
    change24h: number;
    volume24h: number;
    liquidityUsd: number;
  };
  context: SizingContext;
  rewardMultiple: number;
}

/**
 * Quick size check for UI preview (simplified)
 */
export function quickSizePreview(
  equity: number,
  tier: TierConfig,
  entryPrice: number,
  atrPct: number,
  conviction: number = 1.0
): { notional: number; qty: number; stopPrice: number; targetPrice: number } {
  const notional = tierCalculateSize({
    equity,
    tier,
    atrPct,
    conviction,
    currentExposure: 0,
  });
  
  const stopPrice = calculateStopPrice(entryPrice, "LONG", tier, atrPct);
  const targetPrice = calculateTargetPrice(entryPrice, "LONG", stopPrice, 2.5);
  const qty = notional / entryPrice;
  
  return { notional, qty, stopPrice, targetPrice };
}

/**
 * Calculate maximum positions allowed for current equity
 */
export function getMaxPositionsForEquity(equity: number, tier: TierConfig): number {
  // Could dynamically reduce positions based on equity health
  if (equity < 50) return 1;
  if (equity < 100) return 1;
  if (equity < 250) return 2;
  return tier.maxPositions;
}

/**
 * Validate a position size against all constraints
 */
export interface ValidationResult {
  valid: boolean;
  notional: number;
  adjustedNotional: number;
  warnings: string[];
  errors: string[];
}

export function validatePositionSize(
  notional: number,
  context: SizingContext,
  entryPrice: number
): ValidationResult {
  const { equity, tier, currentExposure, equityGuard } = context;
  const warnings: string[] = [];
  const errors: string[] = [];
  let adjustedNotional = notional;
  
  // Check halted
  if (equityGuard.isHalted) {
    errors.push("Trading halted by equity guard");
    return { valid: false, notional, adjustedNotional: 0, warnings, errors };
  }
  
  // Check minimum
  if (notional < tier.minNotional) {
    errors.push(`Notional ${notional} below minimum ${tier.minNotional}`);
    adjustedNotional = 0;
  }
  
  // Check max per position
  const maxPerPosition = equity * tier.maxPortfolioExposure / tier.maxPositions;
  if (notional > maxPerPosition) {
    warnings.push(`Notional exceeds per-position max ${maxPerPosition.toFixed(2)}, capping`);
    adjustedNotional = maxPerPosition;
  }
  
  // Check max portfolio exposure
  const newExposure = currentExposure + notional;
  const maxExposure = equity * tier.maxPortfolioExposure;
  if (newExposure > maxExposure) {
    const available = Math.max(0, maxExposure - currentExposure);
    if (available < tier.minNotional) {
      errors.push("No exposure capacity remaining");
      adjustedNotional = 0;
    } else {
      warnings.push(`Capping to available exposure ${available.toFixed(2)}`);
      adjustedNotional = available;
    }
  }
  
  // Check risk multiplier
  if ((equityGuard.riskMultiplier ?? 1.0) < 1.0) {
    warnings.push(`Risk multiplier active: ${((equityGuard.riskMultiplier ?? 1.0) * 100).toFixed(0)}%`);
  }
  
  // Check equity vs minimum for tier
  if (equity < tier.minBalance) {
    warnings.push(`Equity below tier minimum, consider reducing size`);
  }
  
  return {
    valid: errors.length === 0 && adjustedNotional >= tier.minNotional,
    notional,
    adjustedNotional: Math.max(adjustedNotional, 0),
    warnings,
    errors,
  };
}

/**
 * Calculate risk metrics for a position
 */
export interface PositionRiskMetrics {
  notional: number;
  riskAmount: number;
  riskPctOfEquity: number;
  stopDistancePct: number;
  targetDistancePct: number;
  riskRewardRatio: number;
  maxLossIfStopped: number;
  maxGainIfTargeted: number;
  liquidationBuffer: number; // for leveraged positions
}

export function calculatePositionRiskMetrics(
  notional: number,
  entryPrice: number,
  stopPrice: number,
  targetPrice: number,
  equity: number,
  leverage: number = 1
): PositionRiskMetrics {
  const stopDistance = Math.abs(entryPrice - stopPrice);
  const targetDistance = Math.abs(targetPrice - entryPrice);
  const riskAmount = notional * (stopDistance / entryPrice);
  const maxGain = notional * (targetDistance / entryPrice);
  
  return {
    notional,
    riskAmount,
    riskPctOfEquity: equity > 0 ? (riskAmount / equity) * 100 : 0,
    stopDistancePct: (stopDistance / entryPrice) * 100,
    targetDistancePct: (targetDistance / entryPrice) * 100,
    riskRewardRatio: targetDistance / stopDistance,
    maxLossIfStopped: riskAmount,
    maxGainIfTargeted: maxGain,
    liquidationBuffer: leverage > 1 ? (100 / leverage) - (stopDistance / entryPrice) * 100 : 100,
  };
}

/**
 * Get sizing explanation for UI
 */
export function getSizingExplanation(result: SizingResult): string[] {
  const parts: string[] = [];
  
  parts.push(`Tier: ${result.tier.name.toUpperCase()} (${result.tier.maxRiskPerTrade * 100}% risk/trade, ${result.tier.maxPositions} max pos)`);
  parts.push(`Conviction: ${(result.conviction * 100).toFixed(0)}% × Risk Mult: ${(result.riskMultiplier * 100).toFixed(0)}%`);
  parts.push(`ATR: ${(result.atrPct * 100).toFixed(2)}% → Stop: ${(result.effectiveStopPct * 100).toFixed(2)}% (${result.tier.stopLossType})`);
  parts.push(`Notional: $${result.notional.toFixed(2)} (max allowed: $${result.maxNotionalAllowed.toFixed(2)})`);
  parts.push(`R:R: ${result.riskRewardRatio.toFixed(2)}:1 | Exposure: ${(result.exposureUtilization * 100).toFixed(1)}%`);
  
  if (result.warnings.length) {
    parts.push(`⚠ ${result.warnings.join("; ")}`);
  }
  
  return parts;
}