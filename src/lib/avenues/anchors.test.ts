import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { avenueAnchorPrice, avenueAnchors } from "./engine.ts";
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
});
