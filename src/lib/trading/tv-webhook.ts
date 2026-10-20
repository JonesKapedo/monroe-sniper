export type TvSignal = {
  symbol: string;
  side: "buy" | "sell";
  price: number | null;
  notionalUsd: number | null;
};

export type TvParse = { ok: true; signal: TvSignal; note: string } | { ok: false; note: string };

function num(v: unknown): number | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sideOf(v: unknown): "buy" | "sell" | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase();
  if (/\b(buy|long|bid)\b/.test(s) || s === "buy") return "buy";
  if (/\b(sell|short|exit|close|reduce)\b/.test(s) || s === "sell") return "sell";
  return null;
}

export function normalizeSymbol(v: unknown): string {
  const raw = typeof v === "string" ? v : "";
  return raw
    .replace(/^[A-Za-z]+:/, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Accepts a TradingView alert either as a JSON object or its plain-text body
 * ("BUY BTCUSDT @ 64000"). Returns a normalized signal or a reason it failed.
 */
export function parseTradingViewAlert(input: unknown): TvParse {
  let obj: Record<string, unknown> | null = null;
  let text = "";
  if (typeof input === "string") {
    text = input.trim();
    try {
      obj = JSON.parse(text) as Record<string, unknown>;
    } catch {
      obj = null;
    }
  } else if (input && typeof input === "object") {
    obj = input as Record<string, unknown>;
  }

  if (obj) {
    const symbol = normalizeSymbol(obj.symbol ?? obj.ticker ?? obj.pair ?? obj.instrument);
    if (!symbol) return { ok: false, note: "Missing symbol" };
    const side = sideOf(obj.action ?? obj.side ?? obj.order ?? obj.strategy);
    if (!side) return { ok: false, note: "Missing or unknown action (buy/sell)" };
    const price = num(obj.price ?? obj.close ?? obj.last);
    const notionalUsd = num(obj.notional_usd ?? obj.notional ?? obj.usd ?? obj.amount);
    return {
      ok: true,
      signal: { symbol, side, price, notionalUsd },
      note: `Parsed ${side.toUpperCase()} ${symbol}`,
    };
  }

  if (text) {
    const tokens = text.split(/[\s,]+/).filter(Boolean);
    const side = tokens.map(sideOf).find(Boolean) ?? null;
    if (!side) return { ok: false, note: "No buy/sell keyword in alert text" };
    const sym = tokens.map(normalizeSymbol).find((t) => t.length >= 5 && /[A-Z]/.test(t)) ?? "";
    if (!sym) return { ok: false, note: "No symbol found in alert text" };
    const at = tokens.find((t) => /@|at/i.test(t));
    let price: number | null = null;
    for (const t of tokens) {
      const n = num(t.replace(/[^0-9.]/g, ""));
      if (n !== null && n > 1) {
        price = n;
        break;
      }
    }
    return { ok: true, signal: { symbol: sym, side, price, notionalUsd: null }, note: `Parsed ${side.toUpperCase()} ${sym} from text` };
  }

  return { ok: false, note: "Empty alert body" };
}
