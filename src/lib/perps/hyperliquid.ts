export type PerpFunding = {
  coin: string;
  markPx: number | null;
  funding1h: number | null;
  openInterest: number | null;
};

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Parse a Hyperliquid metaAndAssetCtxs response into per-coin funding rows. */
export function parseHyperliquidFunding(payload: unknown): PerpFunding[] {
  if (!Array.isArray(payload) || payload.length < 2) return [];
  const [meta, ctxs] = payload as [Record<string, unknown>, unknown];
  const universe = Array.isArray(meta?.universe) ? meta.universe : [];
  const contexts = Array.isArray(ctxs) ? ctxs : [];
  const out: PerpFunding[] = [];
  for (let i = 0; i < universe.length; i += 1) {
    const coin = universe[i] !== null && typeof universe[i] === "object"
      ? String((universe[i] as Record<string, unknown>).name ?? "")
      : "";
    if (!coin) continue;
    const ctx = contexts[i] !== null && typeof contexts[i] === "object"
      ? (contexts[i] as Record<string, unknown>)
      : {};
    out.push({
      coin,
      markPx: finiteNumber(ctx.markPx),
      funding1h: finiteNumber(ctx.funding),
      openInterest: finiteNumber(ctx.openInterest),
    });
  }
  return out;
}

/** Annualized Crazy-8 funding: 1h rate × 24 × 365, as a percent number. */
export function fundingAprPct(funding1h: number | null): number | null {
  if (funding1h === null || !Number.isFinite(funding1h)) return null;
  return Math.round(funding1h * 24 * 365 * 100 * 100) / 100;
}

/** Per-8h rate as a fraction (the desk's usual quote unit). */
export function funding8hRate(funding1h: number | null): number | null {
  if (funding1h === null || !Number.isFinite(funding1h)) return null;
  return funding1h * 8;
}

export async function fetchHyperliquidFunding(): Promise<PerpFunding[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Hyperliquid HTTP ${res.status}`);
    return parseHyperliquidFunding(await res.json());
  } finally {
    clearTimeout(timer);
  }
}
