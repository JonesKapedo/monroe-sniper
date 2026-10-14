import type { Candle } from "../market-candles";

export type DexTimeframe = "1m" | "5m" | "15m" | "1h";

const AGGREGATE: Record<DexTimeframe, number> = { "1m": 1, "5m": 5, "15m": 15, "1h": 60 };
const DURATION_MS: Record<DexTimeframe, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
};

export function geckoOhlcvUrl(poolAddress: string, timeframe: DexTimeframe, limit = 48): string {
  return (
    `https://api.geckoterminal.com/api/v2/networks/solana/pools/` +
    `${encodeURIComponent(poolAddress)}/ohlcv/minute` +
    `?aggregate=${AGGREGATE[timeframe]}&limit=${Math.max(1, Math.min(200, limit))}`
  );
}

function finitePositive(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Parse a GeckoTerminal OHLCV payload. Rows are
 * [unixSeconds, open, high, low, close, volume]. Inverted rows (high < low)
 * are rejected like every other feed — never silently normalized.
 */
export function parseGeckoOhlcv(payload: unknown): Candle[] {
  const root = payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = root.data !== null && typeof root.data === "object" ? (root.data as Record<string, unknown>) : {};
  const attrs = data.attributes !== null && typeof data.attributes === "object" ? (data.attributes as Record<string, unknown>) : {};
  const list = Array.isArray(attrs.ohlcv_list) ? attrs.ohlcv_list : [];
  const candles: Candle[] = [];
  for (const row of list) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const [ts, open, high, low, close] = row;
    const time = typeof ts === "number" && Number.isFinite(ts) && ts > 0 ? ts * 1000 : null;
    const o = finitePositive(open);
    const h = finitePositive(high);
    const l = finitePositive(low);
    const c = finitePositive(close);
    if (time === null || o === null || h === null || l === null || c === null) continue;
    if (h < l) continue;
    candles.push({ time, open: o, high: h, low: l, close: c });
  }
  return candles.sort((a, b) => a.time - b.time).slice(-200);
}

export function candleDurationMs(timeframe: DexTimeframe): number {
  return DURATION_MS[timeframe];
}

/**
 * True when the newest candle is older than two full buckets — the chart is
 * showing history, not the market. Callers badge this instead of implying
 * live coverage.
 */
export function detectChartGap(candles: Candle[], nowMs: number, durationMs: number): boolean {
  if (!candles.length || !(durationMs > 0)) return false;
  const last = candles[candles.length - 1];
  return nowMs - last.time > durationMs * 2;
}

/**
 * Fold a live price tick into the candle array: extend the open bucket or
 * roll a new one. Pure — safe to call on every tick poll.
 */
export function mergeTickIntoCandles(
  candles: Candle[],
  price: number,
  nowMs: number,
  durationMs: number,
): Candle[] {
  if (!candles.length || !(price > 0) || !(durationMs > 0)) return candles;
  const bucket = Math.floor(nowMs / durationMs) * durationMs;
  const last = candles[candles.length - 1];
  if (last.time === bucket) {
    const updated = {
      ...last,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      close: price,
    };
    return [...candles.slice(0, -1), updated];
  }
  if (bucket > last.time) {
    return [
      ...candles.slice(-199),
      {
        time: bucket,
        open: last.close,
        high: Math.max(last.close, price),
        low: Math.min(last.close, price),
        close: price,
      },
    ];
  }
  return candles;
}

export async function fetchGeckoCandles(
  poolAddress: string,
  timeframe: DexTimeframe,
  limit = 48,
): Promise<Candle[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(geckoOhlcvUrl(poolAddress, timeframe, limit), {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`GeckoTerminal HTTP ${res.status}`);
    return parseGeckoOhlcv(await res.json());
  } finally {
    clearTimeout(timer);
  }
}
