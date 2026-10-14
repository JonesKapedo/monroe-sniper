import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fibExtensions, fibReentryDelayMin, fibRetracements, nearestFibLevel, snapToFib } from "./fib.ts";
import { cosineSimilarity, isCorrelatedDuplicate, setupVector, winnerResemblance } from "./vectors.ts";

describe("fibonacci geometry", () => {
  it("lays retracements from high to low", () => {
    const levels = fibRetracements(200, 100);
    assert.equal(levels.length, 5);
    assert.ok(levels[0].price > levels[4].price);
    const golden = levels.find((l) => l.ratio === 0.618);
    assert.equal(golden?.price, 200 - 100 * 0.618);
  });

  it("extends targets from entry by stop distance", () => {
    const targets = fibExtensions(100, 4);
    assert.equal(targets[1].price, 100 + 4 * 1.618);
  });

  it("snaps only within tolerance", () => {
    const snapped = snapToFib(161.7, 200, 100, 0.01);
    assert.equal(snapped, 200 - 100 * 0.382);
    assert.equal(snapToFib(150, 200, 100, 0.001), 150);
  });

  it("spaces re-entry delays on fib minutes", () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5, 9].map(fibReentryDelayMin),
      [3, 5, 8, 13, 21, 21],
    );
    assert.equal(nearestFibLevel(0, 200, 100), null);
  });
});

describe("vector geometry", () => {
  it("scores identical setups at 1 and opposites at -1", () => {
    const a = setupVector({ change24h: 10, volume24h: 1000, liquidityUsd: 1000, score: 80 });
    assert.equal(cosineSimilarity(a, a), 1);
    const b = setupVector({ change24h: -40, volume24h: 0, liquidityUsd: 1000, score: 0 });
    assert.ok(cosineSimilarity(a, b) < 0.5);
  });

  it("is neutral with no winner history", () => {
    assert.equal(
      winnerResemblance(setupVector({ change24h: 5, score: 70 }), []),
      0.5,
    );
  });

  it("flags near-duplicate open risk", () => {
    const v = setupVector({ change24h: 8, volume24h: 2000, liquidityUsd: 2000, score: 75 });
    assert.equal(isCorrelatedDuplicate(v, [v]), true);
    assert.equal(
      isCorrelatedDuplicate(v, [setupVector({ change24h: -30, volume24h: 50, liquidityUsd: 5000, score: 20 })]),
      false,
    );
  });
});
