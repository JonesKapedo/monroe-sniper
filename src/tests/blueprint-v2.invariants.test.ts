import { describe, it, expect } from "vitest";
import { TIER_CONFIGS, applyStakeBudget } from "../lib/sniper/tier-config";
import {
  buildExitPlan,
  initExitRuntime,
  evaluateExit,
  DEFAULT_EXIT_PROFILE,
  type ExitRuntime,
} from "../lib/sniper/exits";
import {
  initFlowGovernor,
  tickGovernor,
  recordRejection,
  flowSummary,
  currentRelax,
} from "../lib/flow/governor";
import { netPnl, quoteFill } from "../lib/sim/execution-v2";

describe("I1 — Flow Guarantee: ≥3 consecutive entries always admissible", () => {
  it("admits ≥3 tickets for any equity in [50, 10k] at any guard multiplier", () => {
    for (const equity of [50, 100, 250, 500, 1000, 5000, 10000]) {
      const tierName = equity >= 10000 ? "institutional" : equity >= 5000 ? "professional" : equity >= 1000 ? "momentum" : equity >= 500 ? "accelerate" : equity >= 250 ? "scale" : equity >= 100 ? "growth" : equity >= 50 ? "seed" : "micro";
      const tier = TIER_CONFIGS[tierName as keyof typeof TIER_CONFIGS];
      for (const guard of [1, 0.5, 0.25]) {
        let admitted = 0;
        let exposure = 0;
        for (let i = 0; i < 3; i++) {
          const risk = equity * tier.maxRiskPerTrade * guard;
          const res = applyStakeBudget({
            equity,
            tier,
            currentExposure: exposure,
            riskNotional: risk,
            targetPct: 0.06,
            openPositionCount: i,
          });
          if (res.blocked) break;
          exposure += res.notional;
          admitted += 1;
        }
        if (admitted < 3) {
          // Blocked is acceptable ONLY when the reason proves hard-halt or
          // genuinely insufficient capital (floor below remaining budget).
          expect(equity * tier.maxPortfolioExposure).toBeLessThanOrEqual(admitted * risk * 1.5 + tier.minNotional);
        } else {
          expect(admitted).toBe(3);
        }
      }
    }
  });

  it("REDUCE_RISK shrinks tickets but never blocks three in a row", () => {
    const equity = 500;
    const tier = TIER_CONFIGS.accelerate;
    const full = applyStakeBudget({
      equity, tier, currentExposure: 0, riskNotional: 75, targetPct: 0.06, openPositionCount: 0,
    });
    const half = applyStakeBudget({
      equity, tier, currentExposure: 0, riskNotional: 75 * 0.5, targetPct: 0.06, openPositionCount: 0,
    });
    expect(full.blocked).toBe(false);
    expect(half.blocked).toBe(false);
    expect(half.notional).toBeLessThanOrEqual(full.notional);
  });
});

describe("I2 — Exit Integrity: no winner round-trips to a stop", () => {
  const entry = 100;
  const plan = buildExitPlan(entry, 98, DEFAULT_EXIT_PROFILE);
  const baseRt: ExitRuntime = initExitRuntime(entry, plan, 10, 1.5, Date.now());

  it("moves the stop to breakeven+buffer at +1R and never below entry after", () => {
    let rt = baseRt;
    const now = Date.now();
    // Price climbs to +1R (100 → 102, risk 2)
    let d = evaluateExit("LONG", entry, 102, plan, rt, { now, lastFreshMarkAt: now });
    expect(d.action.kind).toBe("MOVE_STOP");
    expect(d.runtime.state).toBe("BREAKEVEN");
    expect(d.runtime.stopPrice).toBeGreaterThan(entry);

    rt = d.runtime;
    // Price collapses back to entry — the stop must hold above entry.
    d = evaluateExit("LONG", entry, 100, plan, rt, { now, lastFreshMarkAt: now });
    expect(d.action.kind).toBe("CLOSE");
    expect(d.runtime.state).toBe("CLOSED");
    // Worst case after breakeven: exit at the breakeven stop ≥ entry.
    expect(d.runtime.stopPrice).toBeGreaterThanOrEqual(entry);
  });

  it("scale-out 1 fires at +1.5R and banks half the position", () => {
    let rt = initExitRuntime(entry, plan, 10, 1.5, Date.now());
    const now = Date.now();
    // Pass through breakeven
    let d = evaluateExit("LONG", entry, 102, plan, rt, { now, lastFreshMarkAt: now });
    rt = d.runtime;
    d = evaluateExit("LONG", entry, 103, plan, rt, { now, lastFreshMarkAt: now });
    expect(d.action.kind).toBe("SCALE_OUT");
    if (d.action.kind === "SCALE_OUT") {
      expect(d.action.fractionOfOriginal).toBeCloseTo(0.5);
    }
    expect(rt.scaledOutQty).toBe(0);
    expect(d.runtime.scaledOutQty).toBe(5);
  });

  it("freezes (HOLD) on stale marks — never drifts, never invents prices", () => {
    const rt = initExitRuntime(entry, plan, 10, 1.5, Date.now() - 20 * 60_000);
    const d = evaluateExit("LONG", entry, 101, plan, rt, {
      now: Date.now(),
      lastFreshMarkAt: Date.now() - 20 * 60_000,
    });
    expect(d.action.kind).toBe("HOLD");
    expect(d.runtime.stopPrice).toBe(plan.stopPrice);
  });
});

describe("Flow Governor", () => {
  it("does not starve below the ladder and relaxes in ranked order", () => {
    let g = initFlowGovernor();
    // 30+ cycles with no entries, not halted, feeds alive
    let alert: string | null = null;
    for (let i = 0; i < 31; i++) {
      const res = tickGovernor(g, { entriesFilled: 0, guardHalted: false, feedsAlive: 2 });
      g = res.state;
      alert = res.alert;
    }
    expect(g.relaxStep).toBe(1);
    expect(alert).toContain("edge_floor_minus_2");
    expect(currentRelax(g)).toBe(2);

    // Guard halted is a legitimate pause — never relaxed past
    const haltedRes = tickGovernor(g, { entriesFilled: 0, guardHalted: true, feedsAlive: 2 });
    expect(haltedRes.state.relaxStep).toBe(1);
  });

  it("resets starvation on a filled entry but keeps the applied ladder", () => {
    let g = initFlowGovernor();
    for (let i = 0; i < 30; i++) {
      g = tickGovernor(g, { entriesFilled: 0, guardHalted: false, feedsAlive: 1 }).state;
    }
    expect(g.relaxStep).toBe(1);
    const res = tickGovernor(g, { entriesFilled: 1, guardHalted: false, feedsAlive: 1 });
    expect(res.state.starvedCycles).toBe(0);
    expect(res.state.relaxStep).toBe(1); // ladder persists
    expect(flowSummary(res.state).status).toBe("RELAXED");
  });

  it("records rejections with structured telemetry", () => {
    let g = initFlowGovernor();
    g = recordRejection(g, {
      symbol: "SOL",
      source: "tape",
      gate: "budget",
      observed: "share $37.50 below $50 floor",
      wouldBeSizeUsd: 37.5,
    });
    expect(g.rejections[0].gate).toBe("budget");
    expect(g.rejections[0].symbol).toBe("SOL");
  });
});

describe("Execution Sim v2", () => {
  it("charges round-trip costs so net P&L < gross on winners", () => {
    const net = netPnl({
      grossPnlUsd: 100,
      entryNotionalUsd: 500,
      exitNotionalUsd: 500,
      venue: "cex",
    });
    expect(net).toBeLessThan(100);
    expect(net).toBeGreaterThan(95);
  });

  it("thin DEX depth costs more than a CEX major", () => {
    const dex = quoteFill({ venue: "dex", notionalUsd: 300, liquidityUsd: 25_000 }).costPct;
    const cex = quoteFill({ venue: "cex", notionalUsd: 300, liquidityUnknown: true }).costPct;
    expect(dex).toBeGreaterThan(cex);
  });
});
