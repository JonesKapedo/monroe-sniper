/**
 * Profit Locking System
 * Progressive: small gains 80/20, large gains 90/10, compounding capped at $1000.
 * $125 gain -> $100 locked, $25 compounds. $10,000 gain -> $9,000 locked, $1,000 compounds.
 * Base equity only grows - never decreases.
 */

export interface ProfitLockConfig {
  compoundingRate: number; // 0.20 = 20% base rate for gains under the large-gain threshold
  compoundingCap: number; // $1000 max compounding
  lockRate: number; // 0.80 = 80% base lock rate
  largeGainThreshold: number; // gains at/above this use largeGainCompoundingRate
  largeGainCompoundingRate: number; // 0.10 = 10% for large gains
}

export const DEFAULT_PROFIT_LOCK_CONFIG: ProfitLockConfig = {
  compoundingRate: 0.2,
  compoundingCap: 1000,
  lockRate: 0.8,
  largeGainThreshold: 1000,
  largeGainCompoundingRate: 0.1,
};

export interface ProfitLockState {
  baseEquity: number; // Initial deposit + all locked profits
  compoundingEquity: number; // Currently compounding (max $1000)
  lockedProfits: number; // Total locked profits
  peakEquity: number; // Highest equity ever achieved
  totalCompounded: number; // Lifetime compounded amount
}

export interface ProfitLockResult {
  newState: ProfitLockState;
  lockAmount: number;
  compoundAmount: number;
  unrealizedGain: number;
  applied: boolean;
}

/**
 * Apply profit locking formula to current equity
 *
 * Formula (progressive):
 * - unrealizedGain = currentEquity - baseEquity
 * - rate = gain >= largeGainThreshold ? largeGainCompoundingRate (10%) : compoundingRate (20%)
 * - compoundAmount = min(unrealizedGain * rate, compoundingCap $1000)
 * - lockAmount = unrealizedGain - compoundAmount
 * - newBaseEquity = baseEquity + lockAmount
 * - compoundingEquity = min(compoundingEquity + compoundAmount, cap)
 * - lockedProfits += lockAmount
 */
export function applyProfitLock(
  state: ProfitLockState,
  currentEquity: number,
  config: ProfitLockConfig = DEFAULT_PROFIT_LOCK_CONFIG,
): ProfitLockResult {
  const unrealizedGain = currentEquity - state.baseEquity;

  // No gains to lock
  if (unrealizedGain <= 0) {
    return {
      newState: { ...state, peakEquity: Math.max(state.peakEquity, currentEquity) },
      lockAmount: 0,
      compoundAmount: 0,
      unrealizedGain,
      applied: false,
    };
  }

  const rate =
    unrealizedGain >= (config.largeGainThreshold ?? 1000)
      ? (config.largeGainCompoundingRate ?? 0.1)
      : config.compoundingRate;
  // Calculate compound amount (progressive rate, capped at $1000)
  const compoundAmount = Math.min(unrealizedGain * rate, config.compoundingCap);

  // Lock the rest (80%+ small gains, 90% large gains)
  const lockAmount = unrealizedGain - compoundAmount;
  
  // New state
  const newBaseEquity = state.baseEquity + lockAmount;
  const newCompoundingEquity = Math.min(state.compoundingEquity + compoundAmount, config.compoundingCap);
  const newLockedProfits = state.lockedProfits + lockAmount;
  const newPeakEquity = Math.max(state.peakEquity, currentEquity);
  const newTotalCompounded = state.totalCompounded + compoundAmount;
  
  return {
    newState: {
      baseEquity: newBaseEquity,
      compoundingEquity: newCompoundingEquity,
      lockedProfits: newLockedProfits,
      peakEquity: newPeakEquity,
      totalCompounded: newTotalCompounded,
    },
    lockAmount,
    compoundAmount,
    unrealizedGain,
    applied: true,
  };
}

/**
 * Reverse profit lock (for testing/simulation)
 */
export function reverseProfitLock(
  state: ProfitLockState,
  amount: number
): ProfitLockState {
  // Remove from locked profits first, then compounding
  let remaining = amount;
  let newLocked = state.lockedProfits;
  let newCompounding = state.compoundingEquity;
  let newBase = state.baseEquity;
  
  if (newLocked >= remaining) {
    newLocked -= remaining;
    newBase -= remaining;
  } else {
    remaining -= newLocked;
    newBase -= newLocked;
    newLocked = 0;
    if (newCompounding >= remaining) {
      newCompounding -= remaining;
    } else {
      newCompounding = 0;
    }
  }
  
  return {
    baseEquity: Math.max(0, newBase),
    compoundingEquity: Math.max(0, newCompounding),
    lockedProfits: Math.max(0, newLocked),
    peakEquity: state.peakEquity,
    totalCompounded: state.totalCompounded,
  };
}

/**
 * Calculate trailing stop level from peak equity
 */
export function calculateTrailingStop(
  peakEquity: number,
  trailingStopPct: number = 0.10
): number {
  return peakEquity * (1 - trailingStopPct);
}

/**
 * Check if equity has breached trailing stop
 */
export function isTrailingStopBreached(
  currentEquity: number,
  peakEquity: number,
  trailingStopPct: number = 0.10
): boolean {
  const stopLevel = calculateTrailingStop(peakEquity, trailingStopPct);
  return currentEquity < stopLevel;
}

/**
 * Calculate daily drawdown from start of day
 */
export function calculateDailyDrawdown(
  currentEquity: number,
  startOfDayEquity: number
): number {
  if (startOfDayEquity <= 0) return 0;
  return (startOfDayEquity - currentEquity) / startOfDayEquity;
}

/**
 * Create initial profit lock state
 */
export function createInitialProfitLockState(
  initialEquity: number = 500
): ProfitLockState {
  return {
    baseEquity: initialEquity,
    compoundingEquity: Math.min(initialEquity * 0.1, 1000), // 10% of initial, capped at $1000
    lockedProfits: 0,
    peakEquity: initialEquity,
    totalCompounded: 0,
  };
}

/**
 * Profit Lock Calculator - pure function for testing/UI
 */
export function calculateProfitLockPreview(
  baseEquity: number,
  currentEquity: number,
  config: ProfitLockConfig = DEFAULT_PROFIT_LOCK_CONFIG
): {
  unrealizedGain: number;
  lockAmount: number;
  compoundAmount: number;
  newBaseEquity: number;
  lockPercentage: number;
} {
  const unrealizedGain = currentEquity - baseEquity;
  
  if (unrealizedGain <= 0) {
    return {
      unrealizedGain: 0,
      lockAmount: 0,
      compoundAmount: 0,
      newBaseEquity: baseEquity,
      lockPercentage: 0,
    };
  }
  
  const previewRate = unrealizedGain >= (config.largeGainThreshold ?? 1000) ? (config.largeGainCompoundingRate ?? 0.1) : config.compoundingRate;
  const compoundAmount = Math.min(unrealizedGain * previewRate, config.compoundingCap);
  const lockAmount = unrealizedGain - compoundAmount;
  const newBaseEquity = baseEquity + lockAmount;
  const lockPercentage = (lockAmount / unrealizedGain) * 100;
  
  return {
    unrealizedGain,
    lockAmount,
    compoundAmount,
    newBaseEquity,
    lockPercentage,
  };
}

/**
 * Format profit lock status for display
 */
export function formatProfitLockStatus(
  state: ProfitLockState,
  currentEquity: number
): {
  base: string;
  locked: string;
  compounding: string;
  peak: string;
  unrealized: string;
  trailingStop: string;
} {
  const unrealized = currentEquity - state.baseEquity;
  const trailingStop = calculateTrailingStop(state.peakEquity);
  
  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  return {
    base: fmt(state.baseEquity),
    locked: fmt(state.lockedProfits),
    compounding: `${fmt(state.compoundingEquity)} / $1000`,
    peak: fmt(state.peakEquity),
    unrealized: unrealized >= 0 ? `+${fmt(unrealized)}` : fmt(unrealized),
    trailingStop: fmt(trailingStop),
  };
}