export type Candle = { time: number; open: number; high: number; low: number; close: number };

const KRAKEN_PAIRS: Record<string, string> = {
  BTCUSDT: "XBTUSDT",
  ETHUSDT: "ETHUSDT",
  SOLUSDT: "SOLUSDT",
  BNBUSDT: "BNBUSDT",
  XRPUSDT: "XRPUSDT",
  DOGEUSDT: "XDGUSDT",
};

const KRAKEN_INTERVALS: Record<string, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
};

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function krakenPairFor(symbol: string): string | null {
  return KRAKEN_PAIRS[symbol] ?? null;
}

export function krakenIntervalFor(interval: string): number | null {
  return KRAKEN_INTERVALS[interval] ?? null;
}

export function parseKrakenCandles(payload: {
  error?: unknown;
  result?: Record<string, unknown>;
}): Candle[] {
  const errors = Array.isArray(payload.error) ? payload.error.filter(Boolean).join(", ") : "";
  if (errors) throw new Error(`Kraken API: ${errors}`);

  const rows = Object.values(payload.result ?? {}).find(Array.isArray);
  if (!rows) throw new Error("Kraken response contained no OHLC rows");

  return rows
    .flatMap((row): Candle[] => {
      if (!Array.isArray(row) || row.length < 5) return [];
      const [timestamp, rawOpen, rawHigh, rawLow, rawClose] = row;
      const time = finiteNumber(timestamp);
      const open = finiteNumber(rawOpen);
      const high = finiteNumber(rawHigh);
      const low = finiteNumber(rawLow);
      const close = finiteNumber(rawClose);
      if (
        time === null ||
        open === null ||
        high === null ||
        low === null ||
        close === null ||
        time <= 0 ||
        open <= 0 ||
        high <= 0 ||
        low <= 0 ||
        close <= 0 ||
        high < low
      ) {
        return [];
      }
      return [{ time: time * 1000, open, high, low, close }];
    })
    .slice(-48);
}
