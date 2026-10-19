import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bucketId, chooseEntry, emptyBook, emptyBucketBook, enter, entryVerdict, equity, floorFor, learnBuckets, markBook, sampleTape, setKill, simulateBuy, type Position } from "./paper.ts";

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

  it("holds several distinct names at once (multi-slot)", () => {
    let book = emptyBook();
    const taken: string[] = [];
    for (const c of sampleTape()) {
      const r = enter(book, c);
      if (r.ok) {
        book = r.book;
        taken.push(c.symbol);
      }
      if (book.positions.length >= 3) break;
    }
    assert.ok(
      book.positions.length >= 2,
      `expected multiple concurrent slots, got ${book.positions.length} (${taken.join(",")})`,
    );
  });

  it("keeps entry conditions on a closed trade for durable learning", () => {
    const candidate = sampleTape().find((item) => item.symbol === "WETH");
    assert.ok(candidate);
    const opened = enter(emptyBook(), candidate);
    assert.equal(opened.ok, true);
    const position = opened.book.positions[0];
    assert.ok(position?.stop);

    // Growth exit engine closes on stop hit (no fixed +6% full take-profit).
    // Entry conditions must still ride on the closed trade for learning.
    const closed = markBook(
      opened.book,
      { [position.tokenId]: position.stop },
      position.openedAt + 1,
    ).trades[0];

    assert.ok(closed);
    assert.equal(closed.entryPrice, position.entryPrice);
    assert.equal(closed.exitPrice, position.stop);
    assert.equal(closed.qty, position.qty);
    assert.equal(closed.entryScore, candidate.score);
    assert.equal(closed.entryLiquidityUsd, candidate.liquidityUsd);
    assert.equal(closed.reason, "STOP");
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
    const result = enter(halted, weth);
    assert.equal(result.ok, false);
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
    // Quote-less path is fail-closed: never invent marks for stops/targets.
    // Position stays open and simulated; dayPnl / streak untouched.
    // (Hard TIME close for aged stale marks is restored in markBook separately.)
    const aged = { ...avenuePosition(), openedAt: Date.now() - 9 * 60 * 60 * 1000 };
    const book = { ...emptyBook(), positions: [aged] };
    const held = markBook(book, {}, Date.now(), true);
    assert.equal(held.positions.length, 1);
    assert.equal(held.positions[0]?.markSimulated, true);
    assert.equal(held.trades.length, 0);
    assert.equal(held.dayPnl, 0);
    assert.equal(held.consecutiveLosses, 0);
  });

  it("keeps book equity frozen while marks are stale", () => {
    const book = { ...emptyBook(), positions: [avenuePosition()] };
    const before = equity(book);
    const after = markBook(book, {}, Date.now(), true);
    assert.equal(equity(after), before);
  });

  it("keeps venue, reason, and symbol evidence in separate buckets", () => {
    let book = emptyBucketBook();
    book = learnBuckets(book, "dex", "TARGET", "BONK", 10);
    book = learnBuckets(book, "dex", "TARGET", "BONK", 12);
    book = learnBuckets(book, "dex", "STOP", "WIF", -8);
    const global = { seen: 3, wins: 2, losses: 1, realized: 14, minScore: 52 };
    assert.equal(floorFor(book, global, "dex", "TARGET", "BONK"), 50);
    // A reason with no evidence falls back to global.
    assert.equal(floorFor(book, global, "dex", "STOP", "WIF"), 52);
  });

  it("gates on the most specific bucket with a voice", () => {
    let book = emptyBucketBook();
    book = learnBuckets(book, "dex", "TARGET", "BONK", 10);
    book = learnBuckets(book, "dex", "TARGET", "BONK", 12);
    book = learnBuckets(book, "dex", "TARGET", "BONK", 8);
    const global = { seen: 3, wins: 3, losses: 0, realized: 30, minScore: 52 };
    assert.equal(floorFor(book, global, "dex", "TARGET", "BONK"), 50);
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

describe("same-venue marking", () => {
  it("rejects a foreign-source quote: holds mark, no exits, no learning", () => {
    const weth = sampleTape().find((c) => c.symbol === "WETH");
    assert.ok(weth);
    const opened = enter(emptyBook(), weth, Date.now(), 0, { priceSource: "hyperliquid:WETH" });
    assert.equal(opened.ok, true);
    const position = opened.book.positions[0];
    // A tape quote for the same token id under a different source must not mark it.
    const marked = markBook(
      opened.book,
      { [position.tokenId]: position.entryPrice * 2 },
      position.openedAt + 1,
      true,
      { sources: { [position.tokenId]: "tape:foreign" } },
    );
    assert.equal(marked.positions.length, 1);
    assert.equal(marked.positions[0]?.mark, position.entryPrice);
    assert.equal(marked.trades.length, 0);
  });

  it("marks normally when the source matches", () => {
    const weth = sampleTape().find((c) => c.symbol === "WETH");
    assert.ok(weth);
    const opened = enter(emptyBook(), weth, Date.now(), 0, { priceSource: "tape:weth" });
    assert.equal(opened.ok, true);
    const position = opened.book.positions[0];
    // Growth ladder advances one state per mark: BE → SO1 → SO2 → runner.
    // Matching source must be accepted (not frozen). Drive to +2R for scale-out.
    const risk = Math.abs(position.entryPrice - position.stop) || position.entryPrice * 0.02;
    let book = opened.book;
    // +1R → arm breakeven
    book = markBook(
      book,
      { [position.tokenId]: position.entryPrice + risk },
      position.openedAt + 1,
      true,
      { sources: { [position.tokenId]: "tape:weth" } },
    );
    assert.equal(book.positions.length, 1);
    // +2R → scale-out 1 (partial TARGET trade, runner remains)
    book = markBook(
      book,
      { [position.tokenId]: position.entryPrice + 2 * risk },
      position.openedAt + 2,
      true,
      { sources: { [position.tokenId]: "tape:weth" } },
    );
    assert.equal(book.positions.length, 1, "runner stays open after scale-out");
    assert.ok(book.trades.length >= 1);
    assert.equal(book.trades[0]?.markSource, "tape:weth");
    assert.equal(book.trades[0]?.reason, "TARGET");
  });
});
