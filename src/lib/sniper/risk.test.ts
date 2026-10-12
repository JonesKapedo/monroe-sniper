import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyScratch } from "./mesh.ts";
import { brackets, kellyFraction, planEntry, snapshot, unrealized } from "./risk.ts";
import { defaultSettings, type Book, type Position, type Settings, type SymbolState, type Trade } from "./types.ts";

function sym(symbol: string, price: number): SymbolState {
  return { symbol, name: symbol, sector: "Test", price, mu: 0, sigma: 0.8, bias: 0, hist: [price] };
}

function pos(over: Partial<Position> = {}): Position {
  return {
    id: "p1",
    symbol: "SPY",
    side: "LONG",
    qty: 10,
    entry: 100,
    stop: 98,
    target: 104,
    openedAt: 0,
    confidence: 0.6,
    features: [],
    ...over,
  };
}

function book(over: Partial<Book> = {}): Book {
  return {
    seed: 1,
    minute: 0,
    cash: 10_000,
    symbols: [sym("SPY", 100)],
    positions: [],
    trades: [],
    ledger: [],
    signals: {},
    curve: [],
    model: { weights: [], samples: 0, correct: 0, recent: [], hits: [], notes: [], adaptLeft: 0 },
    activity: [],
    dayOpenEquity: 10_000,
    settings: defaultSettings,
    pinHash: null,
    lastWall: 0,
    board: null,
    statuses: [],
    scratch: emptyScratch(0),
    fills: [],
    working: [],
    rejects: [],
    orders: defaultSettings.orders,
    ...over,
  };
}

function trade(pnl: number, side: "LONG" | "SHORT" = "LONG"): Trade {
  return {
    id: `t${Math.abs(pnl)}`,
    symbol: "SPY",
    side,
    qty: 1,
    entry: 100,
    exit: 100 + pnl,
    pnl,
    openedAt: 0,
    closedAt: 1,
    reason: "TARGET",
    confidence: 0.6,
  };
}

describe("unrealized", () => {
  it("marks a long up and a short down off the current price", () => {
    const b = book({
      symbols: [sym("SPY", 105)],
      positions: [pos({ side: "LONG", entry: 100, qty: 10 }), pos({ id: "p2", side: "SHORT", entry: 100, qty: 5 })],
    });
    assert.equal(unrealized(b), 50 - 25);
  });

  it("falls back to entry when the symbol is missing", () => {
    const b = book({ symbols: [], positions: [pos({ entry: 100, qty: 4 })] });
    assert.equal(unrealized(b), 0);
  });
});

describe("brackets", () => {
  it("places a long stop below and target above entry", () => {
    const { stop, target } = brackets("LONG", 100, 0.01, 2);
    assert.equal(stop, 99);
    assert.equal(target, 102);
  });

  it("inverts both levels for a short", () => {
    const { stop, target } = brackets("SHORT", 100, 0.01, 2);
    assert.ok(stop > 100 && target < 100);
    assert.equal(stop, 101);
    assert.equal(target, 98);
  });
});

describe("kellyFraction", () => {
  it("holds the floor before eight closed trades", () => {
    assert.equal(kellyFraction([trade(5), trade(-3)], 0.12), 0.015);
  });

  it("caps a strong edge at the configured ceiling", () => {
    const winners = Array.from({ length: 20 }, () => trade(10));
    assert.ok(kellyFraction(winners, 0.12) <= 0.12);
  });

  it("returns the floor when every recent trade lost", () => {
    const losers = Array.from({ length: 12 }, () => trade(-4));
    assert.equal(kellyFraction(losers, 0.12), 0.008);
  });
});

describe("snapshot", () => {
  it("separates reserved notional from free cash and reports open risk", () => {
    const b = book({ cash: 10_000, positions: [pos({ entry: 100, stop: 95, qty: 10 })] , symbols: [sym("SPY", 100)]});
    const snap = snapshot(b);
    assert.equal(snap.reserved, 1000);
    assert.equal(snap.free, 9000);
    assert.equal(snap.openPnl, 0);
    assert.equal(snap.openRisk, 50);
  });

  it("never reports negative free cash", () => {
    const b = book({ cash: 500, positions: [pos({ entry: 100, qty: 20 })] });
    assert.equal(snapshot(b).free, 0);
  });
});

describe("planEntry", () => {
  it("sizes down to the per-slot cash when kelly is the binding cap", () => {
    const plan = planEntry(book(), 100, "LONG");
    assert.ok(plan);
    // Kelly floors risk to 1.5% of 10k = 150; the stop 1.2% of 100 = 1.2 wants 125
    // shares, but each of four slots only carries 2300 of cash → 23 shares.
    assert.equal(plan?.qty, 23);
    assert.ok((plan?.stop ?? 0) < 100 && (plan?.target ?? 0) > 100);
  });

  it("returns null when equity is gone or the price is unaffordable", () => {
    assert.equal(planEntry(book({ cash: 0, positions: [pos({ entry: 100, qty: 200 })] }), 100, "LONG"), null);
    assert.equal(planEntry(book({ cash: 10, positions: [pos({ entry: 100, qty: 100 })] }), 100, "LONG"), null);
  });

  it("never sizes below one share", () => {
    const tight: Settings = { ...defaultSettings, riskPerTrade: 0.005, useKelly: false };
    const plan = planEntry(book({ cash: 1_000, settings: tight }), 900, "LONG");
    assert.equal(plan, null);
  });
});
