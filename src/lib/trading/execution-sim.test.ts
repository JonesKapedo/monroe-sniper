import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateImpactPct, simulateExecution, sizeFromLossBudget } from "./execution-sim";

describe("estimateImpactPct", () => {
  it("returns 2% when liquidity unknown", () => {
    assert.equal(estimateImpactPct(1000, null), 0.02);
  });
  it("scales with notional / liquidity", () => {
    const impact = estimateImpactPct(1000, 50_000);
    assert.ok(impact > 0 && impact < 0.05);
  });
  it("caps at 50%", () => {
    assert.equal(estimateImpactPct(1_000_000, 100), 0.5);
  });
});

describe("sizeFromLossBudget", () => {
  it("sizes from loss budget and stop", () => {
    // $40 loss budget, 8% stop → $500 notional
    const n = sizeFromLossBudget(40, 0.08, null);
    assert.equal(n, 500);
  });
  it("caps by liquidity impact", () => {
    const n = sizeFromLossBudget(40, 0.08, 1000, 0.03);
    // impact cap = 2 * 1000 * 0.03 = 60
    assert.equal(n, 60);
  });
});

describe("simulateExecution", () => {
  it("marks acceptable for small trade in deep pool", () => {
    const r = simulateExecution({
      side: "buy",
      notionalUsd: 100,
      midPriceUsd: 1,
      liquidityUsd: 500_000,
    });
    assert.equal(r.acceptable, true);
    assert.ok(r.fillPriceUsd > 1);
    assert.ok(r.qty > 0);
  });
  it("rejects when cost exceeds budget", () => {
    const r = simulateExecution({
      side: "buy",
      notionalUsd: 50_000,
      midPriceUsd: 1,
      liquidityUsd: 20_000,
      maxCostPct: 0.02,
    });
    assert.equal(r.acceptable, false);
    assert.ok(r.reasons.length > 0);
  });
});
