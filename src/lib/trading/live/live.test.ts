import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LIVE_GUARDRAILS,
  checkLiveGuardrails,
  liveGuardrailsFromEnv,
  type LiveGuardrailsConfig,
} from "./guardrails.ts";
import { buildLiveStatus, krakenPair, krakenSign, resolveLiveProvider } from "./cex.ts";

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

test("live is disabled by default and the provider refuses orders", async () => {
  const status = buildLiveStatus();
  assert.equal(status.enabled, false);
  assert.equal(status.configured, false);
  assert.equal(status.venue, "disabled");
  const res = await resolveLiveProvider().placeOrder({ symbol: "BONK", side: "buy", notionalUsd: 10, priceUsd: 1, qty: 10, clientId: "c1" });
  assert.equal(res.ok, false);
});
