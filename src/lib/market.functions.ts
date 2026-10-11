import { createServerFn } from "@tanstack/react-start";
import { scoreCandidate, type Candidate } from "./paper";

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
    if (Array.isArray(body)) {
      const pairs: Pair[] = [];
      for (const profile of body.slice(0, 8) as { chainId?: string; tokenAddress?: string }[]) {
        if (!profile.chainId || !profile.tokenAddress) continue;
        const nested = await fetch(
          `https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(profile.chainId)}/${encodeURIComponent(profile.tokenAddress)}`,
          { headers: { Accept: "application/json" }, signal: ctrl.signal },
        );
        if (!nested.ok) continue;
        const data = (await nested.json()) as { pairs?: Pair[] } | Pair[];
        const list = Array.isArray(data) ? data : (data.pairs ?? []);
        pairs.push(...list);
      }
      return pairs;
    }
    return body.pairs ?? [];
  } finally {
    clearTimeout(timer);
  }
}

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
