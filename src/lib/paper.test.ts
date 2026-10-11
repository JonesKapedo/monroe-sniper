import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyBook, enter, entryVerdict, sampleTape, setKill, simulateBuy } from "./paper.ts";

describe("paper desk", () => {
  it("blocks a thin fresh name", () => {
    const fresh = sampleTape().find((c) => c.symbol === "NEW");
    assert.ok(fresh);
    const v = entryVerdict(emptyBook(), fresh);
    assert.equal(v.allowed, false);
  });

  it("paper-buys a deep name and refuses a duplicate", () => {
    const weth = sampleTape().find((c) => c.symbol === "WETH");
    assert.ok(weth);
    const first = enter(emptyBook(), weth);
    assert.equal(first.ok, true);
    assert.equal(first.book.positions.length, 1);
    const second = enter(first.book, weth);
    assert.equal(second.ok, false);
  });

  it("kill switch blocks entries", () => {
    const weth = sampleTape().find((c) => c.symbol === "WETH");
    assert.ok(weth);
    const halted = setKill(emptyBook(), true);
    assert.equal(enter(halted, weth).ok, false);
  });

  it("rejects an oversized buy into a small pool", () => {
    const sim = simulateBuy(20_000, 1, 8_000);
    assert.equal(sim.acceptable, false);
  });
});
