import assert from "node:assert/strict";
import test from "node:test";
import { memecoinExitProfile, memecoinVerdict, type MemeFeatures } from "./memecoin.ts";

const strong: MemeFeatures = {
  priority: 70,
  conviction: 0.8,
  crowdedness: "early",
  smart: 3,
  kol: 1,
  sniper: 1,
  bundler: 0.05,
  top10: 0.24,
  devHold: 0.03,
  devScore: 0.8,
  devSurvival: 0.8,
  devRugRate: 0,
  devInner: 5,
  devUnsafe: 0,
  devReskin: false,
  buyTax: 0,
  sellTax: 0,
  buyRatio: 0.62,
  chg5m: 0.05,
  chg1h: 0.35,
  turnover: 1.2,
  liquidity: 60_000,
  mcap: 300_000,
  ageMin: 40,
  honeypot: false,
  renounced: true,
  riskWarn: false,
  redFlags: [],
  mock: false,
};

test("grades a clean, early, dev-backed memecoin as tier A", () => {
  const v = memecoinVerdict(strong);
  assert.equal(v.ok, true);
  assert.equal(v.tier, "A");
  assert.ok(v.score >= 82, `score ${v.score}`);
  assert.ok(v.flags.includes("GMGN-A"));
  assert.ok(v.flags.includes("GMGN-SM"));
  assert.ok(v.flags.includes("GMGN-DEV"));
});

test("rejects bundled supply, thin pools, late bids and honeypots", () => {
  assert.equal(memecoinVerdict({ ...strong, bundler: 0.45 }).ok, false);
  assert.equal(memecoinVerdict({ ...strong, liquidity: 10_000 }).ok, false);
  assert.equal(memecoinVerdict({ ...strong, crowdedness: "late", buyRatio: 0.5 }).ok, false);
  assert.equal(memecoinVerdict({ ...strong, honeypot: true }).ok, false);
  assert.equal(memecoinVerdict({ ...strong, buyTax: 0.15 }).ok, false);
  assert.equal(memecoinVerdict({ ...strong, renounced: false }).ok, false);
});

test("rejects knowing there is no smart-money or KOL confluence", () => {
  assert.equal(memecoinVerdict({ ...strong, smart: 0, kol: 0 }).ok, false);
  const unknown = memecoinVerdict({ ...strong, smart: null, kol: null });
  assert.equal(unknown.ok, true);
});

test("keeps unknown-depth mock rows tradeable at a lower tier", () => {
  const v = memecoinVerdict({ ...strong, liquidity: 0, mock: true });
  assert.equal(v.ok, true);
  assert.notEqual(v.tier, "A");
  assert.ok(v.flags.includes("GMGN-DEPTH-UNKNOWN"));
  assert.ok(v.flags.includes("GMGN-MOCK"));
});

test("scales the exit ladder with conviction and speeds the training clock", () => {
  const a = memecoinExitProfile({ flags: ["GMGN-A"] }, { training: true });
  const b = memecoinExitProfile({ flags: ["GMGN-B"] }, { training: true });
  const c = memecoinExitProfile({ flags: ["GMGN-C"] }, { training: true });
  assert.equal(a.scaleOut2AtR, 4);
  assert.equal(b.scaleOut2AtR, 3.5);
  assert.equal(c.scaleOut2AtR, 3);
  assert.equal(a.timeStopMinutes, 45);
  assert.equal(b.timeStopMinutes, 30);
  assert.equal(c.timeStopMinutes, 20);
  assert.ok((a.runnerTrailAtrMult ?? 0) > (c.runnerTrailAtrMult ?? 0));
});
