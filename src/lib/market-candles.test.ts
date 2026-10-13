import assert from "node:assert/strict";
import test from "node:test";
import { krakenIntervalFor, krakenPairFor, parseKrakenCandles } from "./market-candles.ts";

test("maps Tape pairs and timeframes to Kraken's public OHLC API", () => {
  assert.equal(krakenPairFor("BTCUSDT"), "XBTUSDT");
  assert.equal(krakenPairFor("DOGEUSDT"), "XDGUSDT");
  assert.equal(krakenPairFor("BNBUSDT"), "BNBUSDT");
  assert.equal(krakenPairFor("UNKNOWNUSDT"), null);
  assert.equal(krakenIntervalFor("1m"), 1);
  assert.equal(krakenIntervalFor("5m"), 5);
  assert.equal(krakenIntervalFor("15m"), 15);
  assert.equal(krakenIntervalFor("1h"), 60);
  assert.equal(krakenIntervalFor("1d"), null);
});

test("parses real Kraken OHLC rows and converts Unix seconds to milliseconds", () => {
  const candles = parseKrakenCandles({
    error: [],
    result: {
      XBTUSDT: [
        [1_700_000_000, "100", "110", "90", "105"],
        [1_700_000_300, "bad", "110", "90", "105"],
        [1_700_000_600, "105", "80", "90", "95"],
        ["last", 1],
      ],
    },
  });

  assert.deepEqual(candles, [
    { time: 1_700_000_000_000, open: 100, high: 110, low: 90, close: 105 },
  ]);
});

test("rejects Kraken API errors and responses without candle rows", () => {
  assert.throws(
    () => parseKrakenCandles({ error: ["EQuery:Unknown asset pair"], result: {} }),
    /Kraken API: EQuery:Unknown asset pair/,
  );
  assert.throws(() => parseKrakenCandles({ error: [], result: { last: 123 } }), /no OHLC rows/);
});
