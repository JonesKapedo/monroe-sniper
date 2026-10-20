import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  interpretPerpRegime,
  scorePerpEntry,
  selectDiversifiedEntries,
  symbolReentryBlocked,
} from "./entry-strategy";

describe("entry-strategy", () => {
  it("maps negative funding to LONG carry and positive to SHORT", () => {
    const longReg = interpretPerpRegime(-0.0001, 1_000_000);
    assert.equal(longReg?.side, "LONG");
    const shortReg = interpretPerpRegime(0.0001, 1_000_000);
    assert.equal(shortReg?.side, "SHORT");
  });

  it("diversifies across bases and respects slot count", () => {
    const ranked = [
      { id: "perp-btc-funding", symbol: "BTC-PERP", anchorSymbol: "BTC", category: "PERPS", confidenceScore: 90, entryScore: 90, perpSide: "LONG" as const, disciplineApproved: true },
      { id: "perp-eth-funding", symbol: "ETH-PERP", anchorSymbol: "ETH", category: "PERPS", confidenceScore: 88, entryScore: 88, perpSide: "SHORT" as const, disciplineApproved: true },
      { id: "perp-sol-funding", symbol: "SOL-PERP", anchorSymbol: "SOL", category: "PERPS", confidenceScore: 85, entryScore: 85, perpSide: "LONG" as const, disciplineApproved: true },
      { id: "perp-btc2-funding", symbol: "BTC-PERP", anchorSymbol: "BTC", category: "PERPS", confidenceScore: 99, entryScore: 99, perpSide: "LONG" as const, disciplineApproved: true },
    ];
    const picks = selectDiversifiedEntries(ranked, [], 2, 50);
    assert.equal(picks.length, 2);
    const bases = picks.map((p) => p.anchorSymbol);
    assert.equal(new Set(bases).size, 2);
  });

  it("blocks only the symbol that just closed", () => {
    const now = 1_000_000;
    const last = { BTC: now - 60_000 };
    assert.equal(symbolReentryBlocked("BTC", last, 30 * 60_000, now), true);
    assert.equal(symbolReentryBlocked("ETH", last, 30 * 60_000, now), false);
  });

  it("scores extreme funding lower than mild carry", () => {
    const mild = interpretPerpRegime(0.00005, 2_000_000)!;
    const hot = interpretPerpRegime(0.0005, 2_000_000)!;
    assert.ok(scorePerpEntry(80, mild) > scorePerpEntry(80, hot));
  });
});
