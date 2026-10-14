import type { Candle } from "../market-candles";

export const FX_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"] as const;
export type FxPair = (typeof FX_PAIRS)[number];
export type FxInterval = "1min" | "5min" | "15min" | "1h";

export function fxIntervalFor(timeframe: "1m" | "5m" | "15m" | "1h"): FxInterval {
  return ({ "1m": "1min", "5m": "5min", "15m": "15min", "1h": "1h" } as const)[timeframe];
}

function finitePositive(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parse a TwelveData time_series payload into candles, newest last. */
export function parseTwelveCandles(payload: unknown): Candle[] {
  const root = payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const values = Array.isArray(root.values) ? root.values : [];
  const candles: Candle[] = [];
  for (const row of values) {
    if (row === null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const time = typeof r.datetime === "string" ? Date.parse(r.datetime) : NaN;
    const o = finitePositive(r.open);
    const h = finitePositive(r.high);
    const l = finitePositive(r.low);
    const c = finitePositive(r.close);
    if (!Number.isFinite(time) || o === null || h === null || l === null || c === null) continue;
    candles.push({ time, open: o, high: Math.max(h, l, o, c), low: Math.min(h, l, o, c), close: c });
  }
  return candles.sort((a, b) => a.time - b.time).slice(-120);
}

/** Parse a Frankfurter latest-rates payload into a single USD spot per base. */
export function parseFrankfurterSpot(payload: unknown, base: string): number | null {
  const root = payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const rates = root.rates !== null && typeof root.rates === "object" ? (root.rates as Record<string, unknown>) : {};
  if (base === "USD") return 1;
  // Frankfurter quotes from=BASE&to=USD → rates.USD is base→USD.
  return finitePositive(rates.USD);
}

export async function fetchTwelveCandles(
  pair: string,
  interval: FxInterval,
  apiKey: string,
  outputsize = 48,
): Promise<Candle[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(pair)}&interval=${interval}&apikey=${encodeURIComponent(apiKey)}&outputsize=${outputsize}&format=JSON`,
      { headers: { Accept: "application/json" }, signal: ctrl.signal },
    );
    if (!res.ok) throw new Error(`TwelveData HTTP ${res.status}`);
    const body = (await res.json()) as Record<string, unknown>;
    if (typeof body.status === "string" && body.status !== "ok" && !Array.isArray(body.values)) {
      throw new Error(typeof body.message === "string" ? body.message : "TwelveData error");
    }
    return parseTwelveCandles(body);
  } finally {
    clearTimeout(timer);
  }
}

/** Free keyless spot fallback (daily ECB reference) — marks, not charting. */
export async function fetchFrankfurterSpot(base: string, quote = "USD"): Promise<number | null> {
  if (base === quote) return 1;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`,
      { headers: { Accept: "application/json" }, signal: ctrl.signal },
    );
    if (!res.ok) return null;
    return parseFrankfurterSpot(await res.json(), base);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
