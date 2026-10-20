import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { avenueAnchorPrice, avenueAnchors, hydrateAvenuesWithFunding, scanAllAvenues } from "./engine.ts";
import { emptyBook } from "../paper.ts";

const tape = [
  { symbol: "SOL", priceUsd: 180, liquidityUsd: 5_000_000 },
  { symbol: "SOL/USDC", priceUsd: 181, liquidityUsd: 500 },
  { symbol: "BONK", priceUsd: 0.000022, liquidityUsd: 9_000_000 },
];

const liveSol = [{ coin: "SOL", markPx: 190.5, funding1h: -0.00001, openInterest: 1000 }];

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

  it("maps live avenue ids to their anchors", () => {
    const anchors = avenueAnchors(emptyBook(), undefined, Date.now(), { funding: liveSol });
    assert.equal(anchors.get("perp-sol-funding"), "SOL");
  });

  it("returns no avenues without live funding — nothing fabricated", () => {
    const cold = scanAllAvenues(emptyBook());
    assert.deepEqual(cold, []);
  });

  it("hydrates perp quotes with live funding and flags them", () => {
    const cold = scanAllAvenues(emptyBook());
    assert.deepEqual(cold, []);
    const hot = scanAllAvenues(emptyBook(), undefined, Date.now(), { funding: liveSol });
    const sol = hot.find((a) => a.id === "perp-sol-funding");
    assert.equal(sol?.priceA, 190.5);
    assert.equal(sol?.fundingRate8h, -0.00008);
    assert.equal(sol?.liveData, true);
    assert.equal(sol?.disciplineApproved, true);
    const hydrated = hydrateAvenuesWithFunding(hot, liveSol);
    assert.equal(hydrated.find((a) => a.id === "perp-sol-funding")?.priceA, 190.5);
  });

  it("auto-entry reads only live-validated avenues", () => {
    const hot = scanAllAvenues(emptyBook(), undefined, Date.now(), { funding: liveSol });
    const auto = hot.filter((a) => a.disciplineApproved && a.confidenceScore >= 80);
    assert.ok(auto.length > 0);
    assert.ok(auto.every((a) => a.liveData === true));
  });

  it("skips positive funding (long-only book cannot express shorts)", () => {
    const longOnly = scanAllAvenues(emptyBook(), undefined, Date.now(), {
      funding: [{ coin: "SOL", markPx: 190.5, funding1h: 0.00001, openInterest: 1000 }],
    });
    assert.deepEqual(longOnly, []);
  });

  it("surfaces SPOT_MOMENTUM swing avenues from the tape (not perps-only)", () => {
    const trending = [
      { symbol: "PEPE", priceUsd: 0.000011, liquidityUsd: 2_000_000, volume24h: 3_000_000, change24h: 9.5 },
      { symbol: "USDC", priceUsd: 1, liquidityUsd: 9_000_000, volume24h: 9_000_000, change24h: 0.1 },
    ];
    const found = scanAllAvenues(emptyBook(), undefined, Date.now(), { tape: trending });
    const spot = found.find((a) => a.category === "SPOT_MOMENTUM");
    assert.ok(spot, "expected a spot momentum avenue");
    assert.equal(spot?.anchorSymbol, "PEPE");
    assert.equal(spot?.perpSide, "LONG");
    assert.ok((spot?.confidenceScore ?? 0) >= 60);
    assert.ok(!found.some((a) => a.symbol === "USDC"), "stablecoins are never surfaced");
  });
});
