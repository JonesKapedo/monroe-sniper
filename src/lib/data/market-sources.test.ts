import assert from "node:assert/strict";
import test from "node:test";
import { chainIdFor, normalizeChain, normalizeDexPair, scoreOpportunity, type SecurityReport, type TokenMetrics } from "./market-sources.ts";
const metrics: TokenMetrics = {
  chain: "ethereum", address: "0xabc", symbol: "TEST", name: "Test Token", priceUsd: 0.1,
  liquidityUsd: 250_000, volume24h: 80_000, marketCap: 1_000_000, fdv: 1_000_000,
  priceChange24h: 12, buys24h: 100, sells24h: 80, pairCreatedAt: Date.now() - 72 * 3_600_000,
  url: null, fetchedAt: Date.now(),
};
const clean: SecurityReport = {
  honeypot: false, lpLocked: true, ownerCanMint: false, ownerCanFreeze: false, buyTax: 0, sellTax: 0,
  verified: true, checkedAt: Date.now(), providers: ["GoPlus", "honeypot.is"], details: [],
};
test("normalizes chain names and IDs", () => {
  assert.equal(normalizeChain("56"), "bsc");
  assert.equal(normalizeChain("ethereum"), "ethereum");
  assert.equal(chainIdFor("base"), "8453");
  assert.equal(chainIdFor("unknown"), null);
});
test("normalizes DexScreener pairs and rejects addressless data", () => {
  const pair = normalizeDexPair({ chainId: "base", baseToken: { address: "0xabc", symbol: "tst", name: "Test" },
    priceUsd: "0.12", liquidity: { usd: 1234 }, volume: { h24: 5000 }, priceChange: { h24: 7 },
    txns: { h24: { buys: 20, sells: 8 } } });
  assert.ok(pair);
  assert.equal(pair.symbol, "TST");
  assert.equal(pair.priceUsd, 0.12);
  assert.equal(pair.chain, "base");
  assert.equal(normalizeDexPair({ baseToken: { symbol: "no address" } }), null);
});
test("missing security evidence is never safe or entry eligible", () => {
  const signal = scoreOpportunity(metrics, null);
  assert.equal(signal.securityVerified, false);
  assert.equal(signal.tradableInPaperMode, false);
  assert.ok(signal.flags.includes("SECURITY-UNVERIFIED"));
  assert.notEqual(signal.risk, "safe");
});
test("clean verified token only passes when composite score reaches 70", () => {
  const signal = scoreOpportunity(metrics, clean);
  assert.equal(signal.securityVerified, true);
  assert.equal(signal.tradableInPaperMode, signal.score >= 70);
});
test("honeypot and mint authority always hard reject", () => {
  assert.equal(scoreOpportunity(metrics, { ...clean, honeypot: true }).tradableInPaperMode, false);
  assert.equal(scoreOpportunity(metrics, { ...clean, ownerCanMint: true }).tradableInPaperMode, false);
});
