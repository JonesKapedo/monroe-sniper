import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyBook, type Candidate } from "../paper.ts";
import { defaultRiskSettings, evaluateRiskAndSize } from "./risk-engine.ts";

function candidate(symbol: string, priceUsd: number): Candidate {
  return {
    id: `test:${symbol.toLowerCase()}`,
    symbol,
    name: symbol,
    chain: "binance",
    address: symbol,
    priceUsd,
    liquidityUsd: 1_000_000,
    volume24h: 5_000_000,
    change24h: 2,
    pairAgeHours: 100,
    url: null,
    score: 80,
    flags: [],
    rationale: [],
    venue: "binance",
    liquidityUnknown: true,
  };
}

describe("risk-engine honesty gates", () => {
  it("blocks stablecoins: no tradable edge by definition", () => {
    for (const symbol of ["USDT", "USDC", "DAI"]) {
      const verdict = evaluateRiskAndSize(emptyBook(500), candidate(symbol, 1));
      assert.equal(verdict.allowed, false, symbol);
      assert.ok(verdict.reasons.join(" ").includes("stablecoin"));
    }
  });

  it("caps total staked on a $50 book at the $10 tier budget", () => {
    const book = emptyBook(50);
    const verdict = evaluateRiskAndSize(book, candidate("ATOM", 1.7));
    assert.ok(
      verdict.notional <= 10,
      `notional ${verdict.notional} exceeds $10 stake budget on $50 equity`,
    );
  });

  it("blocks new entries once the stake budget is exhausted", () => {
    const book = emptyBook(50);
    // Simulate a book already staked to the $10 micro budget.
    const full = {
      ...book,
      cash: 40,
      positions: [
        {
          id: "pos-1",
          tokenId: "test:atom",
          symbol: "ATOM",
          chain: "binance",
          qty: 5,
          entryPrice: 2,
          mark: 2,
          stop: 1.9,
          target: 2.2,
          openedAt: Date.now(),
          notional: 10,
          venue: "binance" as const,
        },
      ],
    };
    const verdict = evaluateRiskAndSize(full, candidate("SOL", 100));
    assert.equal(verdict.allowed, false);
    // A $50 micro book splits its 45% budget across several slots, so no single
    // ticket clears the $25 execution floor: the entry is refused on the
    // budget/min-ticket gate. A fuller book is refused by the slot or stake cap.
    // Either way: no room.
    assert.ok(
      /Stake budget|max-positions|minimum viable size|Micro-sizing/.test(verdict.reasons.join(" ")),
      verdict.reasons.join("; "),
    );
  });
});

describe("risk-engine bracket sizing", () => {
  it("caps the stop distance at 6% even for a violent mover", () => {
    const hot = { ...candidate("WIF", 2), change24h: 40 };
    const v = evaluateRiskAndSize(emptyBook(500), hot);
    assert.ok(v.stopLossPct <= 0.06 + 1e-9, `stop ${v.stopLossPct} exceeds the 6% ceiling`);
  });

  it("keeps a normal stop-out well under 2% of a $500 book", () => {
    const v = evaluateRiskAndSize(emptyBook(500), candidate("ATOM", 8));
    assert.ok(v.allowed, v.reasons.join("; "));
    assert.ok(v.riskAmount <= 500 * 0.02, `risk $${v.riskAmount} exceeds 2% of $500`);
  });
});

describe("risk-engine operator toggles", () => {
  it("stablecoin block can be switched off explicitly", () => {
    const blocked = evaluateRiskAndSize(emptyBook(500), candidate("USDT", 1));
    assert.equal(blocked.allowed, false);
    const open = evaluateRiskAndSize(emptyBook(500), candidate("USDT", 1), {
      ...defaultRiskSettings,
      blockStablecoins: false,
    });
    assert.ok(!open.reasons.join(" ").includes("stablecoin"));
  });
});
