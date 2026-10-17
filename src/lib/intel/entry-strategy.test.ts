import { describe, expect, it } from "vitest";
import {
  interpretPerpRegime,
  scorePerpEntry,
  selectDiversifiedEntries,
  symbolReentryBlocked,
} from "./entry-strategy";

describe("entry-strategy", () => {
  it("maps positive funding to LONG carry and negative to SHORT", () => {
    const longReg = interpretPerpRegime(0.0001, 1_000_000);
    expect(longReg?.side).toBe("LONG");
    const shortReg = interpretPerpRegime(-0.0001, 1_000_000);
    expect(shortReg?.side).toBe("SHORT");
  });

  it("diversifies across bases and respects slot count", () => {
    const ranked = [
      { id: "perp-btc-funding", symbol: "BTC-PERP", anchorSymbol: "BTC", category: "PERPS", confidenceScore: 90, entryScore: 90, perpSide: "LONG" as const, disciplineApproved: true },
      { id: "perp-eth-funding", symbol: "ETH-PERP", anchorSymbol: "ETH", category: "PERPS", confidenceScore: 88, entryScore: 88, perpSide: "SHORT" as const, disciplineApproved: true },
      { id: "perp-sol-funding", symbol: "SOL-PERP", anchorSymbol: "SOL", category: "PERPS", confidenceScore: 85, entryScore: 85, perpSide: "LONG" as const, disciplineApproved: true },
      { id: "perp-btc2-funding", symbol: "BTC-PERP", anchorSymbol: "BTC", category: "PERPS", confidenceScore: 99, entryScore: 99, perpSide: "LONG" as const, disciplineApproved: true },
    ];
    const picks = selectDiversifiedEntries(ranked, [], 2, 50);
    expect(picks.length).toBe(2);
    const bases = picks.map((p) => p.anchorSymbol);
    expect(new Set(bases).size).toBe(2);
  });

  it("blocks only the symbol that just closed", () => {
    const now = 1_000_000;
    const last = { BTC: now - 60_000 };
    expect(symbolReentryBlocked("BTC", last, 30 * 60_000, now)).toBe(true);
    expect(symbolReentryBlocked("ETH", last, 30 * 60_000, now)).toBe(false);
  });

  it("scores extreme funding lower than mild carry", () => {
    const mild = interpretPerpRegime(0.00005, 2_000_000)!;
    const hot = interpretPerpRegime(0.0005, 2_000_000)!;
    expect(scorePerpEntry(80, mild)).toBeGreaterThan(scorePerpEntry(80, hot));
  });
});
