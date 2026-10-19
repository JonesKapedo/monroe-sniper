import test from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import {
  DEFAULT_LIVE_GUARDRAILS,
  checkLiveGuardrails,
  liveGuardrailsFromEnv,
  type LiveGuardrailsConfig,
} from "./guardrails.ts";
import {
  binanceSign,
  binanceSymbol,
  buildLiveStatus,
  coinbaseJwt,
  coinbaseProduct,
  krakenPair,
  krakenSign,
  resolveLiveProvider,
  venueLabel,
} from "./cex.ts";

const cfg: LiveGuardrailsConfig = { maxNotionalUsd: 100, dailyLossLimitUsd: 50, maxOpenPositions: 2, allowlist: ["BONK", "WIF"] };
const base = { symbol: "BONK", side: "buy" as const, notionalUsd: 40, priceUsd: 1, realizedTodayUsd: 0, openPositions: 0 };

test("live guardrails: a clean order is allowed", () => {
  assert.deepEqual(checkLiveGuardrails(cfg, base), { allowed: true });
});

test("live guardrails: notional cap is enforced", () => {
  const v = checkLiveGuardrails(cfg, { ...base, notionalUsd: 250 });
  assert.equal(v.allowed, false);
  assert.equal(v.allowed === false && v.code, "NOTIONAL_CAP");
});

test("live guardrails: allowlist blocks unknown symbols", () => {
  const v = checkLiveGuardrails(cfg, { ...base, symbol: "DOGE" });
  assert.equal(v.allowed, false);
  assert.equal(v.allowed === false && v.code, "NOT_ALLOWED");
});

test("live guardrails: daily loss halts entries", () => {
  const v = checkLiveGuardrails(cfg, { ...base, realizedTodayUsd: -50 });
  assert.equal(v.allowed, false);
  assert.equal(v.allowed === false && v.code, "DAILY_LOSS");
});

test("live guardrails: max open positions blocks buys but not sells", () => {
  const buy = checkLiveGuardrails(cfg, { ...base, openPositions: 2 });
  assert.equal(buy.allowed === false && buy.code, "MAX_POSITIONS");
  assert.deepEqual(checkLiveGuardrails(cfg, { ...base, side: "sell", openPositions: 2 }), { allowed: true });
});

test("live guardrails: bad notional and price are rejected", () => {
  assert.equal(checkLiveGuardrails(cfg, { ...base, notionalUsd: 0 }).allowed, false);
  assert.equal(checkLiveGuardrails(cfg, { ...base, priceUsd: -1 }).allowed, false);
});

test("live guardrails: env overrides and allowlist parsing", () => {
  const g = liveGuardrailsFromEnv({ SNIPER_LIVE_MAX_NOTIONAL_USD: "250", SNIPER_LIVE_DAILY_LOSS_USD: "80", SNIPER_LIVE_ALLOWLIST: " bonk , wif ," });
  assert.equal(g.maxNotionalUsd, 250);
  assert.equal(g.dailyLossLimitUsd, 80);
  assert.equal(g.maxOpenPositions, DEFAULT_LIVE_GUARDRAILS.maxOpenPositions);
  assert.deepEqual(g.allowlist, ["BONK", "WIF"]);
});

test("kraken pair mapping", () => {
  assert.equal(krakenPair("BONK"), "BONKUSD");
  assert.equal(krakenPair("sol"), "SOLUSD");
  assert.equal(krakenPair("WIFUSD"), "WIFUSD");
});

test("kraken sign is deterministic and nonce-sensitive", () => {
  const secret = Buffer.from("test-secret").toString("base64");
  const a = krakenSign("/0/private/Balance", {}, secret, 1_600_000_000_000);
  const b = krakenSign("/0/private/Balance", {}, secret, 1_600_000_000_000);
  const c = krakenSign("/0/private/Balance", {}, secret, 1_600_000_000_001);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[A-Za-z0-9+/=]+$/);
});

test("binance symbol mapping and signature", () => {
  assert.equal(binanceSymbol("BONK"), "BONKUSDT");
  assert.equal(binanceSymbol("sol"), "SOLUSDT");
  const sig = binanceSign("symbol=BONKUSDT&side=BUY", "topsecret");
  assert.equal(sig, binanceSign("symbol=BONKUSDT&side=BUY", "topsecret"));
  assert.match(sig, /^[0-9a-f]{64}$/);
  assert.notEqual(sig, binanceSign("symbol=BONKUSDT&side=SELL", "topsecret"));
});

test("coinbase product mapping and ES256 JWT verifies", () => {
  assert.equal(coinbaseProduct("BONK"), "BONK-USD");
  assert.equal(coinbaseProduct("sol"), "SOL-USD");
  assert.equal(coinbaseProduct("BTC-USD"), "BTC-USD");
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const jwt = coinbaseJwt("organizations/x/apiKeys/y", pem, "POST", "/api/v3/brokerage/orders");
  const [header, payload, signature] = jwt.split(".");
  assert.equal(header && payload && signature ? 3 : 0, 3);
  const ok = createVerify("SHA256")
    .update(`${header}.${payload}`)
    .verify(publicKey, Buffer.from(signature!, "base64url"));
  assert.equal(ok, true);
});

test("venue labels cover all adapters", () => {
  assert.equal(venueLabel("kraken"), "Kraken");
  assert.equal(venueLabel("binance"), "Binance");
  assert.equal(venueLabel("coinbase"), "Coinbase");
  assert.equal(venueLabel("disabled"), "None");
});

test("live is disabled by default and the provider refuses orders", async () => {
  const status = buildLiveStatus();
  assert.equal(status.enabled, false);
  assert.equal(status.configured, false);
  assert.equal(status.venue, "disabled");
  const res = await resolveLiveProvider().placeOrder({ symbol: "BONK", side: "buy", notionalUsd: 10, priceUsd: 1, qty: 10, clientId: "c1" });
  assert.equal(res.ok, false);
});
