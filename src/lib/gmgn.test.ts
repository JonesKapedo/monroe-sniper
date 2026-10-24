import assert from "node:assert/strict";
import test from "node:test";
import { gmgnChain, mapGmgnRun } from "./gmgn.ts";

const run = {
  decisions: [
    {
      decision: {
        symbol: "CLEANCAT",
        address: "So11111111111111111111111111111111111111112",
        action: "ACTION",
        reason: "passed every gate",
        risk_warn: false,
        priority: 81,
        verdict: {
          verdict: "pass",
          conviction: 0.84,
          crowdedness: "early",
          thesis: "5m +18% / 1h +46%, buyers in control",
          red_flags: [],
        },
        features: {
          price: 0.0021,
          liquidity: 180_000,
          vol_1h: 950_000,
          chg_1h: 0.46,
          age_min: 42,
          smart_degen: 2,
          renowned: 1,
          dev_score: 0.92,
          bundler: 0.04,
          top10: 0.22,
          buy_tax: 0,
          sell_tax: 0,
        },
      },
    },
    {
      decision: {
        symbol: "RUGPULL",
        address: "So22222222222222222222222222222222222222222",
        action: "SKIP",
        reason: "honeypot",
        priority: 12,
        features: { price: 0.0009, liquidity: 60_000, chg_1h: 1.8, age_min: 20 },
      },
    },
  ],
};

test("maps GMGN ACTION rows and keeps screened rows as marks", () => {
  const mapped = mapGmgnRun(run, { chain: "sol" });
  assert.equal(mapped.candidates.length, 1);
  assert.equal(mapped.quotes.length, 2);
  const c = mapped.candidates[0];
  assert.equal(c.id, "gmgn:sol:so11111111111111111111111111111111111111112");
  assert.equal(c.symbol, "CLEANCAT");
  assert.ok(c.score > 81, `expected the memecoin model to lift the score, got ${c.score}`);
  assert.ok(c.flags.includes("GMGN"));
  assert.ok(c.flags.includes("GMGN-B"));
  assert.equal(c.liquidityUsd, 180_000);
  assert.equal(c.volume24h, 950_000);
  assert.equal(c.change24h, 46);
  assert.ok(Math.abs((c.pairAgeHours ?? 0) - 0.7) < 0.001, `age ${c.pairAgeHours}`);
  assert.ok(c.rationale.some((line) => line.includes("buyers in control")));
});

test("DexScreener marks override the GMGN fallback price and depth", () => {
  const mapped = mapGmgnRun(run, {
    chain: "sol",
    pairs: new Map([
      [
        "so11111111111111111111111111111111111111112",
        {
          priceUsd: 0.0024,
          liquidityUsd: 240_000,
          volume24h: 2_400_000,
          change24h: 55,
          pairAgeHours: 1.1,
          url: "https://dexscreener.com/solana/pair",
        },
      ],
    ]),
  });
  const c = mapped.candidates[0];
  assert.equal(c.priceUsd, 0.0024);
  assert.equal(c.liquidityUsd, 240_000);
  assert.equal(c.volume24h, 2_400_000);
  assert.equal(c.change24h, 55);
  assert.equal(c.url, "https://dexscreener.com/solana/pair");
});

test("flags late and mock rows without inventing safety", () => {
  const late = mapGmgnRun(
    {
      decisions: [
        {
          decision: {
            symbol: "LATE",
            address: "So33333333333333333333333333333333333333333",
            action: "ACTION",
            priority: 70,
            verdict: { crowdedness: "late", conviction: 0.7 },
            features: { price: 0.01, liquidity: 50_000, chg_1h: 3.2, age_min: 30 },
          },
        },
      ],
    },
    { chain: "sol", mock: true },
  ).candidates[0];
  assert.ok(late.flags.includes("GMGN-LATE"));
  assert.ok(late.flags.includes("GMGN-MOCK"));
});

test("drops an ACTION row that fails the memecoin supply gate", () => {
  const mapped = mapGmgnRun(
    {
      decisions: [
        {
          decision: {
            symbol: "BUNDLED",
            address: "So44444444444444444444444444444444444444444",
            action: "ACTION",
            priority: 88,
            verdict: { crowdedness: "early", conviction: 0.8 },
            features: {
              price: 0.001,
              liquidity: 80_000,
              chg_1h: 0.4,
              age_min: 30,
              smart_degen: 2,
              renowned: 1,
              bundler: 0.45,
            },
          },
        },
      ],
    },
    { chain: "sol" },
  );
  assert.equal(mapped.candidates.length, 0);
  assert.equal(mapped.quotes.length, 1);
  assert.ok(mapped.quotes[0].flags.includes("GMGN-REJECT"));
});

test("drops rows with no usable price", () => {
  const mapped = mapGmgnRun(
    { decisions: [{ decision: { symbol: "NOPRICE", address: "x", action: "ACTION", priority: 90 } }] },
    { chain: "sol" },
  );
  assert.equal(mapped.candidates.length, 0);
  assert.equal(mapped.quotes.length, 0);
});

test("normalizes unsupported chains to sol", () => {
  assert.equal(gmgnChain("ETH"), "eth");
  assert.equal(gmgnChain("nope"), "sol");
  assert.equal(gmgnChain(undefined), "sol");
});
