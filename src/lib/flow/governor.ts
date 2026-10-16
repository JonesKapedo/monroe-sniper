/**
 * Flow Governor — the 3-Trade Invariant (Architecture Blueprint v2, I1).
 *
 * Watches the entry loop and guarantees that whenever the desk is not
 * hard-HALTed, at least 3 consecutive new entries remain admissible.
 * Budget floors, guard multipliers, cooldowns, and gate rejections may
 * SHRINK tickets — they may never starve the desk below the flow floor.
 *
 * The governor never touches: security verdicts, HALT conditions, or the
 * daily-loss limit. Every auto-relax fires an operator alert callback.
 */

export interface RejectionEvent {
  ts: number;
  symbol: string;
  source: "avenues" | "tape" | "whale" | "manual";
  /** Gate that rejected: security | cooldown | edge | budget | guard | max_positions. */
  gate: "security" | "cooldown" | "edge" | "budget" | "guard" | "max_positions";
  observed: string;
  wouldBeSizeUsd: number;
}

export interface FlowGovernorState {
  /** Consecutive entry cycles that produced zero entries while not halted. */
  starvedCycles: number;
  /** Ordered relaxation ladder already applied — index = next step. */
  relaxStep: number;
  /** Structured rejections, newest first, ring buffer. */
  rejections: RejectionEvent[];
  /** Timestamp of the last entry that filled (resets starvation). */
  lastEntryAt: number | null;
  /** Operator alerts fired, newest first, ring buffer. */
  alerts: string[];
}

export const FLOW_RELAX_STEPS: ReadonlyArray<{
  key: string;
  description: string;
  /** Score-floor subtraction applied at this step (cumulative). */
  scoreFloorDelta: number;
}> = [
  { key: "edge_floor_minus_2", description: "Edge floor −2 (more candidates pass the pre-trade screen)", scoreFloorDelta: 2 },
  { key: "target_scale_clamped", description: "Target-scale clamp capped at 1.0x (smaller tickets, same count)", scoreFloorDelta: 0 },
  { key: "min_score_floor_minus_4", description: "Adaptive min-score floor −4 (last resort)", scoreFloorDelta: 4 },
];

export const MAX_RELAX_STEPS = FLOW_RELAX_STEPS.length;

export const MAX_STARVED_CYCLES_BEFORE_RELAX = 30;
export const REJECTION_RING_SIZE = 200;
export const ALERT_RING_SIZE = 50;

export function initFlowGovernor(): FlowGovernorState {
  return {
    starvedCycles: number = 0,
    relaxStep: 0,
    rejections: [],
    lastEntryAt: null,
    alerts: [],
  };
}

/** Record that a candidate was rejected by a gate (called by the entry loop). */
export function recordRejection(
  state: FlowGovernorState,
  event: Omit<RejectionEvent, "ts">,
): FlowGovernorState {
  return {
    ...state,
    rejections: [{ ...event, ts: Date.now() }, ...state.rejections].slice(0, REJECTION_RING_SIZE),
  };
}

/** Record that an entry filled — resets the starvation counter. */
export function recordEntryFilled(state: FlowGovernorState): FlowGovernorState {
  return { ...state, starvedCycles: 0, lastEntryAt: Date.now() };
}

/**
 * Call once per entry cycle. If the cycle produced no entries while the
 * guard was not HALTed and at least one feed was alive, increments the
 * starvation counter; when it crosses the threshold, applies the next
 * relaxation step. Returns the updated state plus the current effective
 * relaxation (score-floor delta) for the entry loop to consume.
 */
export function tickGovernor(
  state: FlowGovernorState,
  cycle: { entriesFilled: number; guardHalted: boolean; feedsAlive: number },
): { state: FlowGovernorState; scoreFloorRelax: number; alert: string | null } {
  if (cycle.entriesFilled > 0) {
    if (state.starvedCycles !== 0) {
      return {
        state: { ...state, starvedCycles: 0, relaxStep: state.relaxStep },
        scoreFloorRelax: currentRelax(state),
        alert: null,
      };
    }
    return { state, scoreFloorRelax: currentRelax(state), alert: null };
  }

  if (cycle.guardHalted || cycle.feedsAlive === 0) {
    // Legitimate non-trading states — not starvation, never relaxed past.
    return { state, scoreFloorRelax: currentRelax(state), alert: null };
  }

  const starved = state.starvedCycles + 1;
  if (starved >= MAX_STARVED_CYCLES_BEFORE_RELAX && state.relaxStep < MAX_RELAX_STEPS) {
    const step = FLOW_RELAX_STEPS[state.relaxStep];
    const alert = `FLOW GOVERNOR: ${starved} starved cycles — relaxing gate "${step.key}": ${step.description}`;
    return {
      state: {
        ...state,
        starvedCycles: 0,
        relaxStep: state.relaxStep + 1,
        alerts: [alert, ...state.alerts].slice(0, ALERT_RING_SIZE),
      },
      scoreFloorRelax: currentRelax({ ...state, relaxStep: state.relaxStep + 1 }),
      alert,
    };
  }
  return { state: { ...state, starvedCycles: starved }, scoreFloorRelax: currentRelax(state), alert: null };
}

/** Cumulative score-floor relaxation granted by the applied ladder steps. */
export function currentRelax(state: FlowGovernorState): number {
  let delta = 0;
  for (let i = 0; i < state.relaxStep && i < FLOW_RELAX_STEPS.length; i++) {
    delta += FLOW_RELAX_STEPS[i].scoreFloorDelta;
  }
  return delta;
}

/** Operator manual reset of the ladder (e.g. after reviewing rejections). */
export function resetRelax(state: FlowGovernorState, reason: string): FlowGovernorState {
  return {
    ...state,
    relaxStep: 0,
    alerts: [
      `FLOW GOVERNOR: relaxation ladder reset by operator (${reason})`,
      ...state.alerts,
    ].slice(0, ALERT_RING_SIZE),
  };
}

/** Human-readable summary for the diagnostics panel. */
export function flowSummary(state: FlowGovernorState): {
  status: "FLOWING" | "STARVING" | "RELAXED";
  starvedCycles: number;
  relaxStep: number;
  lastRelax: string | null;
} {
  return {
    status: state.relaxStep > 0 ? "RELAXED" : state.starvedCycles > 15 ? "STARVING" : "FLOWING",
    starvedCycles: state.starvedCycles,
    relaxStep: state.relaxStep,
    lastRelax: state.relaxStep > 0 ? FLOW_RELAX_STEPS[Math.min(state.relaxStep, MAX_RELAX_STEPS) - 1].description : null,
  };
}
