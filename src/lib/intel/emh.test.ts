import assert from "node:assert/strict";
import test from "node:test";
import { assessEdge } from "./emh.ts";

const base = {
  score: 74,
  change24h: 4.2,
  liquidityUsd: 180_000,
  volume24h: 90_000,
  pairAgeHours: 30,
  flags: [] as string[],
};

test("skips a quiet mature name with no information edge", () => {
  const edge = assessEdge({ ...base, score: 70, change24h: 0.1, pairAgeHours: 400, volume24h: 1_000 });
  assert.equal(edge.act, false);
  assert.equal(edge.stance, "SKIP");
});

test("takes an early liquid print", () => {
  const edge = assessEdge({ ...base, pairAgeHours: 1.5, score: 72, change24h: 6 });
  assert.equal(edge.act, true);
  assert.equal(edge.stance, "EARLY");
});

test("stands down when social tone fights the move", () => {
  const agree = assessEdge({ ...base, sentiment: 0.8 });
  const fight = assessEdge({ ...base, sentiment: -0.8, score: 66, change24h: 1.3 });
  assert.equal(agree.act, true);
  assert.equal(fight.act, false);
});

test("honeypot is a hard skip", () => {
  const edge = assessEdge({ ...base, flags: ["HONEYPOT"] });
  assert.equal(edge.stance, "SKIP");
});

// --- Quality guards: no relax step may loosen these (the losing entries). ---

test("never chases a vertical blow-off, even fully relaxed", () => {
  for (const relax of [0, 1, 2, 3]) {
    const edge = assessEdge({ ...base, change24h: 90, volume24h: 260_000 }, relax);
    assert.equal(edge.act, false, `relax ${relax} must not admit a +90% pump`);
    assert.match(edge.why, /Vertical move/);
  }
});

test("never enters a pair under an hour old, even fully relaxed", () => {
  for (const relax of [0, 1, 2, 3]) {
    const edge = assessEdge({ ...base, pairAgeHours: 0.5, change24h: 6 }, relax);
    assert.equal(edge.act, false, `relax ${relax} must not admit a 0.5h pair`);
    assert.match(edge.why, /old/);
  }
});

test("never enters a book turning over faster than its own pool, even fully relaxed", () => {
  for (const relax of [0, 1, 2, 3]) {
    const edge = assessEdge({ ...base, change24h: 10, liquidityUsd: 40_000, volume24h: 56_000 }, relax);
    assert.equal(edge.act, false, `relax ${relax} must not admit 1.4x pool turnover`);
    assert.match(edge.why, /Turnover/);
  }
});

test("a trend needs real turnover — 6% of the pool is not a trend", () => {
  const edge = assessEdge({ ...base, change24h: 3, liquidityUsd: 100_000, volume24h: 6_000 });
  assert.equal(edge.act, false);
});

test("a real, mature trend still clears the raised participation floor", () => {
  const edge = assessEdge({ ...base, change24h: 4, liquidityUsd: 100_000, volume24h: 12_000, pairAgeHours: 40 });
  assert.equal(edge.act, true);
  assert.equal(edge.stance, "TREND");
});

test("CEX majors with unpublished depth are unaffected by the turnover guard", () => {
  const edge = assessEdge({
    ...base,
    liquidityUnknown: true,
    liquidityUsd: 0,
    volume24h: 0,
    pairAgeHours: null,
    score: 60,
    change24h: 2,
  });
  assert.equal(edge.act, true);
  assert.equal(edge.stance, "TREND");
});

