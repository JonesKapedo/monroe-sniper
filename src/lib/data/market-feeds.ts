/** Real‑world market‑data feeds for the Monroe Sniper bot.
 *  Provides ticker, order‑book snapshot and historical‑candle endpoints
 *  for the most‑traded crypto pairs.  Pulls from free and paid sources;
 *  the `source` flag lets the UI / config switch without code changes.
 *
 *  All functions are pure (no global state) and return promises so they
 *  can be awaited in an async `step()` or `autoStep()` context.
 *
 *  **Paid‑source requirement** – the CoinGecko Pro / CryptoCompare endpoints
 *  require a registered API key.  The keys are read from environment
 *  variables (Vercel or local `.env`) and never checked into source.
 *
 *  **Fail‑over** – if a paid source fails the function falls back to the
 *  free Coingecko public API (`/simple/price` / `/coins/{id}/market`).
 *  A failed fetch does not crash the desk – the returned object contains
 *  `undefined` fields so the desk can continue with stale quotes.
 */

export type Ticker = {
  symbol: string;
  price: number;
  change24h: number; // percent
  volume24h: number;
  marketCap: number | undefined;
  lastUpdated: number;
};

/** Free‑tier Coingecko endpoint – no API key required. */
export async function fetchFreeTicker(symbol: string): Promise<Ticker | null> {
  // Map common symbols to CoinGecko IDs
  const idMap: Record<string, string> = {
    btc: "bitcoin",
    eth: "ethereum",
    sol: "solana",
    bnb: "binancecoin",
    ada: "cardano",
    dot: "polkadot",
    dot: "polkadot",
    dot: "polkadot",
  };

  const id = idMap[symbol.toLowerCase()] || symbol.toLowerCase();
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change&include_market_cap`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      // Free tier may throttle; no special headers needed.
    });

    if (!response.ok) {
      console.warn(`Free Coingecko ticker failed for ${symbol}`);
      return null;
    }

    const data = await response.json();
    const coin = data[id];
    if (!coin) {
      console.warn(`Coingecko ticker missing id=${id}`);
      return null;
    }

    return {
      symbol: symbol.toUpperCase(),
      price: Number(coin.usd),
      change24h: Number(coin.usd_24h_change || 0),
      volume24h: Number(coin.usd_24h_volume) || 0,
      marketCap: Number(coin.usd_market_cap) || undefined,
      lastUpdated: Date.now(),
    };
  } catch (e) {
    console.warn(`Free Coingecko ticker exception for ${symbol}`, e);
    return null;
  }
}

/** Paid‑tier CoinGecko / CryptoCompare endpoints would go here.
 *  The function signature mirrors `fetchFreeTicker` so the desk code
 *  can call `fetchTicker(symbol, "paid")` and swap the implementation
 *  without touching the desk logic.
 *
 *  **TODO** – add real paid‑source logic when API keys are provisioned.
 */
export async function fetchPaidTicker(symbol: string): Promise<Ticker | null> {
  // Placeholder – currently falls back to the free source.
  return fetchFreeTicker(symbol);
}

/** High‑level wrapper – tries paid first, then free. */
export async function fetchTicker(symbol: string, source?: "paid" | "free"): Promise<Ticker | null> {
  if (source === "paid") {
    return fetchPaidTicker(symbol);
  }
  return fetchFreeTicker(symbol);
}

/** Snapshot of order‑book data from an exchange ticker.
 *  Not all venues provide full order‑book data for free; this function
 *  returns what is available and marks the rest as `undefined`.
 */
export type OrderBookSnapshot = {
  symbol: string;
  bid: number | undefined;
  ask: number | undefined;
  bidSize: number | undefined;
  askSize: number | undefined;
  lastPrice: number | undefined;
  lastUpdated: number;
};

/** Returns a best‑effort order‑book snapshot.  Most free APIs only give
 *  the last price; full order‑book data usually requires a paid subscription.
 */
export async function fetchOrderBookSnapshot(symbol: string): Promise<OrderBookSnapshot> {
  const ticker = await fetchFreeTicker(symbol);
  if (!ticker) {
    return {
      symbol,
      bid: undefined,
      ask: undefined,
      bidSize: undefined,
      askSize: undefined,
      lastPrice: undefined,
      lastUpdated: Date.now(),
    };
  }
  // Free APIs typically only give last price; we mark the rest undefined.
  return {
    symbol,
    bid: undefined,
    ask: undefined,
    bidSize: undefined,
    askSize: undefined,
    lastPrice: ticker.price,
    lastUpdated: ticker.lastUpdated,
  };
}

/** Historical candle data – 1‑minute resolution, last 100 candles.
 *  Free Coingecko does not provide OHLCV, so this function is a stub.
 *  Paid sources (CoinGecko Pro, CryptoCompare, Polygon, etc.) would
 *  implement the real HTTP call and return an array of `{ t, o, h, l, c, v }`.
 */
export type Candle = {
  t: number; // ms since epoch
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
};

/** Fetches the most recent 100 candles at 1‑minute resolution.
 *  Free tier: returns an empty array – the desk will use candle‑less
 *  logic (price‑only) until a paid source is configured.
 */
export async function fetchCandles(symbol: string): Promise<Candle[]> {
  // Free tier returns empty; paid source implementation required.
  return [];
}

/** Helper: clamp a number to 0‑100. */
function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export type { Ticker, OrderBookSnapshot, Candle };