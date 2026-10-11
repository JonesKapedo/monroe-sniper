import assert from "node:assert/strict";
import test from "node:test";
import type { OpportunitySignal, SecurityReport, TokenMetrics } from "./market-sources.ts";
import {
  MAX_PAPER_POSITIONS, applyPaperMarketUpdates, createPaperPortfolio, enterPaperPosition,
  evaluateRiskGate, paperEquityUsd, paperExposureUsd,
} from "./paper-risk.ts";

const now = 1_800_000_000_000;
const metrics = (patch: Partial<TokenMetrics> = {}): TokenMetrics => ({
  chain: "ethereum", address: "0xabc", symbol: "TEST", name: "Test Token",
  priceUsd: 2, liquidityUsd: 250_000, volume24h: 80_000, marketCap: 1_000_000, fdv: 1_000_000,
  priceChange24h: 10, buys24h: 100, sells24h: 80, pairCreatedAt: now - 7 * 86_400_000,
  url: null, fetchedAt: now, ...patch,
});
const clean: SecurityReport = {
  honeypot: false, lpLocked: true, ownerCanMint: false, ownerCanFreeze: false,
  buyTax: 0.01, sellTax: 0.01, verified: true, checkedAt: now,
  providers: ["GoPlus", "honeypot.is"], details: [],
};
const signal = (patch: Partial<OpportunitySignal> = {}): OpportunitySignal => {
  const m = metrics();
  return {
    id: `${m.chain}:${m.address}`, symbol: m.symbol, address: m.address, chain: m.chain,
    score: 88, risk: "safe", flags: [], metrics: m, security: clean,
    securityVerified: true, tradableInPaperMode: true, rationale: ["test fixture"], ...patch,
  };
};
const marketUpdate = (s: OpportunitySignal, priceUsd: number, liquidityUsd = 250_000, fetchedAt = now) =>
  ({ tokenId: s.id, priceUsd, liquidityUsd, fetchedAt });

test("passes only a fully verified candidate and caps each idea at five percent", () => {
  const s = signal();
  const verdict = evaluateRiskGate(s, createPaperPortfolio(), now);
  assert.equal(verdict.allowed, true);
  assert.equal(verdict.plannedNotionalUsd, 1_250);
  assert.equal(verdict.checks.every(x => x.pass), true);
  const entered = enterPaperPosition(createPaperPortfolio(), s, now);
  assert.equal(entered.entered, true);
  assert.equal(entered.portfolio.positions.length, 1);
  assert.ok(Math.abs(entered.portfolio.positions[0].initialNotionalUsd / paperEquityUsd(createPaperPortfolio()) - 0.05) < 1e-8);
});

test("missing, incomplete, or stale security evidence blocks entry", () => {
  assert.equal(evaluateRiskGate(signal({ security: null, securityVerified: false }), createPaperPortfolio(), now).allowed, false);
  assert.equal(evaluateRiskGate(signal({ security: { ...clean, sellTax: null } }), createPaperPortfolio(), now).allowed, false);
  assert.equal(evaluateRiskGate(signal({ security: { ...clean, checkedAt: now - 5 * 60_000 - 1 } }), createPaperPortfolio(), now).allowed, false);
});

test("low score, hard-reject flags, low liquidity and stale quotes are blocked", () => {
  const book = createPaperPortfolio();
  assert.equal(evaluateRiskGate(signal({ score: 69 }), book, now).allowed, false);
  assert.equal(evaluateRiskGate(signal({ flags: ["HONEYPOT"] }), book, now).allowed, false);
  assert.equal(evaluateRiskGate(signal({ metrics: metrics({ liquidityUsd: 9_999 }) }), book, now).allowed, false);
  assert.equal(evaluateRiskGate(signal({ metrics: metrics({ fetchedAt: now - 60_001 }) }), book, now).allowed, false);
});

test("caps at three concurrent positions and blocks duplicates", () => {
  let book = createPaperPortfolio();
  for (let i = 0; i < MAX_PAPER_POSITIONS; i++) {
    const m = metrics({ address: `0x${i + 1}`, symbol: `T${i + 1}` });
    const s = signal({ id: `ethereum:${m.address}`, address: m.address, symbol: m.symbol, metrics: m });
    const entered = enterPaperPosition(book, s, now + i);
    assert.equal(entered.entered, true);
    book = entered.portfolio;
  }
  const fourthMetrics = metrics({ address: "0xff", symbol: "FOUR" });
  assert.equal(evaluateRiskGate(signal({ id: "ethereum:0xff", address: "0xff", symbol: "FOUR", metrics: fourthMetrics }), book, now + 4).allowed, false);
  assert.equal(book.positions.length, 3);
  assert.ok(paperExposureUsd(book) <= paperEquityUsd(book) * 0.15 + 0.01);
});

test("hard stop exits the remaining position at the observed quote", () => {
  const s = signal();
  const entered = enterPaperPosition(createPaperPortfolio(), s, now);
  const updated = applyPaperMarketUpdates(entered.portfolio, [marketUpdate(s, 1.83)], now + 1_000);
  assert.equal(updated.positions.length, 0);
  assert.equal(updated.trades[0].reason, "STOP");
  assert.ok(updated.cashUsd < 25_000);
});

test("scales out half at +20%, then trailing stop exits the remainder", () => {
  const s = signal();
  let book = enterPaperPosition(createPaperPortfolio(), s, now).portfolio;
  book = applyPaperMarketUpdates(book, [marketUpdate(s, 2.41)], now + 1_000);
  assert.equal(book.positions.length, 1);
  assert.equal(book.positions[0].scaledOut, true);
  assert.equal(book.trades[0].reason, "SCALE_OUT");
  assert.ok(Math.abs(book.positions[0].qty - book.positions[0].initialQty * 0.5) < 1e-9);
  book = applyPaperMarketUpdates(book, [marketUpdate(s, 2.16)], now + 2_000);
  assert.equal(book.positions.length, 0);
  assert.equal(book.trades[0].reason, "TRAILING_STOP");
});

test("time stop closes after six hours and liquidity drop triggers the rug guard", () => {
  const s = signal();
  let book = enterPaperPosition(createPaperPortfolio(), s, now).portfolio;
  book = applyPaperMarketUpdates(book, [], now + 6 * 60 * 60 * 1000);
  assert.equal(book.positions.length, 0);
  assert.equal(book.trades[0].reason, "TIME_STOP");

  book = enterPaperPosition(createPaperPortfolio(), s, now).portfolio;
  book = applyPaperMarketUpdates(book, [marketUpdate(s, 2, 230_000)], now + 1_000);
  assert.equal(book.positions.length, 1);
  book = applyPaperMarketUpdates(book, [marketUpdate(s, 1.99, 160_000)], now + 2_000);
  assert.equal(book.positions.length, 0);
  assert.equal(book.trades[0].reason, "LIQUIDITY_DROP");
});
