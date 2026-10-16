import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultRiskSettings, evaluateRiskAndSize } from "./risk-engine.ts";
import { emptyBook, sampleTape } from "../paper.ts";
import { setupVector } from "../math/vectors.ts";

function deepCandidate() {
  const weth = sampleTape().find((c) => c.symbol === "WETH");
  assert.ok(weth);
  return weth;
}

describe("turbo sizing profile", () => {
  it("sizes bigger than aggressive with the same gates", () => {
    const book = emptyBook();
    const cand = deepCandidate();
    const turbo = { ...defaultRiskSettings, sizingProfile: "TURBO" as const };
    const aggro = { ...defaultRiskSettings, sizingProfile: "AGGRESSIVE" as const };
    const t = evaluateRiskAndSize(book, cand, turbo, 0, Date.now(), undefined, "[degen]");
    const a = evaluateRiskAndSize(book, cand, aggro, 0, Date.now(), undefined, "[elvis]");
    assert.equal(t.allowed, true);
    assert.ok(t.notional >= a.notional);
    assert.ok(t.checks.some((c) => c.id === "fib-geometry"));
    assert.ok(t.checks.some((c) => c.id === "winner-resemblance"));
  });

  it("snaps turbo brackets to fib geometry and extends targets", () => {
    const book = emptyBook();
    const cand = deepCandidate();
    const turbo = { ...defaultRiskSettings, sizingProfile: "TURBO" as const };
    const v = evaluateRiskAndSize(book, cand, turbo, 0, Date.now(), undefined, "[degen]");
    assert.ok(v.stopLossPct > 0 && v.takeProfitPct > 0);
    assert.ok(v.riskRewardRatio >= 1.5);
  });

  it("blocks near-duplicate open risk only when overlays are provided", () => {
    const book = emptyBook();
    const cand = deepCandidate();
    const turbo = { ...defaultRiskSettings, sizingProfile: "TURBO" as const };
    const vec = setupVector({
      change24h: cand.change24h,
      volume24h: cand.volume24h,
      liquidityUsd: cand.liquidityUsd,
      score: cand.score,
    });
    const blocked = evaluateRiskAndSize(book, cand, turbo, 0, Date.now(), {
      winnerVectors: [],
      openVectors: [vec],
    }, "[degen]");
    assert.ok(blocked.checks.some((c) => c.id === "correlation" && !c.pass));
    assert.equal(blocked.allowed, false);
    // Without overlays the same trade is untouched (existing callers safe).
    const plain = evaluateRiskAndSize(book, cand, turbo, 0, Date.now(), undefined, "[degen]");
    assert.ok(!plain.checks.some((c) => c.id === "correlation"));
  });

  it("keeps kill switch and score floor supreme in turbo", () => {
    const book = emptyBook();
    const cand = deepCandidate();
    const turbo = { ...defaultRiskSettings, sizingProfile: "TURBO" as const };
    const gated = evaluateRiskAndSize(book, cand, turbo, 99, Date.now(), undefined, "[degen]");
    assert.equal(gated.allowed, false);
  });
});
