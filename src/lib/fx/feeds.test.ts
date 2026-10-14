import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fxIntervalFor, parseFrankfurterSpot, parseTwelveCandles } from "./twelvedata.ts";

describe("fx feeds", () => {
  it("maps chart timeframes to TwelveData intervals", () => {
    assert.equal(fxIntervalFor("1m"), "1min");
    assert.equal(fxIntervalFor("1h"), "1h");
  });

  it("parses TwelveData series oldest-first", () => {
    const candles = parseTwelveCandles({
      status: "ok",
      values: [
        { datetime: "2026-10-14 12:05:00", open: "1.1010", high: "1.1020", low: "1.1005", close: "1.1015" },
        { datetime: "2026-10-14 12:00:00", open: "1.1000", high: "1.1012", low: "1.0998", close: "1.1010" },
      ],
    });
    assert.equal(candles.length, 2);
    assert.ok(candles[0].time < candles[1].time);
    assert.equal(candles[1].close, 1.1015);
  });

  it("rejects TwelveData error payloads and bad rows", () => {
    assert.deepEqual(parseTwelveCandles({ status: "error", message: "nope" }), []);
    assert.deepEqual(parseTwelveCandles({ values: [{ datetime: "bad", open: "x" }] }), []);
  });

  it("reads Frankfurter base-to-USD spots", () => {
    assert.equal(parseFrankfurterSpot({ rates: { USD: 1.0852 } }, "EUR"), 1.0852);
    assert.equal(parseFrankfurterSpot({ rates: {} }, "EUR"), null);
    assert.equal(parseFrankfurterSpot({}, "USD"), 1);
  });
});
