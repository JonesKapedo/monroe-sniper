import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { funding8hRate, fundingAprPct, parseHyperliquidFunding } from "./hyperliquid.ts";

describe("hyperliquid funding", () => {
  it("parses per-coin funding rows", () => {
    const rows = parseHyperliquidFunding([
      { universe: [{ name: "SOL" }, { name: "" }] },
      [
        { markPx: "184.4", funding: "0.00001", openInterest: "123.4" },
        { markPx: "1", funding: "0", openInterest: "1" },
      ],
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].coin, "SOL");
    assert.equal(rows[0].markPx, 184.4);
    assert.equal(rows[0].funding1h, 0.00001);
  });

  it("annualizes and re-bases funding rates", () => {
    assert.equal(funding8hRate(0.00001), 0.00008);
    assert.equal(fundingAprPct(0.00001), 8.76);
    assert.equal(funding8hRate(null), null);
    assert.deepEqual(parseHyperliquidFunding(null), []);
  });
});
