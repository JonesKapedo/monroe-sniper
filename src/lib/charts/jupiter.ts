export type JupiterTick = {
  mint: string;
  usdPrice: number;
  liquidityUsd: number | null;
  change24h: number | null;
  blockId: number | null;
};

const LITE_URL = "https://lite-api.jup.ag/price/v3";

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Parse a Jupiter Price V3 payload; unknown mints are simply absent. */
export function parseJupiterPrices(payload: unknown, mints: string[]): JupiterTick[] {
  const root = payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const out: JupiterTick[] = [];
  for (const mint of mints) {
    const row = root[mint];
    if (row === null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const usdPrice = finiteNumber(r.usdPrice);
    if (!(usdPrice !== null && usdPrice > 0)) continue;
    const liquidity = finiteNumber(r.liquidity);
    const change = finiteNumber(r.priceChange24h);
    const blockRaw = finiteNumber(r.blockId);
    out.push({
      mint,
      usdPrice,
      liquidityUsd: liquidity !== null && liquidity >= 0 ? liquidity : null,
      change24h: change,
      blockId: blockRaw !== null ? Math.floor(blockRaw) : null,
    });
  }
  return out;
}

export async function fetchJupiterTicks(mints: string[]): Promise<JupiterTick[]> {
  const clean = [...new Set(mints.map((m) => m.trim()).filter(Boolean))].slice(0, 50);
  if (clean.length === 0) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${LITE_URL}?ids=${encodeURIComponent(clean.join(","))}`, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Jupiter HTTP ${res.status}`);
    return parseJupiterPrices(await res.json(), clean);
  } finally {
    clearTimeout(timer);
  }
}
