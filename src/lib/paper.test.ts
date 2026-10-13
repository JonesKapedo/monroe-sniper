import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyBook, enter, entryVerdict, markBook, sampleTape, setKill, simulateBuy } from "./paper.ts";

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

  it("keeps entry conditions on a closed trade for durable learning", () => {
    const candidate = sampleTape().find((item) => item.symbol === "WETH");
    assert.ok(candidate);
    const opened = enter(emptyBook(), candidate);
    assert.equal(opened.ok, true);
    const position = opened.book.positions[0];
    assert.ok(position?.target);

    const closed = markBook(
      opened.book,
      { [position.tokenId]: position.target },
      position.openedAt + 1,
    ).trades[0];

    assert.ok(closed);
    assert.equal(closed.entryPrice, position.entryPrice);
    assert.equal(closed.exitPrice, position.target);
    assert.equal(closed.qty, position.qty);
    assert.equal(closed.entryScore, candidate.score);
    assert.equal(closed.entryLiquidityUsd, candidate.liquidityUsd);
  });

  it("keeps a position open in standby monitoring even after its stop or target is crossed", () => {
    const candidate = sampleTape().find((item) => item.symbol === "WETH");
    assert.ok(candidate);
    const opened = enter(emptyBook(), candidate);
    const position = opened.book.positions[0];
    assert.ok(position?.target);

    const marked = markBook(
      opened.book,
      { [position.tokenId]: position.target },
      position.openedAt + 7 * 60 * 60 * 1000,
      false,
    );

    assert.equal(marked.positions.length, 1);
    assert.equal(marked.positions[0]?.mark, position.target);
    assert.equal(marked.trades.length, 0);
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
