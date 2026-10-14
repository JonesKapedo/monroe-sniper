import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { avenueAnchorPrice, avenueAnchors, hydrateAvenuesWithFunding, scanAllAvenues } from "./engine.ts";
import { emptyBook } from "../paper.ts";

const tape = [
  { symbol: "SOL", priceUsd: 180, liquidityUsd: 5_000_000 },
  { symbol: "SOL/USDC", priceUsd: 181, liquidityUsd: 500 },
  { symbol: "BONK", priceUsd: 0.000022, liquidityUsd: 9_000_000 },
];

describe("avenue anchors", () => {
  it("resolves an anchor to the deepest pool quote", () => {
    assert.equal(avenueAnchorPrice("SOL", tape), 180);
    assert.equal(avenueAnchorPrice("sol", tape), 180);
    assert.equal(avenueAnchorPrice("BONK", tape), 0.000022);
  });

  it("returns null when the tape has no quote for the anchor", () => {
    assert.equal(avenueAnchorPrice("APEX", tape), null);
    assert.equal(avenueAnchorPrice("SOL", []), null);
  });

  it("maps every anchored avenue id", () => {
    const anchors = avenueAnchors(emptyBook());
    assert.equal(anchors.get("perp-sol-funding"), "SOL");
    assert.equal(anchors.get("arb-bonk-sol"), "BONK");
    assert.equal(anchors.get("yield-jitosol-basis"), "SOL");
    // Synthetic launches stay anchorless (simulated drift).
    assert.ok(!anchors.has("ipo-pump-grad-sol"));
    assert.ok(!anchors.has("ipo-base-fairlaunch"));
  });

  it("hydrates perp quotes with live funding and flags them", () => {
    const avenues = scanAllAvenues(emptyBook());
    const before = avenues.find((a) => a.id === "perp-sol-funding");
    const hydrated = hydrateAvenuesWithFunding(avenues, [
      { coin: "SOL", markPx: 190.5, funding1h: 0.00001, openInterest: 1000 },
    ]);
    const sol = hydrated.find((a) => a.id === "perp-sol-funding");
    assert.equal(sol?.priceA, 190.5);
    assert.equal(sol?.fundingRate8h, 0.00008);
    assert.equal(sol?.liveData, true);
    assert.equal(before?.liveData, undefined);
    // Non-perps and unmatched coins are untouched.
    const arb = hydrated.find((a) => a.id === "arb-bonk-sol");
    assert.equal(arb?.liveData, undefined);
  });
});
