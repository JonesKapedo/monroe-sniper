import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chooseEntry, emptyBook, enter, entryVerdict, equity, markBook, sampleTape, setKill, simulateBuy, type Position } from "./paper.ts";

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

  it("holds unpriced positions stale: no drift, no stop/target on invented prices", () => {
    const book = { ...emptyBook(), positions: [avenuePosition()] };
    const held = markBook(book, {}, Date.now(), true);
    assert.equal(held.positions[0]?.mark, 0.042);
    assert.equal(held.positions[0]?.markSimulated, true);
    assert.equal(held.trades.length, 0);
  });

  it("flags stale closes simulated and keeps them out of learning counters", () => {
    const aged = { ...avenuePosition(), openedAt: Date.now() - 7 * 60 * 60 * 1000 };
    const book = { ...emptyBook(), positions: [aged] };
    const closed = markBook(book, {}, Date.now(), true);
    assert.equal(closed.trades.length, 1);
    assert.equal(closed.trades[0]?.simulated, true);
    assert.equal(closed.dayPnl, 0);
    assert.equal(closed.consecutiveLosses, 0);
  });

  it("keeps book equity frozen while marks are stale", () => {
    const book = { ...emptyBook(), positions: [avenuePosition()] };
    const before = equity(book);
    const after = markBook(book, {}, Date.now(), true);
    assert.equal(equity(after), before);
  });

  it("vetoes verified hard-rejects no matter the score", () => {
    const book = emptyBook();
    const tape = sampleTape();
    const open = chooseEntry(book, tape, 0, Date.now(), () => "unknown");
    assert.ok(open);
    const blocked = chooseEntry(book, tape, 0, Date.now(), (id) =>
      id === open.id ? "reject" : "unknown",
    );
    assert.ok(!blocked || blocked.id !== open.id);
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
