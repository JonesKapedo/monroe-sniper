import { create } from "zustand";

export type PricePoint = { t: number; p: number };

/** Points retained per symbol (~4 min of 3s tape cycles). */
const MAX_POINTS = 240;
/** Ignore a repeat of the same price inside this window (keeps the line calm). */
const MIN_GAP_MS = 1_200;

type PriceHistoryState = {
  /** Rolling intraday price path per symbol id. Session-only (never persisted). */
  series: Record<string, PricePoint[]>;
  /** Append the latest tape quotes. Safe to call every engine cycle. */
  record: (rows: { id: string; priceUsd: number }[]) => void;
};

export const usePriceHistory = create<PriceHistoryState>((set) => ({
  series: {},
  record: (rows) =>
    set((state) => {
      if (!rows.length) return state;
      const now = Date.now();
      let changed = false;
      const next = { ...state.series };
      for (const row of rows) {
        if (!row.id || !Number.isFinite(row.priceUsd) || row.priceUsd <= 0) continue;
        const prev = next[row.id];
        const arr = prev ? prev.slice() : [];
        const last = arr[arr.length - 1];
        if (last && now - last.t < MIN_GAP_MS && last.p === row.priceUsd) continue;
        arr.push({ t: now, p: row.priceUsd });
        if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
        next[row.id] = arr;
        changed = true;
      }
      return changed ? { series: next } : state;
    }),
}));

/** Percentage change across the retained window, or null when too few points. */
export function seriesChange(points: PricePoint[] | undefined): number | null {
  if (!points || points.length < 2) return null;
  const first = points[0].p;
  const last = points[points.length - 1].p;
  if (!first) return null;
  return ((last - first) / first) * 100;
}

/**
 * Aggregate a tick path into OHLC candles bucketed by `minutes`. The most
 * recent bucket is the live, still-forming candle.
 */
export type Candle = { t: number; o: number; h: number; l: number; c: number };

export function toCandles(points: PricePoint[] | undefined, minutes: number): Candle[] {
  if (!points || !points.length) return [];
  const bucketMs = Math.max(1, minutes) * 60_000;
  const out: Candle[] = [];
  for (const pt of points) {
    const bucket = Math.floor(pt.t / bucketMs) * bucketMs;
    const last = out[out.length - 1];
    if (last && last.t === bucket) {
      last.h = Math.max(last.h, pt.p);
      last.l = Math.min(last.l, pt.p);
      last.c = pt.p;
    } else {
      out.push({ t: bucket, o: pt.p, h: pt.p, l: pt.p, c: pt.p });
    }
  }
  return out;
}
