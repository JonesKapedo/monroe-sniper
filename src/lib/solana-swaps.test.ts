import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSolanaSwap,
  selectSolUsdcPairs,
  solanaSwapCandles,
  SOL_MINT,
  USDC_MINT,
  type SolanaSwap,
} from "./solana-swaps.ts";

const pair = {
  dexId: "raydium",
  pairAddress: "pool",
  baseToken: { address: SOL_MINT, symbol: "SOL" },
  quoteToken: { address: USDC_MINT, symbol: "USDC" },
};

function transaction(beforeSol: number, afterSol: number, beforeUsdc: number, afterUsdc: number) {
  return {
    blockTime: 1_800_000_000,
    transaction: { message: { accountKeys: [{ pubkey: "trader", signer: true }] } },
    meta: {
      err: null as unknown,
      fee: undefined as number | undefined,
      preBalances: undefined as number[] | undefined,
      postBalances: undefined as number[] | undefined,
      preTokenBalances: [
        { owner: "trader", mint: SOL_MINT, uiTokenAmount: { uiAmount: beforeSol } },
        { owner: "trader", mint: USDC_MINT, uiTokenAmount: { uiAmount: beforeUsdc } },
      ],
      postTokenBalances: [
        { owner: "trader", mint: SOL_MINT, uiTokenAmount: { uiAmount: afterSol } },
        { owner: "trader", mint: USDC_MINT, uiTokenAmount: { uiAmount: afterUsdc } },
      ],
    },
  };
}

test("parses confirmed user SOL/USDC swap amounts and side from signer balances", () => {
  const buy = parseSolanaSwap(transaction(2, 3, 300, 100), pair, "buy-signature");
  assert.deepEqual(buy, {
    signature: "buy-signature",
    time: 1_800_000_000_000,
    priceUsd: 200,
    baseAmount: 1,
    quoteAmount: 200,
    side: "buy",
    dexId: "raydium",
    pairAddress: "pool",
  });
  assert.equal(parseSolanaSwap(transaction(3, 2, 100, 300), pair, "sell")?.side, "sell");
  const reversedPair = {
    ...pair,
    baseToken: { address: USDC_MINT, symbol: "USDC" },
    quoteToken: { address: SOL_MINT, symbol: "SOL" },
  };
  const reversed = parseSolanaSwap(transaction(2, 3, 300, 100), reversedPair, "reversed-pool");
  assert.equal(reversed?.priceUsd, 200);
  assert.equal(reversed?.side, "buy");
  assert.equal(
    parseSolanaSwap({ ...transaction(2, 3, 300, 100), meta: { err: "failed" } }, pair, "bad"),
    null,
  );
});

test("uses fee-adjusted native SOL balances when wrapped-SOL token deltas are absent", () => {
  const tx = transaction(0, 0, 300, 100);
  tx.meta = {
    ...tx.meta,
    fee: 5_000,
    preBalances: [2_000_000_000],
    postBalances: [2_999_995_000],
    preTokenBalances: [
      { owner: "trader", mint: USDC_MINT, uiTokenAmount: { uiAmount: 300 } },
    ],
    postTokenBalances: [
      { owner: "trader", mint: USDC_MINT, uiTokenAmount: { uiAmount: 100 } },
    ],
  };

  const swap = parseSolanaSwap(tx, pair, "native-sol-buy");
  assert.equal(swap?.side, "buy");
  assert.equal(swap?.baseAmount, 1);
  assert.equal(swap?.quoteAmount, 200);
  assert.equal(swap?.priceUsd, 200);
});

test("selects only the most liquid direct SOL/USDC Raydium and PumpSwap pools", () => {
  const pools = selectSolUsdcPairs([
    {
      ...pair,
      liquidity: { usd: 100 },
      priceUsd: "200",
    },
    {
      ...pair,
      pairAddress: "bigger",
      liquidity: { usd: 200 },
      priceUsd: "201",
    },
    {
      ...pair,
      dexId: "pumpswap",
      pairAddress: "pump",
      baseToken: { address: USDC_MINT, symbol: "USDC" },
      quoteToken: { address: SOL_MINT, symbol: "SOL" },
      liquidity: { usd: 50 },
      priceUsd: "0.005",
    },
    {
      ...pair,
      dexId: "orca",
      pairAddress: "unsupported",
      liquidity: { usd: 1000 },
      priceUsd: "200",
    },
  ]);
  assert.deepEqual(
    pools.map((pool) => pool.pairAddress),
    ["bigger", "pump"],
  );
  assert.equal(pools[1]?.baseToken.address, SOL_MINT);
  assert.equal(pools[1]?.quoteToken.address, USDC_MINT);
  assert.equal(selectSolUsdcPairs(null).length, 0);
});

test("builds OHLC candles only from actual swap observations", () => {
  const t = 1_800_000_000_000;
  const swaps: SolanaSwap[] = [
    {
      signature: "later",
      time: t + 20_000,
      priceUsd: 202,
      baseAmount: 1,
      quoteAmount: 202,
      side: "buy",
      dexId: "raydium",
      pairAddress: "pool",
    },
    {
      signature: "first",
      time: t + 1_000,
      priceUsd: 200,
      baseAmount: 1,
      quoteAmount: 200,
      side: "buy",
      dexId: "raydium",
      pairAddress: "pool",
    },
    {
      signature: "mid",
      time: t + 10_000,
      priceUsd: 198,
      baseAmount: 1,
      quoteAmount: 198,
      side: "sell",
      dexId: "raydium",
      pairAddress: "pool",
    },
  ];
  assert.deepEqual(solanaSwapCandles(swaps, "1m"), [
    { time: Math.floor(t / 60_000) * 60_000, open: 200, high: 202, low: 198, close: 202 },
  ]);
  assert.deepEqual(solanaSwapCandles([], "1m"), []);
});
