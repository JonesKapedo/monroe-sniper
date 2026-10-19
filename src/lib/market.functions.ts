import { createServerFn } from "@tanstack/react-start";
import { binanceExecutionStatus } from "./feeds/execution";
import type { FeedHealth } from "./feeds/status";
import { scoreCandidate, type Candidate } from "./paper";
import { createCache, fetchCached } from "./cache";
import { fetchGeckoCandles, type DexTimeframe } from "./charts/geckoterminal";
import { fetchJupiterTicks, type JupiterTick } from "./charts/jupiter";
import { FX_PAIRS, fetchFrankfurterSpot, fetchTwelveCandles, fxIntervalFor } from "./fx/twelvedata";
import { fetchHyperliquidFunding, type PerpFunding } from "./perps/hyperliquid";
import { dexSearch, verifySecurity, type SecurityReport, type TokenMetrics } from "./data/market-sources";
import {
  krakenIntervalFor,
  krakenPairFor,
  parseKrakenCandles,
  type Candle,
} from "./market-candles";

type Pair = {
  chainId?: string;
  url?: string;
  priceUsd?: string;
  fdv?: number;
  pairCreatedAt?: number;
  baseToken?: { address?: string; symbol?: string; name?: string };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fromPair(p: Pair): Candidate | null {
  const address = p.baseToken?.address?.trim();
  if (!address) return null;
  return scoreCandidate({
    symbol: p.baseToken?.symbol || "UNKNOWN",
    name: p.baseToken?.name || p.baseToken?.symbol || "Token",
    chain: (p.chainId || "unknown").toLowerCase(),
    address,
    priceUsd: num(p.priceUsd),
    liquidityUsd: num(p.liquidity?.usd),
    volume24h: num(p.volume?.h24),
    change24h: num(p.priceChange?.h24),
    pairCreatedAt: num(p.pairCreatedAt),
    url: p.url || null,
  });
}

async function pullProfile(
  chainId: string,
  tokenAddress: string,
  ms = 4000,
): Promise<Pair[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const nested = await fetch(
      `https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(chainId)}/${encodeURIComponent(tokenAddress)}`,
      { headers: { Accept: "application/json" }, signal: ctrl.signal },
    );
    if (!nested.ok) return [];
    const data = (await nested.json()) as { pairs?: Pair[] } | Pair[];
    return Array.isArray(data) ? data : (data.pairs ?? []);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function pull(url: string): Promise<Pair[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Market feed HTTP ${res.status}`);
    const body = (await res.json()) as { pairs?: Pair[] } | Pair[];
    if (!Array.isArray(body)) return body.pairs ?? [];
    // Token-profile listings fan out in parallel with per-request budgets so
    // one slow pair cannot time-out the whole batch (shared 6s timer above).
    const profiles = body.slice(0, 8) as { chainId?: string; tokenAddress?: string }[];
    const settled = await Promise.all(
      profiles
        .filter((p) => p.chainId && p.tokenAddress)
        .map((p) => pullProfile(p.chainId as string, p.tokenAddress as string)),
    );
    return settled.flat();
  } finally {
    clearTimeout(timer);
  }
}

const BINANCE = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "PEPEUSDT",
  "SUIUSDT",
  "NEARUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "ADAUSDT",
] as const;

function binanceRows(rows: { symbol?: string; lastPrice?: string; quoteVolume?: string; priceChangePercent?: string }[]): Candidate[] {
  const out: Candidate[] = [];
  for (const row of rows) {
    const symbol = (row.symbol ?? "").replace("USDT", "");
    // NOTE: quoteVolume is flow, not pool depth — depth stays unknown rather
    // than posing flow as liquidity (that corrupted volatility and sizing).
    const c = scoreCandidate({
      symbol,
      name: `${symbol} / USDT`,
      chain: "binance",
      address: row.symbol ?? symbol,
      priceUsd: num(row.lastPrice),
      liquidityUsd: null,
      volume24h: num(row.quoteVolume),
      change24h: num(row.priceChangePercent),
      pairCreatedAt: null,
      url: row.symbol ? `https://www.binance.com/en/trade/${row.symbol}` : null,
      venue: "binance",
      liquidityUnknown: true,
    });
    if (c) out.push(c);
  }
  return out;
}

export type FeedPack = {
  binance: Candidate[];
  dex: Candidate[];
  reference: Candidate[];
  health: FeedHealth[];
  note: string;
  executionNote: string;
};

type GeckoCoin = {
  id?: string;
  symbol?: string;
  name?: string;
  current_price?: number;
  total_volume?: number;
  market_cap?: number;
  price_change_percentage_24h?: number;
};

const feedCache = createCache<FeedPack>(100);
const CACHE_MS = 12_000;

async function getJson<T>(url: string, headers?: Record<string, string>, ms = 5000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function referenceRows(rows: GeckoCoin[], source: "coingecko" | "coinmarketcap"): Candidate[] {
  const out: Candidate[] = [];
  for (const row of rows) {
    const symbol = (row.symbol || "").toUpperCase();
    if (!symbol || !row.id) continue;
    const c = scoreCandidate({
      symbol,
      name: `${row.name || symbol} · ${source === "coingecko" ? "CoinGecko" : "CMC"}`,
      chain: source,
      address: row.id,
      priceUsd: num(row.current_price),
      liquidityUsd: num(row.market_cap),
      volume24h: num(row.total_volume),
      change24h: num(row.price_change_percentage_24h),
      pairCreatedAt: null,
      url: null,
      venue: "dex",
      // Index/coin reference rows are majors, not AMM pools: market cap is
      // posed as liquidity for sizing, but pool DEPTH is unpublished. Without
      // this flag the pre-trade screen treated turnover (volume / market cap,
      // always tiny for majors) as a pool ratio and starved every one of them.
      liquidityUnknown: true,
    });
    if (c) out.push(c);
  }
  return out;
}

async function pullCoinGecko(): Promise<Candidate[]> {
  const rows = await getJson<GeckoCoin[]>(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=12&page=1&price_change_percentage=24h",
  );
  return referenceRows(rows, "coingecko");
}

async function pullCoinMarketCap(): Promise<{ rows: Candidate[]; locked: boolean }> {
  const key = process.env.CMC_API_KEY?.trim() || process.env.COINMARKETCAP_API_KEY?.trim();
  if (!key) return { rows: [], locked: true };
  const body = await getJson<{
    data?: {
      id?: number;
      name?: string;
      symbol?: string;
      quote?: { USD?: { price?: number; volume_24h?: number; market_cap?: number; percent_change_24h?: number } };
    }[];
  }>("https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=12&convert=USD", {
    "X-CMC_PRO_API_KEY": key,
  });
  const mapped: GeckoCoin[] = (body.data ?? []).map((row) => ({
    id: String(row.id ?? row.symbol ?? ""),
    symbol: row.symbol,
    name: row.name,
    current_price: row.quote?.USD?.price,
    total_volume: row.quote?.USD?.volume_24h,
    market_cap: row.quote?.USD?.market_cap,
    price_change_percentage_24h: row.quote?.USD?.percent_change_24h,
  }));
  return { rows: referenceRows(mapped, "coinmarketcap"), locked: false };
}

export const loadFeeds = createServerFn({ method: "POST" })
  .validator((input: { query?: string }) => ({
    query: String(input?.query ?? "").trim().slice(0, 64),
  }))
  .handler(async ({ data }): Promise<FeedPack> => {
    const key = data.query || "*";
    return fetchCached(feedCache, key, CACHE_MS, async () => {
      const symbols = encodeURIComponent(JSON.stringify([...BINANCE]));
    const dexUrl = data.query
      ? `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(data.query)}`
      : "https://api.dexscreener.com/token-profiles/latest/v1";
    const [bx, dx, gx, cx] = await Promise.allSettled([
      getJson<{ symbol?: string; lastPrice?: string; quoteVolume?: string; priceChangePercent?: string }[]>(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`,
      ),
      pull(dexUrl),
      pullCoinGecko(),
      pullCoinMarketCap(),
    ]);
    const binance = bx.status === "fulfilled" ? binanceRows(bx.value) : [];
    const dexMap = new Map<string, Candidate>();
    if (dx.status === "fulfilled") {
      for (const c of dx.value.map(fromPair)) {
        if (!c) continue;
        const prev = dexMap.get(c.id);
        if (!prev || c.liquidityUsd > prev.liquidityUsd) dexMap.set(c.id, c);
      }
    }
    const dex = [...dexMap.values()].sort((a, b) => b.score - a.score).slice(0, 12);
    const gecko = gx.status === "fulfilled" ? gx.value : [];
    const cmc = cx.status === "fulfilled" ? cx.value : { rows: [], locked: !process.env.CMC_API_KEY && !process.env.COINMARKETCAP_API_KEY };
    const health: FeedHealth[] = [
      { id: "binance", label: "Binance", state: binance.length ? "live" : "down", detail: binance.length ? `${binance.length} spot quotes` : "Public ticker unavailable" },
      { id: "dex", label: "DEX", state: dex.length ? "live" : "down", detail: dex.length ? `${dex.length} pairs` : "DexScreener unavailable" },
      { id: "coingecko", label: "CoinGecko", state: gecko.length ? "live" : "down", detail: gecko.length ? `${gecko.length} markets` : "CoinGecko unavailable" },
      {
        id: "coinmarketcap",
        label: "CoinMarketCap",
        state: cmc.locked ? "locked" : cmc.rows.length ? "live" : "down",
        detail: cmc.locked ? "Add CMC_API_KEY on the host" : cmc.rows.length ? `${cmc.rows.length} listings` : "CMC request failed",
      },
    ];
    const reference = [...gecko, ...cmc.rows].slice(0, 16);
    const executionNote = binanceExecutionStatus().note;
    const note = health.map((row) => `${row.label} ${row.state}`).join(" · ");
      return { binance, dex, reference, health, note, executionNote };
    });
  });

const anchorCache = createCache<{ rows: Candidate[]; note: string }>(100);
const ANCHOR_CACHE_MS = 5 * 60_000;

/**
 * Live quotes for avenue anchor symbols missing from the tape (e.g. a
 * Hyperliquid funding coin with no Binance-listed or DEX pair on screen).
 * Binance single-symbol 24h ticker first (live quote + volume + change, depth
 * unpublished like the rest of the CEX feed), DexScreener search as fallback.
 * Anything unresolved is omitted — never estimated.
 */
export const loadAnchorQuotes = createServerFn({ method: "POST" })
  .validator((input: { symbols?: string[] }) => ({
    symbols: (Array.isArray(input?.symbols) ? input.symbols : [])
      .map((s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))
      .filter(Boolean)
      .slice(0, 12),
  }))
  .handler(async ({ data }): Promise<{ rows: Candidate[]; note: string }> => {
    if (!data.symbols.length) return { rows: [], note: "No anchor symbols requested" };
    const cacheKey = [...data.symbols].sort().join(",");
    return fetchCached(anchorCache, cacheKey, ANCHOR_CACHE_MS, async () => {
      const rows: Candidate[] = [];
      for (const base of data.symbols) {
        const pair = `${base}USDT`;
        try {
          const t = await getJson<{ symbol?: string; lastPrice?: string; quoteVolume?: string; priceChangePercent?: string }>(
            `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(pair)}`,
          );
          const c = scoreCandidate({
            symbol: base,
            name: `${base} / USDT`,
            chain: "binance",
            address: t.symbol ?? pair,
            priceUsd: num(t.lastPrice),
            liquidityUsd: null,
            volume24h: num(t.quoteVolume),
            change24h: num(t.priceChangePercent),
            pairCreatedAt: null,
            url: `https://www.binance.com/en/trade/${pair}`,
            venue: "binance",
            liquidityUnknown: true,
          });
          if (c) {
            rows.push(c);
            continue;
          }
        } catch {
          // Fall through to DexScreener search.
        }
        try {
          const metrics = await dexSearch(base);
          const ranked = [...metrics].sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
          const m = ranked[0];
          if (!m) continue;
          const c = scoreCandidate({
            symbol: m.symbol,
            name: m.name,
            chain: m.chain,
            address: m.address,
            priceUsd: m.priceUsd,
            liquidityUsd: m.liquidityUsd,
            volume24h: m.volume24h,
            change24h: m.priceChange24h,
            pairCreatedAt: m.pairCreatedAt,
            url: m.url,
            venue: "dex",
          });
          if (c) rows.push(c);
        } catch {
          // Unresolved anchors stay unresolved — omitted, never estimated.
        }
      }
      return {
        rows,
        note: rows.length
          ? `Live anchor quotes: ${rows.map((r) => r.symbol).join(", ")}`
          : "No live quotes for the requested anchors",
      };
    });
  });

const INTERVALS = new Set(["1m", "5m", "15m", "1h"]);
const candleCache = createCache<{ candles: Candle[]; note: string }>(200);
const CANDLE_CACHE_MS = 12_000;

async function loadKlinesBody(
  symbol: string,
  interval: string,
): Promise<{ candles: Candle[]; note: string }> {
    try {
      const rows = await getJson<number[][]>(
        `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=48`,
      );
      const candles: Candle[] = rows
        .map((row) => ({
          time: Number(row[0]),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
        }))
        .filter(
          (bar) =>
            [bar.time, bar.open, bar.high, bar.low, bar.close].every(Number.isFinite) &&
            bar.time > 0 &&
            bar.open > 0 &&
            bar.high > 0 &&
            bar.low > 0 &&
            bar.close > 0 &&
            bar.high >= bar.low,
        );
      if (!candles.length) throw new Error("Binance returned no usable candles");
      return { candles, note: `Binance ${symbol} ${interval}` };
    } catch (binanceError) {
      const binanceMessage =
        binanceError instanceof Error ? binanceError.message : "Klines unavailable";
      const pair = krakenPairFor(symbol);
      const kInterval = krakenIntervalFor(interval);
      if (!pair || kInterval === null) {
        return {
          candles: [],
          note: `Binance unavailable (${binanceMessage}); no alternate feed for this pair`,
        };
      }

      try {
        const payload = await getJson<{ error?: unknown; result?: Record<string, unknown> }>(
          `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(pair)}&interval=${kInterval}`,
        );
        const candles = parseKrakenCandles(payload);
        if (!candles.length) throw new Error(`Kraken returned no usable candles for ${pair}`);
        return {
          candles,
          note: `Kraken ${pair} ${interval} · Binance unavailable (${binanceMessage})`,
        };
      } catch (krakenError) {
        const krakenMessage =
          krakenError instanceof Error ? krakenError.message : "Klines unavailable";
        return {
          candles: [],
          note: `Binance unavailable (${binanceMessage}); Kraken unavailable (${krakenMessage})`,
        };
      }
    }
}

export const loadKlines = createServerFn({ method: "POST" })
  .validator((input: { symbol?: string; interval?: string }) => {
    const symbol = String(input?.symbol ?? "BTCUSDT").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const interval = INTERVALS.has(String(input?.interval)) ? String(input?.interval) : "5m";
    return { symbol: symbol || "BTCUSDT", interval };
  })
  .handler(async ({ data }): Promise<{ candles: Candle[]; note: string }> => {
    const cacheKey = `${data.symbol}:${data.interval}`;
    return fetchCached(candleCache, cacheKey, CANDLE_CACHE_MS, () =>
      loadKlinesBody(data.symbol, data.interval),
    );
  });

export const scanMarket = createServerFn({ method: "POST" })
  .validator((input: { query?: string }) => ({
    query: String(input?.query ?? "").trim().slice(0, 64),
  }))
  .handler(async ({ data }): Promise<{ candidates: Candidate[]; source: "live" | "empty"; note: string }> => {
    const q = data.query;
    const url = q
      ? `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`
      : "https://api.dexscreener.com/token-profiles/latest/v1";
    try {
      const pairs = await pull(url);
      const map = new Map<string, Candidate>();
      for (const c of pairs.map(fromPair)) {
        if (!c) continue;
        const prev = map.get(c.id);
        if (!prev || c.liquidityUsd > prev.liquidityUsd) map.set(c.id, c);
      }
      const candidates = [...map.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 18);
      return {
        candidates,
        source: candidates.length ? "live" : "empty",
        note: candidates.length
          ? `DexScreener returned ${candidates.length} names`
          : "Feed returned no usable pairs",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Feed unavailable";
      return { candidates: [], source: "empty", note: message };
    }
  });

const ADDRESS_RE = /^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,48})$/;

/**
 * Universal instrument lookup: paste a contract/mint address or type any
 * name, symbol, or token. Address queries hit DexScreener directly (exact
 * match first); text queries search pairs across chains.
 */
export const searchInstruments = createServerFn({ method: "POST" })
  .validator((input: { query?: string }) => ({
    query: String(input?.query ?? "").trim().slice(0, 64),
  }))
  .handler(async ({ data }): Promise<{ candidates: Candidate[]; note: string; isAddress: boolean }> => {
    const q = data.query;
    const isAddress = ADDRESS_RE.test(q);
    if (!q) return { candidates: [], note: "Type a name, symbol, or contract address", isAddress: false };
    try {
      const metrics = await dexSearch(q);
      const exact = q.toLowerCase();
      const ranked = [...metrics].sort((a, b) => {
        const aExact = a.address.toLowerCase() === exact ? 1 : 0;
        const bExact = b.address.toLowerCase() === exact ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        return (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0);
      });
      const candidates: Candidate[] = [];
      for (const m of ranked.slice(0, 8)) {
        const c = scoreCandidate({
          symbol: m.symbol,
          name: m.name,
          chain: m.chain,
          address: m.address,
          priceUsd: m.priceUsd,
          liquidityUsd: m.liquidityUsd,
          volume24h: m.volume24h,
          change24h: m.priceChange24h,
          pairCreatedAt: m.pairCreatedAt,
          url: m.url,
          venue: "dex",
        });
        if (c) candidates.push(c);
      }
      return {
        candidates,
        note: candidates.length
          ? `${candidates.length} match${candidates.length === 1 ? "" : "es"} for "${q}"`
          : `No pairs found for "${q}" — check the address or try another chain`,
        isAddress,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search unavailable";
      return { candidates: [], note: message, isAddress };
    }
  });

const DEX_INTERVALS = new Set(["1m", "5m", "15m", "1h"]);
const dexCandleCache = createCache<{ candles: Candle[]; note: string }>(200);
const DEX_CANDLE_CACHE_MS = 20_000;

/** DEX candles for any Solana pool via GeckoTerminal (free, no key). */
export const loadDexCandles = createServerFn({ method: "POST" })
  .validator((input: { poolAddress?: string; interval?: string }) => {
    const poolAddress = String(input?.poolAddress ?? "").trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 48);
    const interval = (DEX_INTERVALS.has(String(input?.interval)) ? String(input?.interval) : "5m") as DexTimeframe;
    return { poolAddress, interval };
  })
  .handler(async ({ data }): Promise<{ candles: Candle[]; note: string }> => {
    if (data.poolAddress.length < 32) {
      return { candles: [], note: "No pool selected — pick a token to chart its deepest pool" };
    }
    const cacheKey = `${data.poolAddress}:${data.interval}`;
    return fetchCached(dexCandleCache, cacheKey, DEX_CANDLE_CACHE_MS, async () => {
      try {
        const candles = await fetchGeckoCandles(data.poolAddress, data.interval);
        if (!candles.length) throw new Error("GeckoTerminal returned no usable candles for this pool");
        return { candles, note: `GeckoTerminal ${data.poolAddress.slice(0, 6)}… ${data.interval}` };
      } catch (error) {
        const message = error instanceof Error ? error.message : "DEX candles unavailable";
        return { candles: [], note: message };
      }
    });
  });

const tickCache = createCache<{ ticks: JupiterTick[]; note: string }>(200);
const TICK_CACHE_MS = 5_000;

/** Live batch price ticks for Solana mints via Jupiter Lite (free, no key). */
export const loadTokenTicks = createServerFn({ method: "POST" })
  .validator((input: { mints?: string[] }) => {
    const mints = (Array.isArray(input?.mints) ? input.mints : [])
      .map((m) => String(m).trim())
      .filter((m) => /^[A-Za-z0-9]{32,48}$/.test(m))
      .slice(0, 25);
    return { mints };
  })
  .handler(async ({ data }): Promise<{ ticks: JupiterTick[]; note: string }> => {
    if (!data.mints.length) return { ticks: [], note: "No tracked mints" };
    const cacheKey = [...data.mints].sort().join(",");
    return fetchCached(tickCache, cacheKey, TICK_CACHE_MS, async () => {
      try {
        const ticks = await fetchJupiterTicks(data.mints);
        return {
          ticks,
          note: ticks.length ? `Jupiter live · ${ticks.length}/${data.mints.length} mints` : "Jupiter returned no prices",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Jupiter ticks unavailable";
        return { ticks: [], note: message };
      }
    });
  });

const poolCache = createCache<{ pool: ChartPool | null; note: string }>(200);
const POOL_CACHE_MS = 5 * 60_000;

export type ChartPool = {
  poolAddress: string;
  baseSymbol: string;
  /** Base-token mint for live tick streaming (null when unknown). */
  mint: string | null;
  chain: string;
  liquidityUsd: number | null;
  label: string;
};

/** Deepest Solana DEX pool for a base symbol (positions + avenues become chartable). */
export const resolveChartPool = createServerFn({ method: "POST" })
  .validator((input: { symbol?: string }) => ({
    symbol: String(input?.symbol ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20),
  }))
  .handler(async ({ data }): Promise<{ pool: ChartPool | null; note: string }> => {
    const want = data.symbol;
    if (!want) return { pool: null, note: "No symbol" };
    return fetchCached(poolCache, want, POOL_CACHE_MS, async () => {
      try {
        const metrics = await dexSearch(want);
        const match = metrics.find(
          (m) => m.symbol.split(/[/:_\-]/)[0] === want && m.pairAddress && m.chain !== "binance" && m.chain !== "coingecko" && m.chain !== "coinmarketcap",
        );
        const pool: ChartPool | null = match?.pairAddress
          ? {
              poolAddress: match.pairAddress,
              baseSymbol: match.symbol.split(/[/:_\-]/)[0],
              mint: match.address,
              chain: match.chain,
              liquidityUsd: match.liquidityUsd,
              label: `${match.symbol} · ${match.chain}`,
            }
          : null;
        return { pool, note: pool ? `Deepest ${pool.label} pool` : `No DEX pool found for ${want}` };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pool lookup failed";
        return { pool: null, note: message };
      }
    });
  });

const FX_INTERVALS = new Set(["1m", "5m", "15m", "1h"]);
const fxCandleCache = createCache<{ candles: Candle[]; note: string }>(100);
const FX_CANDLE_CACHE_MS = 60_000;

/** FX intraday candles via TwelveData (server key). Paper trading only. */
export const loadFxCandles = createServerFn({ method: "POST" })
  .validator((input: { pair?: string; interval?: string }) => {
    const raw = String(input?.pair ?? "").toUpperCase().replace(/[^A-Z/]/g, "").slice(0, 10);
    const pair = (FX_PAIRS as readonly string[]).includes(raw) ? raw : "EUR/USD";
    const interval = FX_INTERVALS.has(String(input?.interval)) ? String(input?.interval) : "5m";
    return { pair, interval };
  })
  .handler(async ({ data }): Promise<{ candles: Candle[]; note: string }> => {
    const apiKey = process.env.TWELVEDATA_API_KEY?.trim();
    if (!apiKey) {
      return { candles: [], note: "FX candles need TWELVEDATA_API_KEY on the host (free tier)" };
    }
    const cacheKey = `${data.pair}:${data.interval}`;
    return fetchCached(fxCandleCache, cacheKey, FX_CANDLE_CACHE_MS, async () => {
      try {
        const candles = await fetchTwelveCandles(
          data.pair,
          fxIntervalFor(data.interval as "1m" | "5m" | "15m" | "1h"),
          apiKey,
        );
        if (!candles.length) throw new Error("TwelveData returned no usable candles");
        return { candles, note: `TwelveData ${data.pair} ${data.interval}` };
      } catch (error) {
        const message = error instanceof Error ? error.message : "FX candles unavailable";
        return { candles: [], note: message };
      }
    });
  });

const fxSpotCache = createCache<{ prices: Record<string, number>; live: string[]; daily: string[]; note: string }>(100);
const FX_SPOT_CACHE_MS = 30_000;

/**
 * FX spot marks for open paper positions. TwelveData when keyed, otherwise the
 * free Frankfurter daily reference — marks, never execution.
 */
export const loadFxSpot = createServerFn({ method: "POST" })
  .validator((input: { pairs?: string[] }) => {
    const pairs = (Array.isArray(input?.pairs) ? input.pairs : [])
      .map((p) => String(p).toUpperCase().replace(/[^A-Z/]/g, "").slice(0, 10))
      .filter((p) => (FX_PAIRS as readonly string[]).includes(p))
      .slice(0, 8);
    return { pairs };
  })
  .handler(async ({ data }): Promise<{ prices: Record<string, number>; live: string[]; daily: string[]; note: string }> => {
    if (!data.pairs.length) return { prices: {}, live: [], daily: [], note: "No FX pairs requested" };
    const cacheKey = [...data.pairs].sort().join(",");
    return fetchCached(fxSpotCache, cacheKey, FX_SPOT_CACHE_MS, async () => {
      const prices: Record<string, number> = {};
      const live: string[] = [];
      const daily: string[] = [];
    const apiKey = process.env.TWELVEDATA_API_KEY?.trim();
    if (apiKey) {
      const settled = await Promise.allSettled(
        data.pairs.map((pair) => fetchTwelveCandles(pair, "1min", apiKey, 1)),
      );
      settled.forEach((r, i) => {
        const last = r.status === "fulfilled" ? r.value.at(-1) : undefined;
        const key = `fx:${data.pairs[i].replace("/", "")}`;
        if (last) {
          prices[key] = last.close;
          live.push(key);
        }
      });
    }
    // Frankfurter fills whatever TwelveData missed (free, keyless, daily ref).
    // Daily refs ride the shared prices map but are flagged, so exits never
    // fire on a 24h-old print. XAU has no fiat quote: honestly no mark.
    await Promise.all(
      data.pairs.map(async (pair) => {
        const key = `fx:${pair.replace("/", "")}`;
        if (prices[key] > 0) return;
        const [base, quote] = pair.split("/");
        const direct = await fetchFrankfurterSpot(base, quote);
        if (direct !== null && direct > 0) {
          prices[key] = direct;
          daily.push(key);
          return;
        }
        // Cross via USD when the direct quote is unavailable.
        const [baseUsd, quoteUsd] = await Promise.all([
          fetchFrankfurterSpot(base, "USD"),
          fetchFrankfurterSpot(quote, "USD"),
        ]);
        if (baseUsd !== null && quoteUsd !== null && quoteUsd > 0) {
          prices[key] = baseUsd / quoteUsd;
          daily.push(key);
        }
      }),
    );
    return {
      prices,
      live,
      daily,
      note: `FX spots · ${live.length} live, ${daily.length} daily ref, ${Object.keys(prices).length}/${data.pairs.length} pairs`,
    };
    });
  });

let perpFundingCache: { at: number; rows: PerpFunding[] } | null = null;
const PERP_FUNDING_CACHE_MS = 60_000;

/** Live Hyperliquid perp funding + marks (free, no key) for avenue hydration. */
export const loadPerpFunding = createServerFn({ method: "GET" }).handler(async (): Promise<{
  rows: PerpFunding[];
  note: string;
}> => {
  if (perpFundingCache && Date.now() - perpFundingCache.at < PERP_FUNDING_CACHE_MS) {
    return { rows: perpFundingCache.rows, note: `Hyperliquid live · ${perpFundingCache.rows.length} perps` };
  }
  try {
    const rows = await fetchHyperliquidFunding();
    perpFundingCache = { at: Date.now(), rows };
    return { rows, note: `Hyperliquid live · ${rows.length} perps` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Perp funding unavailable";
    return { rows: perpFundingCache?.rows ?? [], note: message };
  }
});

/**
 * Real dual-provider security verification for one token (GoPlus +
 * honeypot.is, fail-closed). Powers DYOR deep audits with evidence instead
 * of heuristics.
 */
export const verifyInstrument = createServerFn({ method: "POST" })
  .validator((input: { chain?: string; address?: string }) => ({
    chain: String(input?.chain ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32),
    address: String(input?.address ?? "").trim().slice(0, 128),
  }))
  .handler(async ({ data }): Promise<{ security: SecurityReport | null; note: string }> => {
    if (!data.chain || !data.address) {
      return { security: null, note: "Chain and contract address are required" };
    }
    const metric: TokenMetrics = {
      chain: data.chain,
      address: data.address,
      symbol: "",
      name: "",
      priceUsd: null,
      liquidityUsd: null,
      volume24h: null,
      marketCap: null,
      fdv: null,
      priceChange24h: null,
      buys24h: null,
      sells24h: null,
      pairCreatedAt: null,
      url: null,
      fetchedAt: Date.now(),
    };
    try {
      const security = await verifySecurity(metric);
      if (!security) {
        return { security: null, note: "Security providers returned no usable report — treated as unverified" };
      }
      return {
        security,
        note: security.verified
          ? `Verified by ${security.providers.join(" + ")}`
          : `Partial evidence from ${security.providers.join(" + ") || "no provider"} — unverified`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Security check failed";
      return { security: null, note: message };
    }
  });
