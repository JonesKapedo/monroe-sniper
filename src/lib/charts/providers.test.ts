import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { geckoOhlcvUrl, mergeTickIntoCandles, parseGeckoOhlcv } from "./geckoterminal.ts";
import { parseJupiterPrices } from "./jupiter.ts";

describe("geckoterminal", () => {
  it("builds a minute-aggregate OHLCV url", () => {
    const url = geckoOhlcvUrl("pool123", "15m", 48);
    assert.ok(url.includes("/pools/pool123/ohlcv/minute?aggregate=15&limit=48"));
  });

  it("parses rows into time-ordered candles", () => {
    const payload = {
      data: {
        attributes: {
          ohlcv_list: [
            [1791977100, 106.81, 107.08, 106.54, 106.82, 3832],
            [1791976800, 106.78, 107.08, 106.51, 106.81, 8382],
          ],
        },
      },
    };
    const candles = parseGeckoOhlcv(payload);
    assert.equal(candles.length, 2);
    assert.ok(candles[0].time < candles[1].time);
    assert.equal(candles[1].open, 106.81);
    assert.equal(candles[1].close, 106.82);
  });

  it("normalizes inverted high/low instead of inverting the chart", () => {
    const candles = parseGeckoOhlcv({
      data: { attributes: { ohlcv_list: [[1791977100, 100, 90, 110, 105, 10]] } },
    });
    assert.equal(candles[0].high, 110);
    assert.equal(candles[0].low, 90);
  });

  it("drops malformed rows and non-object payloads", () => {
    assert.deepEqual(parseGeckoOhlcv(null), []);
    assert.deepEqual(parseGeckoOhlcv({ data: { attributes: { ohlcv_list: [[0, -1, 0, 0, 0, 0]] } } }), []);
  });

  it("extends the open bucket with a live tick", () => {
    const base = [
      { time: 600_000, open: 100, high: 101, low: 99, close: 100.5 },
    ];
    const next = mergeTickIntoCandles(base, 102, 600_000 + 30_000, 60_000);
    assert.equal(next.length, 1);
    assert.equal(next[0].close, 102);
    assert.equal(next[0].high, 102);
    assert.equal(next[0].low, 99);
  });

  it("rolls a new bucket when the tick is newer", () => {
    const base = [{ time: 600_000, open: 100, high: 101, low: 99, close: 100.5 }];
    const next = mergeTickIntoCandles(base, 103, 660_000, 60_000);
    assert.equal(next.length, 2);
    assert.equal(next[1].open, 100.5);
    assert.equal(next[1].close, 103);
  });
});

describe("jupiter ticks", () => {
  it("parses keyed prices and skips unknown mints", () => {
    const ticks = parseJupiterPrices(
      {
        SOL: { usdPrice: 180.5, liquidity: 900000, priceChange24h: 1.2, blockId: 42 },
      },
      ["SOL", "MISSING"],
    );
    assert.equal(ticks.length, 1);
    assert.equal(ticks[0].usdPrice, 180.5);
    assert.equal(ticks[0].liquidityUsd, 900000);
    assert.equal(ticks[0].change24h, 1.2);
  });

  it("rejects non-positive prices", () => {
    assert.deepEqual(parseJupiterPrices({ X: { usdPrice: 0 } }, ["X"]), []);
  });
});
