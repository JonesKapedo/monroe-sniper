import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSymbol, parseTradingViewAlert } from "./tv-webhook";

test("normalizeSymbol strips exchange prefixes and punctuation", () => {
  assert.equal(normalizeSymbol("BINANCE:BTCUSDT"), "BTCUSDT");
  assert.equal(normalizeSymbol("btc/usdt"), "BTCUSDT");
  assert.equal(normalizeSymbol("CRV-USD"), "CRVUSD");
  assert.equal(normalizeSymbol(42), "");
});

test("parses a JSON alert object", () => {
  const r = parseTradingViewAlert({ symbol: "BINANCE:SOLUSDT", action: "long", price: 142.5, notional_usd: 50 });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.signal.symbol, "SOLUSDT");
    assert.equal(r.signal.side, "buy");
    assert.equal(r.signal.price, 142.5);
    assert.equal(r.signal.notionalUsd, 50);
  }
});

test("parses a JSON string body", () => {
  const r = parseTradingViewAlert('{"ticker":"BTCUSDT","side":"sell","price":"64000"}');
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.signal.side, "sell");
    assert.equal(r.signal.price, 64000);
  }
});

test("parses a plain-text alert", () => {
  const r = parseTradingViewAlert("BUY BTCUSDT @ 64000");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.signal.symbol, "BTCUSDT");
    assert.equal(r.signal.side, "buy");
    assert.equal(r.signal.price, 64000);
  }
});

test("rejects alerts without a side or symbol", () => {
  assert.equal(parseTradingViewAlert({ symbol: "BTCUSDT" }).ok, false);
  assert.equal(parseTradingViewAlert({ action: "buy" }).ok, false);
  assert.equal(parseTradingViewAlert("").ok, false);
  assert.equal(parseTradingViewAlert("just some words").ok, false);
});
