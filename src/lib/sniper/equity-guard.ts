/**
 * Equity Guard System
 * Always-active protection: trailing stops, daily DD limits, consecutive loss/wins
 * No disarm needed for profit taking - automatic
 */

export interface EquityGuardConfig {
  trailingStopPct: number;           // 0.10 = 10% from peak
  trailingStopEnabled: boolean;
  dailyLossLimitPct: number;         // 0.03 = 3% from start of day
  maxConsecutiveLosses: number;      // 2
  cooldownMinutes: number;           // 60
  sizeReductionAfterLoss: number;    // 0.5 = 50%
  winStreakTrigger: number;          // 3
  winStreakRiskMultiplier: number;   // 0.5
  winStreakMaxReduction: number;     // 0.25 (min 25% of base)
  dailyProfitTargetPct: number;      // 0.05 = 5%
  weeklyProfitTargetPct: number;     // 0.15 = 15%
  profitTargetAction: "halt" | "reduce" | "lock";
}

export const DEFAULT_EQUITY_GUARD_CONFIG: EquityGuardConfig = {
  trailingStopPct: 0.10,
  trailingStopEnabled: true,
  dailyLossLimitPct: 0.03,
  maxConsecutiveLosses: 2,
  cooldownMinutes: 60,
  sizeReductionAfterLoss: 0.5,
  winStreakTrigger: 3,
  winStreakRiskMultiplier: 0.5,
  winStreakMaxReduction: 0.25,
  dailyProfitTargetPct: 0.05,
  weeklyProfitTargetPct: 0.15,
  profitTargetAction: "halt",
};

export interface EquityGuardState {
  // Core state
  isHalted: boolean;
  haltReason: string | null;
  haltUntil: number | null;
  
  // Risk multiplier (applied to position sizing)
  riskMultiplier: number;            // 1.0 = normal, 0.5 = 50% size, 0 = halted
  
  // Consecutive tracking
  consecutiveLosses: number;
  consecutiveWins: number;
  lastTradePnl: number;
  lastTradeAt: number | null;
  
  // Daily tracking
  startOfDayEquity: number;
  startOfDayAt: number;
  dailyLossPct: number;
  
  // Weekly tracking
  startOfWeekEquity: number;
  startOfWeekAt: number;
  
  // Cooldown
  cooldownUntil: number | null;
  cooldownReason: string | null;
  
  // Profit targets hit
  dailyProfitTargetHit: boolean;
  weeklyProfitTargetHit: boolean;
  
  // Timestamps
  lastUpdated: number;
}

export interface GuardEvaluationResult {
  allowed: boolean;
  reason: string;
  newState: EquityGuardState;
  actions: GuardAction[];
}

export type GuardAction = 
  | { type: "HALT"; reason: string; until: number }
  | { type: "RESUME"; reason: string }
  | { type: "REDUCE_RISK"; multiplier: number; reason: string }
  | { type: "RESTORE_RISK"; reason: string }
  | { type: "COOLDOWN"; minutes: number; reason: string }
  | { type: "RESET_DAILY"; reason: string }
  | { type: "RESET_WEEKLY"; reason: string }
  | { type: "PROFIT_TARGET_HIT"; target: "daily" | "weekly" };

/**
 * Create initial equity guard state
 */
export function createInitialEquityGuardState(
  initialEquity: number = 500
): EquityGuardState {
  const now = Date.now();
  const startOfDay = getStartOfDay(now);
  const startOfWeek = getStartOfWeek(now);
  
  return {
    isHalted: false,
    haltReason: null,
    haltUntil: null,
    riskMultiplier: 1.0,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    lastTradePnl: 0,
    lastTradeAt: null,
    startOfDayEquity: initialEquity,
    startOfDayAt: startOfDay,
    dailyLossPct: 0,
    startOfWeekEquity: initialEquity,
    startOfWeekAt: startOfWeek,
    cooldownUntil: null,
    cooldownReason: null,
    dailyProfitTargetHit: false,
    weeklyProfitTargetHit: false,
    lastUpdated: now,
  };
}

/**
 * Evaluate equity guard against current state
 */
export function evaluateEquityGuard(
  state: EquityGuardState,
  currentEquity: number,
  config: EquityGuardConfig = DEFAULT_EQUITY_GUARD_CONFIG
): GuardEvaluationResult {
  const now = Date.now();
  const actions: GuardAction[] = [];
  let newState = { ...state, lastUpdated: now };
  let allowed = true;
  let reason = "OK";
  
  // 1. Check daily/weekly reset
  if (now >= getStartOfDay(state.startOfDayAt) + 86400000) {
    newState = { ...newState, ...getFreshDailyState(currentEquity, now) };
    actions.push({ type: "RESET_DAILY", reason: "New trading day" });
  }
  
  if (now >= getStartOfWeek(state.startOfWeekAt) + 604800000) {
    newState = { ...newState, ...getFreshWeeklyState(currentEquity, now) };
    actions.push({ type: "RESET_WEEKLY", reason: "New trading week" });
  }
  
  // 2. Check cooldown
  if (newState.cooldownUntil && now < newState.cooldownUntil) {
    const remaining = Math.ceil((newState.cooldownUntil - now) / 60000);
    return {
      allowed: false,
      reason: `Cooldown active: ${remaining}min remaining (${newState.cooldownReason})`,
      newState,
      actions: [{ type: "COOLDOWN", minutes: remaining, reason: newState.cooldownReason || "Cooldown" }],
    };
  }
  
  // Clear cooldown if expired
  if (newState.cooldownUntil && now >= newState.cooldownUntil) {
    newState.cooldownUntil = null;
    newState.cooldownReason = null;
    actions.push({ type: "RESUME", reason: "Cooldown expired" });
  }
  
  // 3. Check halt
  if (newState.isHalted) {
    if (newState.haltUntil && now >= newState.haltUntil) {
      newState.isHalted = false;
      newState.haltReason = null;
      newState.haltUntil = null;
      newState.riskMultiplier = 1.0;
      actions.push({ type: "RESUME", reason: "Halt period expired" });
    } else {
      return {
        allowed: false,
        reason: `HALTED: ${newState.haltReason || "Equity guard halt"}`,
        newState,
        actions,
      };
    }
  }
  
  // 4. Trailing stop check
  if (config.trailingStopEnabled) {
    const peakEquity = Math.max(
      state.startOfDayEquity,
      state.startOfWeekEquity,
      currentEquity
    );
    const trailingStopLevel = peakEquity * (1 - config.trailingStopPct);
    
    if (currentEquity < trailingStopLevel) {
      newState.isHalted = true;
      newState.haltReason = `Trailing stop breached: equity ${currentEquity.toFixed(2)} < ${trailingStopLevel.toFixed(2)} (${(config.trailingStopPct * 100).toFixed(0)}% from peak ${peakEquity.toFixed(2)})`;
      const haltUntilTs = now + config.cooldownMinutes * 60000;
      newState.haltUntil = haltUntilTs;
      newState.riskMultiplier = 0;
      actions.push({
        type: "HALT",
        reason: newState.haltReason,
        until: haltUntilTs,
      });
      return { allowed: false, reason: newState.haltReason, newState, actions };
    }
  }
  
  // 5. Daily drawdown check
  newState.dailyLossPct = (newState.startOfDayEquity - currentEquity) / newState.startOfDayEquity;
  if (newState.dailyLossPct >= config.dailyLossLimitPct) {
    newState.isHalted = true;
    newState.haltReason = `Daily loss limit breached: ${(newState.dailyLossPct * 100).toFixed(2)}% >= ${(config.dailyLossLimitPct * 100).toFixed(0)}%`;
    const dailyHaltUntil = getStartOfDay(newState.startOfDayAt) + 86400000; // Until midnight
    newState.haltUntil = dailyHaltUntil;
    newState.riskMultiplier = 0;
    actions.push({
      type: "HALT",
      reason: newState.haltReason,
      until: dailyHaltUntil,
    });
    return { allowed: false, reason: newState.haltReason, newState, actions };
  }
  
  // 6. Consecutive losses
  if (newState.consecutiveLosses >= config.maxConsecutiveLosses) {
    if (newState.consecutiveLosses === config.maxConsecutiveLosses) {
      // First time hitting limit: reduce size
      newState.riskMultiplier = config.sizeReductionAfterLoss;
      actions.push({
        type: "REDUCE_RISK",
        multiplier: config.sizeReductionAfterLoss,
        reason: `${config.maxConsecutiveLosses} consecutive losses - reducing risk to ${(config.sizeReductionAfterLoss * 100).toFixed(0)}%`,
      });
    } else if (newState.consecutiveLosses > config.maxConsecutiveLosses) {
      // Additional losses: halt
      newState.isHalted = true;
      newState.haltReason = `${newState.consecutiveLosses} consecutive losses - cooling off`;
      const haltUntilTs = now + config.cooldownMinutes * 60000;
      newState.haltUntil = haltUntilTs;
      newState.riskMultiplier = 0;
      actions.push({
        type: "HALT",
        reason: newState.haltReason,
        until: haltUntilTs,
      });
    }
  }
  
  // 7. Win streak protection
  if (newState.consecutiveWins >= config.winStreakTrigger) {
    const targetMultiplier = config.winStreakRiskMultiplier;
    const minMultiplier = config.winStreakMaxReduction;
    const calculatedMultiplier = Math.max(minMultiplier, 1.0 - (newState.consecutiveWins - config.winStreakTrigger + 1) * 0.1);
    const newMultiplier = Math.max(minMultiplier, Math.min(targetMultiplier, calculatedMultiplier));
    
    if (newMultiplier < newState.riskMultiplier) {
      newState.riskMultiplier = newMultiplier;
      actions.push({
        type: "REDUCE_RISK",
        multiplier: newMultiplier,
        reason: `${newState.consecutiveWins} consecutive wins - protecting gains at ${(newMultiplier * 100).toFixed(0)}% risk`,
      });
    }
  }
  
  // 8. Daily profit target
  const dailyGainPct = (currentEquity - newState.startOfDayEquity) / newState.startOfDayEquity;
  if (dailyGainPct >= config.dailyProfitTargetPct && !newState.dailyProfitTargetHit) {
    newState.dailyProfitTargetHit = true;
    if (config.profitTargetAction === "halt") {
      newState.isHalted = true;
      newState.haltReason = `Daily profit target hit: ${(dailyGainPct * 100).toFixed(2)}%`;
      const profitHaltUntil = getStartOfDay(newState.startOfDayAt) + 86400000;
      newState.haltUntil = profitHaltUntil;
      newState.riskMultiplier = 0;
      actions.push({ type: "HALT", reason: newState.haltReason, until: profitHaltUntil });
    } else if (config.profitTargetAction === "reduce") {
      newState.riskMultiplier = Math.min(newState.riskMultiplier, 0.5);
      actions.push({ type: "REDUCE_RISK", multiplier: 0.5, reason: "Daily profit target hit - reducing risk" });
    }
    actions.push({ type: "PROFIT_TARGET_HIT", target: "daily" });
  }
  
  // 9. Weekly profit target
  const weeklyGainPct = (currentEquity - newState.startOfWeekEquity) / newState.startOfWeekEquity;
  if (weeklyGainPct >= config.weeklyProfitTargetPct && !newState.weeklyProfitTargetHit) {
    newState.weeklyProfitTargetHit = true;
    if (config.profitTargetAction === "halt") {
      newState.isHalted = true;
      newState.haltReason = `Weekly profit target hit: ${(weeklyGainPct * 100).toFixed(2)}%`;
      const weeklyHaltUntil = getStartOfWeek(newState.startOfWeekAt) + 604800000;
      newState.haltUntil = weeklyHaltUntil;
      newState.riskMultiplier = 0;
      actions.push({ type: "HALT", reason: newState.haltReason, until: weeklyHaltUntil });
    }
    actions.push({ type: "PROFIT_TARGET_HIT", target: "weekly" });
  }
  
  // 10. Check if we should restore risk multiplier (after wins reset losses)
  if (newState.riskMultiplier < 1.0 && newState.consecutiveLosses === 0 && newState.consecutiveWins === 0) {
    newState.riskMultiplier = 1.0;
    actions.push({ type: "RESTORE_RISK", reason: "Loss/wins streak reset - restoring full risk" });
  }
  
  return { allowed, reason, newState, actions };
}

/**
 * Record a trade outcome and update state
 */
export function recordTradeOutcome(
  state: EquityGuardState,
  pnl: number,
  config: EquityGuardConfig = DEFAULT_EQUITY_GUARD_CONFIG
): EquityGuardState {
  const now = Date.now();
  const newState = { ...state, lastTradePnl: pnl, lastTradeAt: now, lastUpdated: now };
  
  if (pnl > 0) {
    newState.consecutiveWins += 1;
    newState.consecutiveLosses = 0;
  } else if (pnl < 0) {
    newState.consecutiveLosses += 1;
    newState.consecutiveWins = 0;
  }
  // pnl === 0 doesn't affect streaks
  
  // Re-evaluate with new state
  const evalResult = evaluateEquityGuard(newState, newState.startOfDayEquity + pnl, config);
  
  return evalResult.newState;
}

/**
 * Manual override functions
 */
export function manualHalt(
  state: EquityGuardState,
  reason: string,
  durationMinutes: number = 60
): EquityGuardState {
  const now = Date.now();
  return {
    ...state,
    isHalted: true,
    haltReason: reason,
    haltUntil: now + durationMinutes * 60000,
    riskMultiplier: 0,
    lastUpdated: now,
  };
}

export function manualResume(state: EquityGuardState): EquityGuardState {
  return {
    ...state,
    isHalted: false,
    haltReason: null,
    haltUntil: null,
    cooldownUntil: null,
    cooldownReason: null,
    riskMultiplier: 1.0,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    lastUpdated: Date.now(),
  };
}

export function setRiskMultiplier(state: EquityGuardState, multiplier: number): EquityGuardState {
  return {
    ...state,
    riskMultiplier: Math.max(0, Math.min(1, multiplier)),
    lastUpdated: Date.now(),
  };
}

/**
 * Get fresh daily state
 */
function getFreshDailyState(equity: number, now: number): Partial<EquityGuardState> {
  return {
    startOfDayEquity: equity,
    startOfDayAt: getStartOfDay(now),
    dailyLossPct: 0,
    dailyProfitTargetHit: false,
    consecutiveLosses: 0,
    consecutiveWins: 0,
  };
}

/**
 * Get fresh weekly state
 */
function getFreshWeeklyState(equity: number, now: number): Partial<EquityGuardState> {
  return {
    startOfWeekEquity: equity,
    startOfWeekAt: getStartOfWeek(now),
    weeklyProfitTargetHit: false,
  };
}

/**
 * Get start of day (midnight UTC) for timestamp
 */
function getStartOfDay(ts: number): number {
  const d = new Date(ts);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Get start of week (Monday 00:00 UTC) for timestamp
 */
function getStartOfWeek(ts: number): number {
  const d = new Date(ts);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Format guard status for display
 */
export function formatGuardStatus(state: EquityGuardState): {
  status: "OK" | "COOLDOWN" | "HALTED" | "REDUCED";
  summary: string;
  details: string[];
} {
  if (state.isHalted) {
    const remaining = state.haltUntil ? Math.ceil((state.haltUntil - Date.now()) / 60000) : 0;
    return {
      status: "HALTED",
      summary: `HALTED: ${state.haltReason}${remaining > 0 ? ` (${remaining}min)` : ""}`,
      details: [`Risk: 0%`, `Daily DD: ${(state.dailyLossPct * 100).toFixed(2)}%`],
    };
  }
  
  if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
    const remaining = Math.ceil((state.cooldownUntil - Date.now()) / 60000);
    return {
      status: "COOLDOWN",
      summary: `COOLDOWN: ${state.cooldownReason} (${remaining}min)`,
      details: [`Risk: ${(state.riskMultiplier * 100).toFixed(0)}%`, `Daily DD: ${(state.dailyLossPct * 100).toFixed(2)}%`],
    };
  }
  
  if (state.riskMultiplier < 1.0) {
    return {
      status: "REDUCED",
      summary: `RISK REDUCED: ${(state.riskMultiplier * 100).toFixed(0)}%`,
      details: [`Losses: ${state.consecutiveLosses}`, `Wins: ${state.consecutiveWins}`, `Daily DD: ${(state.dailyLossPct * 100).toFixed(2)}%`],
    };
  }
  
  return {
    status: "OK",
    summary: "All systems nominal",
    details: [`Risk: 100%`, `Daily DD: ${(state.dailyLossPct * 100).toFixed(2)}%`, `Losses: ${state.consecutiveLosses}`, `Wins: ${state.consecutiveWins}`],
  };
}