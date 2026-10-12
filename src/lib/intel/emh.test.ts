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
