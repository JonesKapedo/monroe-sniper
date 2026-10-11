import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PRIOR, features, freshModel, predict, train } from "./model.ts";
import type { ModelState, SymbolState } from "./types.ts";

function sym(over: Partial<SymbolState> = {}): SymbolState {
  return {
    symbol: "SPY",
    name: "S&P 500",
    sector: "Index",
    price: 100,
    mu: 0,
    sigma: 0.8,
    bias: 0,
    hist: [100, 101, 102, 103],
    ...over,
  };
}

function rising(seed = 100, n = 40): SymbolState {
  const hist = Array.from({ length: n }, (_, i) => seed * (1 + 0.004 * i));
  return sym({ hist, price: hist[hist.length - 1] ?? seed });
}

describe("features", () => {
  it("returns the prior shape with a zero bias when history is short", () => {
    const f = features(sym({ hist: [100, 101] }));
    assert.deepEqual(f, [1, 0, 0, 0, 0, 0, 0]);
  });

  it("keeps the full seven-feature shape on a long history", () => {
    const f = features(rising());
    assert.equal(f.length, 7);
    assert.equal(f[0], 1);
    for (const value of f) assert.ok(Number.isFinite(value));
  });

  it("reads a rising series as positive momentum", () => {
    assert.ok((features(rising())[1] ?? 0) > 0);
  });
});

describe("predict", () => {
  it("returns 0.5 when weights and input are empty", () => {
    assert.equal(predict([], []), 0.5);
  });

  it("stays inside the unit interval across extreme weights", () => {
    const p = predict([100, -100], [100, 100]);
    assert.ok(p >= 0 && p <= 1);
    assert.ok(p < 1);
  });

  it("is monotone in the weighted sum", () => {
    assert.ok(predict([1], [2]) > predict([1], [-2]));
  });
});

describe("train", () => {
  it("keeps the state untouched when the feature shape disagrees", () => {
    const model = freshModel();
    assert.equal(train(model, [1, 2], 1, 1), model);
  });

  it("nudges weights toward a correct label", () => {
    const model = freshModel();
    const input = [1, 2, -1, 0, 0, 0, 0];
    const before = predict(model.weights, input);
    const next = train(model, input, 1, 1);
    const after = predict(next.weights, input);
    assert.ok(after > before);
    assert.equal(next.samples, 1);
    assert.equal(next.correct, 1);
    assert.deepEqual(next.recent, [true]);
  });

  it("counts a miss and does not inflate the hit rate", () => {
    const next = train(freshModel(), [1, -3, 0, 0, 0, 0, 0], 1, 1);
    assert.equal(next.correct, 0);
    assert.deepEqual(next.recent, [false]);
  });

  it("decays the adaptation window by one each episode", () => {
    const model: ModelState = { ...freshModel(), adaptLeft: 3 };
    assert.equal(train(model, [...PRIOR.map(() => 0)], 1, 1).adaptLeft, 2);
  });

  it("caps retained history at forty results and appends a hit point", () => {
    let model = freshModel();
    for (let i = 0; i < 60; i++) model = train(model, [1, -1, 0, 0, 0, 0, 0], 0, i);
    assert.ok(model.recent.length <= 40);
    assert.equal(model.hits.length, 60);
    assert.equal(model.samples, 60);
  });

  it("writes a note every sixth close and keeps the log bounded", () => {
    let model = freshModel();
    for (let i = 0; i < 300; i++) model = train(model, [1, 2, 0, 0, 0, 0, 0], 1, i);
    assert.ok(model.notes.length <= 24);
    assert.ok(model.notes.length > 1);
  });

  it("clamps every weight inside the stability band", () => {
    let model = freshModel();
    for (let i = 0; i < 200; i++) model = train(model, [1, 100, 100, 100, 100, 100, 100], 1, i);
    for (const w of model.weights) assert.ok(w >= -2.5 && w <= 2.5);
  });
});
