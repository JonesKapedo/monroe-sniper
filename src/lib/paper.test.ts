import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyBook, enter, entryVerdict, equity, markBook, sampleTape, setKill, simulateBuy, type Position } from "./paper.ts";

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

  function avenuePosition(): Position {
    return {
      id: "pos-avenue-1",
      tokenId: "ipo-pump-grad-sol",
      symbol: "APEX/SOL",
      chain: "solana",
      qty: 100,
      entryPrice: 0.042,
      mark: 0.042,
      stop: 0.0399,
      target: 0.0567,
      openedAt: Date.now(),
      notional: 4.2,
    };
  }

  it("leaves an unpriced avenue position frozen unless drift is allowed", () => {
    const book = { ...emptyBook(), positions: [avenuePosition()] };
    const kept = markBook(book, {}, Date.now(), true);
    assert.equal(kept.positions[0]?.mark, 0.042);
    assert.ok(!kept.positions[0]?.markSimulated);
  });

  it("walks an unpriced avenue mark and flags it simulated", () => {
    const book = { ...emptyBook(), positions: [avenuePosition()] };
    const drifted = markBook(book, {}, Date.now(), true, {
      driftIds: new Set(["ipo-pump-grad-sol"]),
      driftAmp: 0.5,
    });
    const pos = drifted.positions[0];
    // Either still open with a moved, flagged mark, or closed by a barrier.
    const moved = pos ? pos.mark !== 0.042 && pos.markSimulated === true : true;
    const closed = drifted.trades.length === 1;
    assert.ok(moved || closed);
  });

  it("moves book equity when avenue marks move", () => {
    const book = { ...emptyBook(), positions: [avenuePosition()] };
    const before = equity(book);
    const after = markBook(book, {}, Date.now(), true, {
      driftIds: new Set(["ipo-pump-grad-sol"]),
      driftAmp: 0.5,
    });
    assert.ok(equity(after) !== before || after.trades.length > 0);
  });

  it("clears the simulated flag once a live quote returns", () => {
    const book = {
      ...emptyBook(),
      positions: [{ ...avenuePosition(), mark: 0.05, markSimulated: true }],
    };
    const quoted = markBook(book, { "ipo-pump-grad-sol": 0.051 }, Date.now(), false);
    assert.equal(quoted.positions[0]?.mark, 0.051);
    assert.ok(!quoted.positions[0]?.markSimulated);
  });
});
