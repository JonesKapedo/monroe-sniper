import type { Candle } from "./market-candles";

export type SolanaSwap = {
  signature: string;
  time: number;
  priceUsd: number;
  baseAmount: number;
  quoteAmount: number;
  side: "buy" | "sell";
  dexId: string;
  pairAddress: string;
};

type TokenBalance = {
  mint?: unknown;
  owner?: unknown;
  uiTokenAmount?: { uiAmount?: unknown; uiAmountString?: unknown };
};

type EnhancedTransaction = {
  blockTime?: unknown;
  transaction?: {
    message?: {
      accountKeys?: { pubkey?: unknown; signer?: unknown }[];
    };
  };
  meta?: {
    err?: unknown;
    fee?: unknown;
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
    preBalances?: number[];
    postBalances?: number[];
  };
};

type SolanaPair = {
  dexId?: unknown;
  pairAddress?: unknown;
  priceUsd?: unknown;
  liquidity?: { usd?: unknown };
  baseToken?: { address?: unknown; symbol?: unknown };
  quoteToken?: { address?: unknown; symbol?: unknown };
};

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function positiveNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function tokenAmount(balance: TokenBalance): number {
  return (
    positiveNumber(balance.uiTokenAmount?.uiAmount) ??
    positiveNumber(balance.uiTokenAmount?.uiAmountString) ??
    0
  );
}

function tokenDelta(
  before: TokenBalance[] = [],
  after: TokenBalance[] = [],
  owner: string,
  mint: string,
): number {
  const sum = (balances: TokenBalance[]) =>
    balances.reduce(
      (total, balance) =>
        balance.owner === owner && balance.mint === mint ? total + tokenAmount(balance) : total,
      0,
    );
  return sum(after) - sum(before);
}

export function parseSolanaSwap(
  transaction: EnhancedTransaction,
  pair: SolanaPair,
  signature: string,
): SolanaSwap | null {
  const meta = transaction.meta;
  const time = positiveNumber(transaction.blockTime);
  const pairAddress = typeof pair.pairAddress === "string" ? pair.pairAddress : "";
  const dexId = typeof pair.dexId === "string" ? pair.dexId : "";
  const baseMint = typeof pair.baseToken?.address === "string" ? pair.baseToken.address : "";
  const quoteMint = typeof pair.quoteToken?.address === "string" ? pair.quoteToken.address : "";
  if (
    !meta ||
    meta.err != null ||
    !time ||
    !pairAddress ||
    !dexId ||
    !baseMint ||
    !quoteMint ||
    !Array.isArray(meta.preTokenBalances) ||
    !Array.isArray(meta.postTokenBalances)
  ) {
    return null;
  }

  const signer = transaction.transaction?.message?.accountKeys?.find(
    (key) => key.signer === true && typeof key.pubkey === "string",
  )?.pubkey;
  if (typeof signer !== "string") return null;

  if (![baseMint, quoteMint].includes(SOL_MINT) || ![baseMint, quoteMint].includes(USDC_MINT)) {
    return null;
  }

  const solDelta = tokenDelta(meta.preTokenBalances, meta.postTokenBalances, signer, SOL_MINT);
  const usdcDelta = tokenDelta(meta.preTokenBalances, meta.postTokenBalances, signer, USDC_MINT);
  if (solDelta === 0 || usdcDelta === 0 || Math.sign(solDelta) === Math.sign(usdcDelta)) {
    return null;
  }

  const priceUsd = Math.abs(usdcDelta / solDelta);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;
  return {
    signature,
    time: time * 1000,
    priceUsd,
    baseAmount: Math.abs(solDelta),
    quoteAmount: Math.abs(usdcDelta),
    side: solDelta > 0 ? "buy" : "sell",
    dexId,
    pairAddress,
  };
}

export function solanaSwapCandles(
  swaps: SolanaSwap[],
  timeframe: "1m" | "5m" | "15m" | "1h",
): Candle[] {
  const duration = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000 }[timeframe];
  const candles = new Map<number, Candle>();
  for (const swap of [...swaps].sort((a, b) => a.time - b.time)) {
    if (!Number.isFinite(swap.time) || !Number.isFinite(swap.priceUsd) || swap.priceUsd <= 0) {
      continue;
    }
    const time = Math.floor(swap.time / duration) * duration;
    const candle = candles.get(time);
    if (!candle) {
      candles.set(time, {
        time,
        open: swap.priceUsd,
        high: swap.priceUsd,
        low: swap.priceUsd,
        close: swap.priceUsd,
      });
    } else {
      candle.high = Math.max(candle.high, swap.priceUsd);
      candle.low = Math.min(candle.low, swap.priceUsd);
      candle.close = swap.priceUsd;
    }
  }
  return [...candles.values()].slice(-48);
}

export type SolanaDexPair = SolanaPair & {
  dexId: string;
  pairAddress: string;
  priceUsd: number;
  liquidityUsd: number;
  baseToken: { address: string; symbol: string };
  quoteToken: { address: string; symbol: string };
};

export function selectSolUsdcPairs(input: unknown): SolanaDexPair[] {
  if (!Array.isArray(input)) return [];
  const pairs = input.flatMap((item): SolanaDexPair[] => {
    if (!item || typeof item !== "object") return [];
    const pair = item as SolanaPair;
    const dexId = typeof pair.dexId === "string" ? pair.dexId.toLowerCase() : "";
    const pairAddress = typeof pair.pairAddress === "string" ? pair.pairAddress : "";
    const baseAddress = typeof pair.baseToken?.address === "string" ? pair.baseToken.address : "";
    const quoteAddress =
      typeof pair.quoteToken?.address === "string" ? pair.quoteToken.address : "";
    const priceUsd = positiveNumber(pair.priceUsd);
    const liquidityUsd = positiveNumber(pair.liquidity?.usd);
    if (
      !["raydium", "pumpswap"].includes(dexId) ||
      !pairAddress ||
      !priceUsd ||
      !liquidityUsd ||
      !(
        (baseAddress === SOL_MINT && quoteAddress === USDC_MINT) ||
        (baseAddress === USDC_MINT && quoteAddress === SOL_MINT)
      )
    ) {
      return [];
    }
    return [
      {
        ...pair,
        dexId,
        pairAddress,
        priceUsd,
        liquidityUsd,
        baseToken: { address: SOL_MINT, symbol: "SOL" },
        quoteToken: { address: USDC_MINT, symbol: "USDC" },
      },
    ];
  });

  const selected = new Map<string, SolanaDexPair>();
  for (const dexId of ["raydium", "pumpswap"]) {
    const best = pairs
      .filter((pair) => pair.dexId === dexId)
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd)[0];
    if (best) selected.set(best.pairAddress, best);
  }
  return [...selected.values()];
}
