/**
 * Exit Engine — Chandelier Ladder (Architecture Blueprint v2, invariant I2).
 *
 * Pure functions, no I/O, no store access. The desk wires evaluateExit()
 * into its tick loop: one call per open position per cycle.
 *
 * Lifecycle: ARMING → BREAKEVEN (+1R) → SCALED_1 (50% off at +1.5R) →
 * SCALED_2 (25% off at +2.5R) → RUNNER (Chandelier trail) → CLOSED.
 * Once +1R is touched the worst remaining outcome is the breakeven stop:
 * a winner can never round-trip to a full stop.
 *
 * Side exits: time stop, volatility-spike trail tightening, stale failsafe
 * (freeze — never drift, never invent prices).
 */

export type ExitSide = "LONG" | "SHORT";

export type ExitStateName =
  | "ARMING"
  | "BREAKEVEN"
  | "SCALED_1"
  | "SCALED_2"
  | "RUNNER"
  | "CLOSED";

export interface ExitPlan {
  /** Initial (armed) stop price. */
  stopPrice: number;
  /** |entry − stop| in price units — the 1R denominator. */
  riskPerUnit: number;
  breakevenTriggerR: number;
  /** Fee buffer above entry so breakeven exits net ≥ 0 after costs. */
  breakevenBufferR: number;
  scaleOut1AtR: number;
  scaleOut1Fraction: number;
  scaleOut2AtR: number;
  scaleOut2Fraction: number;
  /** Chandelier trail multiple of entry ATR, applied from the best mark. */
  runnerTrailAtrMult: number;
  /** Trail multiple while volatility has spiked (ATR ≥ 2× entry ATR). */
  volSpikeTrailAtrMult: number;
  /** Exit flat when this many minutes pass below +0.5R. null disables. */
  timeStopMinutes: number | null;
  /** No fresh mark for this long → freeze: no drift, no invented prices. */
  staleFailsafeMinutes: number;
}

export interface ExitRuntime {
  state: ExitStateName;
  stopPrice: number;
  /** Best mark seen in the favorable direction (Chandelier anchor). */
  bestMark: number;
  /** ATR in price units, sampled at entry. */
  atrAtEntry: number;
  openedAt: number;
  /** Original position qty at entry — all scale-out fractions are of this. */
  originalQty: number;
  /** Qty already realized via scale-outs. */
  scaledOutQty: number;
  /** Max adverse excursion in R units (positive number, adverse direction). */
  maeR: number;
  /** Max favorable excursion in R units. */
  mfeR: number;
}

export type ExitAction =
  | { kind: "HOLD" }
  | { kind: "SCALE_OUT"; fractionOfOriginal: number; reason: string }
  | { kind: "MOVE_STOP"; newStop: number; reason: string }
  | { kind: "CLOSE"; reason: string };

export interface ExitDecision {
  action: ExitAction;
  state: ExitStateName;
  runtime: ExitRuntime;
}

export const DEFAULT_EXIT_PROFILE = {
  breakevenTriggerR: 1.0,
  breakevenBufferR: 0.15,
  scaleOut1AtR: 1.5,
  scaleOut1Fraction: 0.5,
  scaleOut2AtR: 2.5,
  scaleOut2Fraction: 0.25,
  runnerTrailAtrMult: 2.5,
  volSpikeTrailAtrMult: 1.2,
  timeStopMinutes: 240,
  staleFailsafeMinutes: 10,
} as const;

export type ExitProfile = Partial<typeof DEFAULT_EXIT_PROFILE>;

export function buildExitPlan(
  entryPrice: number,
  stopPrice: number,
  profile: ExitProfile = {},
): ExitPlan {
  const p = { ...DEFAULT_EXIT_PROFILE, ...profile };
  return {
    stopPrice,
    riskPerUnit: Math.abs(entryPrice - stopPrice) || Math.max(entryPrice * 0.01, 1e-9),
    ...p,
  };
}

export function initExitRuntime(
  entryPrice: number,
  plan: ExitPlan,
  qty: number,
  atrAtEntry: number,
  openedAt: number,
): ExitRuntime {
  return {
    state: "ARMING",
    stopPrice: plan.stopPrice,
    bestMark: entryPrice,
    atrAtEntry,
    openedAt,
    originalQty: qty,
    scaledOutQty: 0,
    maeR: 0,
    mfeR: 0,
  };
}

/** Qty still open after scale-outs. */
export function remainingQty(runtime: ExitRuntime): number {
  return Math.max(0, runtime.originalQty - runtime.scaledOutQty);
}

/**
 * One exit evaluation per position per tick. Returns the next action to
 * apply plus the updated runtime. Never invents prices: on a stale mark the
 * decision is HOLD (freeze) until a fresh mark arrives.
 */
export function evaluateExit(
  side: ExitSide,
  entryPrice: number,
  mark: number,
  plan: ExitPlan,
  runtime: ExitRuntime,
  opts: { now: number; lastFreshMarkAt: number; currentAtr?: number },
): ExitDecision {
  const dir = side === "SHORT" ? -1 : 1;
  const rt: ExitRuntime = { ...runtime };
  if (rt.state === "CLOSED") {
    return { action: { kind: "HOLD" }, state: rt.state, runtime: rt };
  }

  // Stale failsafe (I2): freeze on stale marks — no drift, no invented stops.
  if (opts.now - opts.lastFreshMarkAt > plan.staleFailsafeMinutes * 60_000) {
    return { action: { kind: "HOLD" }, state: rt.state, runtime: rt };
  }

  const favorable = dir * (mark - entryPrice);
  const r = plan.riskPerUnit > 0 ? favorable / plan.riskPerUnit : 0;
  rt.bestMark = dir === 1 ? Math.max(rt.bestMark, mark) : Math.min(rt.bestMark, mark);
  rt.mfeR = Math.max(rt.mfeR, r);
  rt.maeR = Math.max(rt.maeR, -r);

  // Stop hit — stopPrice may already be at breakeven or the Chandelier trail.
  const stopHit = dir === 1 ? mark <= rt.stopPrice : mark >= rt.stopPrice;
  if (stopHit) {
    const label =
      rt.state === "ARMING" ? "Initial stop" : rt.state === "BREAKEVEN" ? "Breakeven stop" : "Trail stop";
    rt.state = "CLOSED";
    return {
      action: { kind: "CLOSE", reason: `${label} hit at ${mark.toFixed(6)} (${r >= 0 ? "+" : ""}${r.toFixed(2)}R)` },
      state: "CLOSED",
      runtime: rt,
    };
  }

  // Time stop: capital parked below +0.5R longer than the hold budget.
  if (
    plan.timeStopMinutes !== null &&
    opts.now - rt.openedAt >= plan.timeStopMinutes * 60_000 &&
    r < 0.5
  ) {
    const heldMin = Math.round((opts.now - rt.openedAt) / 60_000);
    rt.state = "CLOSED";
    return {
      action: { kind: "CLOSE", reason: `Time stop: ${heldMin}min held below +0.5R (${r.toFixed(2)}R)` },
      state: "CLOSED",
      runtime: rt,
    };
  }

  // Breakeven: the invariant's heart — at +1R the stop moves above entry.
  if (rt.state === "ARMING" && r >= plan.breakevenTriggerR) {
    rt.state = "BREAKEVEN";
    const newStop = entryPrice + dir * plan.breakevenBufferR * plan.riskPerUnit;
    rt.stopPrice =
      dir === 1 ? Math.max(rt.stopPrice, newStop) : Math.min(rt.stopPrice, newStop);
    return {
      action: {
        kind: "MOVE_STOP",
        newStop: rt.stopPrice,
        reason: `Breakeven armed at +${r.toFixed(2)}R (stop to +${plan.breakevenBufferR}R fee buffer — worst case is now a tiny win)`,
      },
      state: "BREAKEVEN",
      runtime: rt,
    };
  }

  // Scale-out 1: bank half at +1.5R; freed stake returns to the flow pool.
  if (rt.state === "BREAKEVEN" && r >= plan.scaleOut1AtR) {
    rt.state = "SCALED_1";
    rt.scaledOutQty += plan.scaleOut1Fraction * rt.originalQty;
    return {
      action: {
        kind: "SCALE_OUT",
        fractionOfOriginal: plan.scaleOut1Fraction,
        reason: `Scale-out 1: ${(plan.scaleOut1Fraction * 100).toFixed(0)}% off at +${r.toFixed(2)}R — risk-free runner remains`,
      },
      state: "SCALED_1",
      runtime: rt,
    };
  }

  // Scale-out 2: another quarter at +2.5R.
  if (rt.state === "SCALED_1" && r >= plan.scaleOut2AtR) {
    rt.state = "SCALED_2";
    rt.scaledOutQty += plan.scaleOut2Fraction * rt.originalQty;
    return {
      action: {
        kind: "SCALE_OUT",
        fractionOfOriginal: plan.scaleOut2Fraction,
        reason: `Scale-out 2: ${(plan.scaleOut2Fraction * 100).toFixed(0)}% off at +${r.toFixed(2)}R`,
      },
      state: "SCALED_2",
      runtime: rt,
    };
  }

  // Runner: Chandelier trail from the best mark, tightening on vol spikes.
  if (rt.state === "SCALED_2" || rt.state === "RUNNER") {
    rt.state = "RUNNER";
    const volSpiked = opts.currentAtr !== undefined && opts.currentAtr >= 2 * rt.atrAtEntry;
    const trailMult = volSpiked ? plan.volSpikeTrailAtrMult : plan.runnerTrailAtrMult;
    const trailStop =
      dir === 1 ? rt.bestMark - trailMult * rt.atrAtEntry : rt.bestMark + trailMult * rt.atrAtEntry;
    const improves = dir === 1 ? trailStop > rt.stopPrice : trailStop < rt.stopPrice;
    if (improves) {
      rt.stopPrice = trailStop;
      return {
        action: {
          kind: "MOVE_STOP",
          newStop: rt.stopPrice,
          reason: volSpiked
            ? `Volatility spike — trail tightened to ${trailMult}×ATR`
            : `Chandelier trail ${trailMult}×ATR from best mark`,
        },
        state: "RUNNER",
        runtime: rt,
      };
    }
    return { action: { kind: "HOLD" }, state: "RUNNER", runtime: rt };
  }

  return { action: { kind: "HOLD" }, state: rt.state, runtime: rt };
}

/**
 * Blended expectancy of the ladder for sanity checks and future sweeps.
 * Example: 40% winners averaging +1.9R blended, 60% losers at −0.85R
 * (breakeven saves some stops) → positive expectancy.
 */
export function ladderExpectancy(
  winRate: number,
  avgWinnerR: number,
  avgLoserR: number,
): number {
  return winRate * avgWinnerR + (1 - winRate) * avgLoserR;
}
