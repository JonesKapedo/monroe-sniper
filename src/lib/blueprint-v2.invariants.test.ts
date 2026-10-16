import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TIER_CONFIGS, applyStakeBudget, FLOW_RESERVE_TICKETS } from "./sniper/tier-config.ts";
import {
  buildExitPlan,
  initExitRuntime,
  evaluateExit,
  DEFAULT_EXIT_PROFILE,
  type ExitRuntime,
} from "./sniper/exits.ts";
import {
  initFlowGovernor,
  tickGovernor,
  recordRejection,
  flowSummary,
  currentRelax,
} from "./flow/governor.ts";
import { netPnl, quoteFill } from "./sim/execution-v2.ts";

/** Tier for an equity — mirrors detectTier without importing internals. */
function tierFor(equity: number) {
  const name =
    equity >= 10000 ? "institutional"
    : equity >= 5000 ? "professional"
    : equity >= 1000 ? "momentum"
    : equity >= 500 ? "accelerate"
    : equity >= 250 ? "scale"
    : equity >= 100 ? "growth"
    : equity >= 50 ? "seed"
    : "micro";
  return TIER_CONFIGS[name];
}

/**
 * Simulate 3 sequential entries. Prior tickets hold their slots while the
 * tier has capacity; once maxPositions would be exceeded the oldest ticket
 * has exited (turnover), freeing its stake — the real "consecutive" flow.
 */
function simulateThreeTickets(equity: number, guard: number) {
  const tier = tierFor(equity);
  const notionals: number[] = [];
  let admitted = 0;
  let lastBlockedReason = "";
  for (let i = 0; i < 3; i++) {
    const held = notionals.slice(Math.max(0, i - (tier.maxPositions - 1)));
    const exposure = held.reduce((s, n) => s + n, 0);
    const openCount = Math.min(i, tier.maxPositions - 1);
    // Risk-engine-shaped notional: risk budget ÷ ~10% effective stop.
    const riskNotional = equity * tier.maxRiskPerTrade * guard * 10;
    const res = applyStakeBudget({
      equity,
      tier,
      currentExposure: exposure,
      riskNotional,
      targetPct: 0.06,
      openPositionCount: openCount,
    });
    if (res.blocked) {
      lastBlockedReason = res.reason;
      break;
    }
    notionals.push(res.notional);
    admitted += 1;
  }
  return { admitted, lastBlockedReason };
}

describe("I1 — Flow Guarantee: ≥3 consecutive entries admissible", () => {
  it(`reserves ${FLOW_RESERVE_TICKETS} tickets for any equity ≥ $100 at full guard`, () => {
    for (const equity of [100, 250, 500, 1000, 5000, 10000]) {
      const { admitted } = simulateThreeTickets(equity, 1);
      assert.equal(admitted, 3, `equity $${equity} admitted only ${admitted} consecutive tickets`);
    }
  });

  it("keeps 3 tickets admissible under REDUCE_RISK (0.5× guard) — shrunk, never deadlocked", () => {
    for (const equity of [100, 250, 500, 1000, 5000, 10000]) {
      const { admitted } = simulateThreeTickets(equity, 0.5);
      assert.equal(admitted, 3, `equity $${equity} at 0.5× guard admitted only ${admitted}`);
    }
  });

  it("blocks only with an explicit capital reason at $50 micro — never silently", () => {
    const { admitted, lastBlockedReason } = simulateThreeTickets(50, 1);
    assert.ok(admitted < 3);
    assert.match(lastBlockedReason, /minimum ticket|budget exhausted/);
  });

  it("halved guard never yields a bigger ticket than full guard", () => {
    const tier = TIER_CONFIGS.accelerate;
    const full = applyStakeBudget({ equity: 500, tier, currentExposure: 0, riskNotional: 75, targetPct: 0.06, openPositionCount: 0 });
    const half = applyStakeBudget({ equity: 500, tier, currentExposure: 0, riskNotional: 75 * 0.5, targetPct: 0.06, openPositionCount: 0 });
    assert.equal(full.blocked, false);
    assert.equal(half.blocked, false);
    assert.ok(half.notional <= full.notional);
  });
});

describe("I2 — Exit Integrity: no winner round-trips to a stop", () => {
  const entry = 100;
  const plan = buildExitPlan(entry, 98, DEFAULT_EXIT_PROFILE);

  it("arms breakeven at +1R and the worst later outcome is a tiny win, not −1R", () => {
    let rt: ExitRuntime = initExitRuntime(entry, plan, 10, 1.5, Date.now());
    const now = Date.now();
    // Climb to +1R (risk 2 → mark 102)
    let d = evaluateExit("LONG", entry, 102, plan, rt, { now, lastFreshMarkAt: now });
    assert.equal(d.action.kind, "MOVE_STOP");
    assert.equal(d.state, "BREAKEVEN");
    assert.ok(d.runtime.stopPrice > entry, "breakeven stop must sit above entry");

    // Full collapse back to entry — the breakeven stop closes it, above entry.
    rt = d.runtime;
    d = evaluateExit("LONG", entry, 100, plan, rt, { now, lastFreshMarkAt: now });
    assert.equal(d.action.kind, "CLOSE");
    assert.equal(d.runtime.state, "CLOSED");
    assert.ok(d.runtime.stopPrice >= entry, "post-+1R stop may never be below entry");
  });

  it("banks 50% at +1.5R (scale-out 1) then 25% at +2.5R (scale-out 2)", () => {
    let rt = initExitRuntime(entry, plan, 10, 1.5, Date.now());
    const now = Date.now();
    // +1R first (arms breakeven)…
    rt = evaluateExit("LONG", entry, 102, plan, rt, { now, lastFreshMarkAt: now }).runtime;
    // …then +1.5R → scale-out 1
    let d = evaluateExit("LONG", entry, 103, plan, rt, { now, lastFreshMarkAt: now });
    assert.equal(d.action.kind, "SCALE_OUT");
    assert.equal((d.action as { fractionOfOriginal: number }).fractionOfOriginal, 0.5);
    assert.equal(d.runtime.scaledOutQty, 5);
    // …then +2.5R (risk 2 → mark 105) → scale-out 2
    d = evaluateExit("LONG", entry, 105, plan, d.runtime, { now, lastFreshMarkAt: now });
    assert.equal(d.action.kind, "SCALE_OUT");
    assert.equal((d.action as { fractionOfOriginal: number }).fractionOfOriginal, 0.25);
    assert.equal(d.runtime.scaledOutQty, 7.5);
  });

  it("trails the runner (Chandelier) and only ever tightens", () => {
    let rt = initExitRuntime(entry, plan, 10, 1.5, Date.now());
    const now = Date.now();
    rt = evaluateExit("LONG", entry, 102, plan, rt, { now, lastFreshMarkAt: now }).runtime; // breakeven
    rt = evaluateExit("LONG", entry, 103, plan, rt, { now, lastFreshMarkAt: now }).runtime; // scaled 1
    rt = evaluateExit("LONG", entry, 105, plan, rt, { now, lastFreshMarkAt: now }).runtime; // scaled 2
    // Runner stretches to 108, then the Chandelier trail should sit below the best mark.
    const d = evaluateExit("LONG", entry, 108, plan, rt, { now, lastFreshMarkAt: now });
    assert.ok(d.runtime.stopPrice > rt.stopPrice, "trail must only tighten upward for a LONG");
    assert.ok(d.runtime.stopPrice < 108, "Chandelier trail sits below the best mark");
    assert.equal(d.state, "RUNNER");
  });

  it("freezes (HOLD) on stale marks — never drifts, never invents prices", () => {
    const openedAt = Date.now() - 20 * 60_000;
    const rt = initExitRuntime(entry, plan, 10, 1.5, openedAt);
    const d = evaluateExit("LONG", entry, 101, plan, rt, {
      now: Date.now(),
      lastFreshMarkAt: openedAt,
    });
    assert.equal(d.action.kind, "HOLD");
    assert.equal(d.runtime.stopPrice, plan.stopPrice, "stale mark must not move the stop");
  });
});

describe("Flow Governor — starvation watchdog", () => {
  it("relaxes gates in ranked order after 30 starved cycles and never touches HALTs", () => {
    let g = initFlowGovernor();
    let alert: string | null = null;
    // Exactly 30 ticks: starvation counter reaches the threshold ON the 30th
    // tick, which fires the relax and its alert. (A 31st tick would reset the
    // counter to 0 after the relax and overwrite `alert` with null.)
    for (let i = 0; i < 30; i++) {
      const res = tickGovernor(g, { entriesFilled: 0, guardHalted: false, feedsAlive: 2 });
      g = res.state;
      alert = res.alert;
    }
    assert.equal(g.relaxStep, 1);
    assert.ok(alert !== null && alert.includes("edge_floor_minus_2"), "first relax must be the edge floor");
    assert.equal(currentRelax(g), 2);

    // A hard halt is a legitimate pause — the ladder never advances through it.
    const halted = tickGovernor(g, { entriesFilled: 0, guardHalted: true, feedsAlive: 2 });
    assert.equal(halted.state.relaxStep, 1);
  });

  it("resets starvation on a filled entry but keeps the applied ladder", () => {
    let g = initFlowGovernor();
    for (let i = 0; i < 30; i++) {
      g = tickGovernor(g, { entriesFilled: 0, guardHalted: false, feedsAlive: 1 }).state;
    }
    assert.equal(g.relaxStep, 1);
    const res = tickGovernor(g, { entriesFilled: 1, guardHalted: false, feedsAlive: 1 });
    assert.equal(res.state.starvedCycles, 0);
    assert.equal(res.state.relaxStep, 1);
    assert.equal(flowSummary(res.state).status, "RELAXED");
  });

  it("records structured rejection telemetry", () => {
    let g = initFlowGovernor();
    g = recordRejection(g, {
      symbol: "SOL",
      source: "tape",
      gate: "budget",
      observed: "share $37.50 below $50 floor",
      wouldBeSizeUsd: 37.5,
    });
    assert.equal(g.rejections[0].gate, "budget");
    assert.equal(g.rejections[0].symbol, "SOL");
  });
});

describe("Execution Sim v2 — net-of-cost P&L (I4)", () => {
  it("charges round-trip costs so net P&L < gross on winners", () => {
    const net = netPnl({
      grossPnlUsd: 100,
      entryNotionalUsd: 500,
      exitNotionalUsd: 500,
      venue: "cex",
    });
    assert.ok(net < 100);
    assert.ok(net > 95);
  });

  it("thin DEX depth costs more than an unknown-depth CEX major", () => {
    const dex = quoteFill({ venue: "dex", notionalUsd: 300, liquidityUsd: 25_000 }).costPct;
    const cex = quoteFill({ venue: "cex", notionalUsd: 300, liquidityUnknown: true }).costPct;
    assert.ok(dex > cex);
  });
});
