import { createCache, fetchCached } from "./cache";
import { scoreCandidate, type Candidate } from "./paper";
import { memecoinVerdict } from "./intel/memecoin";

export const GMGN_BASE_URL = "http://127.0.0.1:8000";

export type GmgnChain = "sol" | "bsc" | "base" | "eth" | "robinhood";

const CHAINS: ReadonlySet<string> = new Set(["sol", "bsc", "base", "eth", "robinhood"]);

const DEX_CHAIN: Record<GmgnChain, string> = {
  sol: "solana",
  bsc: "bsc",
  base: "base",
  eth: "ethereum",
  robinhood: "robinhood",
};

type GmgnVerdict = {
  verdict?: string;
  conviction?: number;
  crowdedness?: string;
  thesis?: string;
  red_flags?: string[];
};

type GmgnDecision = {
  decision?: {
    symbol?: string;
    address?: string;
    action?: string;
    reason?: string;
    size_sol?: number;
    risk_warn?: boolean;
    verdict?: GmgnVerdict;
    features?: Record<string, unknown>;
    priority?: number;
  };
};

type GmgnRun = {
  decisions?: GmgnDecision[];
  mode?: string;
};

type GmgnStatus = {
  live_adapter?: boolean;
  has_key?: boolean;
  public_demo?: boolean;
  chain?: string;
};

type DexPair = {
  chainId?: string;
  url?: string;
  priceUsd?: string;
  pairCreatedAt?: number;
  baseToken?: { address?: string; symbol?: string; name?: string };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
};

export type DexSnapshot = {
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  change24h: number;
  pairAgeHours: number | null;
  url: string | null;
};

export type GmgnPack = {
  candidates: Candidate[];
  quotes: Candidate[];
  state: "live" | "down" | "locked";
  detail: string;
  note: string;
};

const packCache = createCache<GmgnPack>(20);
const PACK_TTL_MS = 30_000;

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function bool(v: unknown): boolean {
  return v === true || v === 1 || v === "true" || v === "1";
}

export function gmgnChain(raw?: string): GmgnChain {
  const value = (raw ?? "").trim().toLowerCase();
  return (CHAINS.has(value) ? value : "sol") as GmgnChain;
}

export function dexChainId(chain: string): string {
  const c = gmgnChain(chain);
  return DEX_CHAIN[c];
}

function candidateId(chain: GmgnChain, address: string): string {
  return `gmgn:${chain}:${address.toLowerCase()}`;
}

function tokenUrl(chain: GmgnChain, address: string): string {
  return `https://gmgn.ai/${chain}/token/${address}`;
}

async function getJson<T>(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function dexSnapshots(chain: GmgnChain, addresses: string[]): Promise<Map<string, DexSnapshot>> {
  const out = new Map<string, DexSnapshot>();
  if (!addresses.length || chain === "robinhood") return out;
  const wanted = [...new Set(addresses.map((a) => a.toLowerCase()))].slice(0, 30);
  try {
    const body = await getJson<{ pairs?: DexPair[] } | DexPair[]>(
      `https://api.dexscreener.com/latest/dex/tokens/${wanted.map(encodeURIComponent).join(",")}`,
      {},
      7000,
    );
    const pairs = Array.isArray(body) ? body : (body.pairs ?? []);
    const best = new Map<string, DexPair>();
    for (const pair of pairs) {
      const address = pair.baseToken?.address?.toLowerCase();
      if (!address || !wanted.includes(address)) continue;
      if (pair.chainId && pair.chainId !== DEX_CHAIN[chain]) continue;
      const prev = best.get(address);
      if (!prev || (num(pair.liquidity?.usd) ?? 0) > (num(prev.liquidity?.usd) ?? 0)) {
        best.set(address, pair);
      }
    }
    for (const [address, pair] of best) {
      const price = num(pair.priceUsd);
      if (!price || price <= 0) continue;
      out.set(address, {
        priceUsd: price,
        liquidityUsd: num(pair.liquidity?.usd) ?? 0,
        volume24h: num(pair.volume?.h24) ?? 0,
        change24h: num(pair.priceChange?.h24) ?? 0,
        pairAgeHours: pair.pairCreatedAt
          ? Math.max(0, (Date.now() - pair.pairCreatedAt) / 3_600_000)
          : null,
        url: pair.url ?? null,
      });
    }
  } catch {
    // DexScreener is an enrichment source; GMGN's own row remains authoritative.
  }
  return out;
}

export type MapGmgnOptions = {
  chain: GmgnChain;
  pairs?: Map<string, DexSnapshot>;
  mock?: boolean;
};

export function mapGmgnRun(payload: unknown, opts: MapGmgnOptions): {
  candidates: Candidate[];
  quotes: Candidate[];
} {
  const run = (payload ?? {}) as GmgnRun;
  const rows = Array.isArray(run.decisions) ? run.decisions : [];
  const pairs = opts.pairs ?? new Map<string, DexSnapshot>();
  const candidates: Candidate[] = [];
  const quotes: Candidate[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const d = row?.decision;
    if (!d) continue;
    const address = str(d.address);
    const symbol = str(d.symbol);
    if (!address || !symbol) continue;
    const f = (d.features ?? {}) as Record<string, unknown>;
    const pair = pairs.get(address.toLowerCase());
    const priceUsd = pair?.priceUsd ?? num(f.price) ?? 0;
    if (!(priceUsd > 0)) continue;

    const liquidityUsd = pair?.liquidityUsd ?? num(f.liquidity) ?? 0;
    const volume24h =
      pair?.volume24h ??
      num(f.vol_1h) ??
      (num(f.turnover) ?? 0) * (num(f.mcap) ?? 0);
    const change24h = pair?.change24h ?? (num(f.chg_1h) ?? 0) * 100;
    const ageHours = pair?.pairAgeHours ?? (num(f.age_min) != null ? (num(f.age_min) as number) / 60 : null);
    const priority = Math.max(0, Math.min(100, Math.round(num(d.priority) ?? 0)));
    const verdict = d.verdict ?? {};
    const crowdedness = str(verdict.crowdedness);
    const conviction = num(verdict.conviction);
    const red = Array.isArray(verdict.red_flags) ? verdict.red_flags.filter((x) => typeof x === "string") : [];
    const action = str(d.action).toUpperCase();

    const base = scoreCandidate({
      symbol,
      name: `${symbol} · GMGN ${opts.chain.toUpperCase()}`,
      chain: opts.chain,
      address,
      priceUsd,
      liquidityUsd,
      volume24h,
      change24h,
      pairCreatedAt: ageHours != null ? Date.now() - ageHours * 3_600_000 : null,
      url: pair?.url ?? tokenUrl(opts.chain, address),
      venue: "dex",
      liquidityUnknown: liquidityUsd <= 0,
    });
    if (!base) continue;

    const meme = action === "ACTION"
      ? memecoinVerdict({
          priority: priority > 0 ? priority : base.score,
          conviction,
          crowdedness,
          smart: num(f.smart_degen),
          kol: num(f.renowned),
          sniper: num(f.sniper_count),
          bundler: num(f.bundler),
          top10: num(f.top10),
          devHold: num(f.dev_hold),
          devScore: num(f.dev_score),
          devSurvival: num(f.dev_survival),
          devRugRate: num(f.dev_rug_rate),
          devInner: num(f.dev_inner_count),
          devUnsafe: num(f.dev_sec_unsafe),
          devReskin: bool(f.dev_reskin),
          buyTax: num(f.buy_tax),
          sellTax: num(f.sell_tax),
          buyRatio: num(f.buy_ratio),
          chg5m: num(f.chg_5m),
          chg1h: num(f.chg_1h),
          turnover: num(f.turnover),
          liquidity: liquidityUsd,
          mcap: num(f.mcap),
          ageMin: num(f.age_min),
          honeypot: bool(f.honeypot),
          renounced: typeof f.renounced === "boolean" ? f.renounced : null,
          riskWarn: bool(d.risk_warn),
          redFlags: red,
          mock: opts.mock === true,
        })
      : null;

    const flags = ["GMGN"];
    if (crowdedness === "late") flags.push("GMGN-LATE");
    if (d.risk_warn) flags.push("GMGN-RISK");
    if (opts.mock) flags.push("GMGN-MOCK");
    if (red.length) flags.push("GMGN-FLAG");
    for (const flag of meme?.flags ?? []) {
      if (!flags.includes(flag)) flags.push(flag);
    }

    const rationale: string[] = [];
    if (verdict.thesis) rationale.push(verdict.thesis);
    if (d.reason) rationale.push(d.reason);
    rationale.push(`GMGN priority ${priority}/100${conviction !== null ? ` · conviction ${Math.round(conviction * 100)}%` : ""}`);
    if (crowdedness) rationale.push(`GMGN crowd: ${crowdedness}`);
    for (const line of meme?.rationale ?? []) rationale.push(line);
    if (red.length) rationale.push(`GMGN flags: ${red.slice(0, 3).join(", ")}`);

    const candidate: Candidate = {
      ...base,
      id: candidateId(opts.chain, address),
      score: meme?.score ?? (priority > 0 ? priority : base.score),
      flags,
      rationale,
    };
    quotes.push(candidate);
    if (action !== "ACTION" || !meme?.ok) continue;
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    candidates.push(candidate);
  }

  candidates.sort((a, b) => b.score - a.score);
  return { candidates, quotes };
}

async function loadPack(chain: GmgnChain, baseUrl: string, allowMock: boolean): Promise<GmgnPack> {
  const url = baseUrl.replace(/\/+$/, "");
  let status: GmgnStatus | null = null;
  try {
    status = await getJson<GmgnStatus>(`${url}/api/status`, {}, 5000);
  } catch {
    status = null;
  }
  if (!status) {
    return {
      candidates: [],
      quotes: [],
      state: "down",
      detail: `GMGN bridge unreachable at ${url}`,
      note: "GMGN bridge down",
    };
  }

  const mock = status.live_adapter !== true;
  if (mock && !allowMock) {
    return {
      candidates: [],
      quotes: [],
      state: "locked",
      detail: "GMGN bridge is on mock data — add your API key in the GMGN app",
      note: "GMGN key required",
    };
  }

  try {
    const body = await getJson<GmgnRun>(
      `${url}/api/run`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain }),
      },
      25_000,
    );
    const rows = Array.isArray(body.decisions) ? body.decisions : [];
    const addresses = rows
      .map((row) => str(row?.decision?.address))
      .filter(Boolean);
    const pairs = mock ? new Map<string, DexSnapshot>() : await dexSnapshots(chain, addresses);
    const mapped = mapGmgnRun(body, { chain, pairs, mock });
    return {
      candidates: mapped.candidates,
      quotes: mapped.quotes,
      state: mock ? "locked" : "live",
      detail: mock
        ? "GMGN mock adapter — add your API key in the GMGN app"
        : `${mapped.candidates.length} screened · ${chain.toUpperCase()}`,
      note: `GMGN ${mock ? "mock" : "live"} · ${mapped.candidates.length} actionable`,
    };
  } catch (error) {
    return {
      candidates: [],
      quotes: [],
      state: "down",
      detail: `GMGN screen failed: ${error instanceof Error ? error.message : "unreachable"}`,
      note: "GMGN screen failed",
    };
  }
}

export async function loadGmgnPack(opts: {
  baseUrl?: string;
  chain?: string;
  allowMock?: boolean;
} = {}): Promise<GmgnPack> {
  const chain = gmgnChain(opts.chain ?? process.env.GMGN_CHAIN);
  const baseUrl = (opts.baseUrl ?? process.env.GMGN_BASE_URL ?? GMGN_BASE_URL).trim() || GMGN_BASE_URL;
  const allowMock =
    opts.allowMock ?? ["1", "true", "yes"].includes((process.env.GMGN_ALLOW_MOCK ?? "").toLowerCase());
  return fetchCached(
    packCache,
    `${baseUrl}|${chain}|${allowMock ? "mock" : "live"}`,
    PACK_TTL_MS,
    () => loadPack(chain, baseUrl, allowMock),
  );
}
