/** Public, dependency-free market-data adapters. Missing security evidence is never considered safe. */
export type RiskLevel = "safe" | "caution" | "danger";
export type TokenMetrics = {
  chain: string; address: string; symbol: string; name: string;
  priceUsd: number | null; liquidityUsd: number | null; volume24h: number | null;
  marketCap: number | null; fdv: number | null; priceChange24h: number | null;
  buys24h: number | null; sells24h: number | null; pairCreatedAt: number | null;
  url: string | null; fetchedAt: number;
};
export type SecurityReport = {
  honeypot: boolean | null; lpLocked: boolean | null; ownerCanMint: boolean | null;
  ownerCanFreeze: boolean | null; buyTax: number | null; sellTax: number | null;
  verified: boolean; checkedAt: number; providers: string[]; details: string[];
};
export type OpportunitySignal = {
  id: string; symbol: string; address: string; chain: string; score: number; risk: RiskLevel;
  flags: string[]; metrics: TokenMetrics; security: SecurityReport | null;
  securityVerified: boolean; tradableInPaperMode: boolean; rationale: string[];
};
export type ProviderStatus = {
  id: "dexscreener" | "coingecko" | "goplus" | "honeypot" | "sec-edgar";
  label: string; state: "idle" | "ok" | "degraded" | "error"; message: string; checkedAt: number | null;
};
export type ScanResult = { opportunities: OpportunitySignal[]; providers: ProviderStatus[]; scannedAt: number; query: string };

const TTL = 30_000;
const cache = new Map<string, { expires: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const obj = (v: unknown): Record<string, any> => v && typeof v === "object" ? v as Record<string, any> : {};
const str = (v: unknown, fallback = ""): string => typeof v === "string" && v.trim() ? v.trim() : fallback;
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));

async function json<T>(url: string, ttl = TTL): Promise<T> {
  const old = cache.get(url);
  if (old && old.expires > Date.now()) return old.value as T;
  const existing = pending.get(url);
  if (existing) return existing as Promise<T>;
  const task = (async () => {
    let last: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      try {
        const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
        if (!response.ok) {
          if (attempt === 0 && (response.status === 429 || response.status >= 500)) { await new Promise(r => setTimeout(r, 250)); continue; }
          throw new Error(`HTTP ${response.status}`);
        }
        const value = await response.json() as T;
        cache.set(url, { expires: Date.now() + ttl, value });
        while (cache.size > 120) { const first = cache.keys().next().value; if (first === undefined) break; cache.delete(first); }
        return value;
      } catch (error) { last = error; if (!attempt) await new Promise(r => setTimeout(r, 200)); }
      finally { clearTimeout(timer); }
    }
    throw last instanceof Error ? last : new Error("Market-data request failed");
  })();
  pending.set(url, task);
  try { return await task; } finally { pending.delete(url); }
}

const CHAIN_IDS: Record<string, string> = {
  ethereum: "1", eth: "1", bsc: "56", "binance-smart-chain": "56", base: "8453",
  polygon: "137", arbitrum: "42161", optimism: "10", avalanche: "43114", solana: "solana",
};
const CHAIN_NAMES: Record<string, string> = {
  "1": "ethereum", "56": "bsc", "8453": "base", "137": "polygon",
  "42161": "arbitrum", "10": "optimism", "43114": "avalanche", solana: "solana",
};
export function normalizeChain(chain: string): string {
  const key = chain.toLowerCase();
  return CHAIN_NAMES[CHAIN_IDS[key] ?? key] ?? key;
}
export function chainIdFor(chain: string): string | null {
  const key = chain.toLowerCase();
  return CHAIN_IDS[key] ?? (CHAIN_NAMES[key] ? key : null);
}
export function normalizeDexPair(input: unknown): TokenMetrics | null {
  const p = obj(input), base = obj(p.baseToken), address = str(base.address);
  if (!address) return null;
  const chain = normalizeChain(str(p.chainId, "unknown")), volume = obj(p.volume), change = obj(p.priceChange);
  const day = obj(obj(p.txns).h24);
  return {
    chain, address, symbol: str(base.symbol, "UNKNOWN").toUpperCase(), name: str(base.name, str(base.symbol, "Unknown token")),
    priceUsd: num(p.priceUsd), liquidityUsd: num(obj(p.liquidity).usd), volume24h: num(volume.h24),
    marketCap: num(p.marketCap), fdv: num(p.fdv), priceChange24h: num(change.h24),
    buys24h: num(day.buys), sells24h: num(day.sells), pairCreatedAt: num(p.pairCreatedAt),
    url: str(p.url) || null, fetchedAt: Date.now(),
  };
}
function dedupe(raw: unknown[]): TokenMetrics[] {
  const map = new Map<string, TokenMetrics>();
  for (const pair of raw.map(normalizeDexPair).filter((x): x is TokenMetrics => x !== null)) {
    const key = `${pair.chain}:${pair.address.toLowerCase()}`, prev = map.get(key);
    if (!prev || (pair.liquidityUsd ?? 0) > (prev.liquidityUsd ?? 0)) map.set(key, pair);
  }
  return [...map.values()].sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
}
export async function dexSearch(query: string): Promise<TokenMetrics[]> {
  if (!query.trim()) return [];
  const data = await json<{ pairs?: unknown[] }>(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query.trim())}`);
  return dedupe(data.pairs ?? []);
}
export async function dexTrending(): Promise<TokenMetrics[]> {
  const profiles = await json<unknown[]>("https://api.dexscreener.com/token-profiles/latest/v1", 15_000);
  const items = Array.isArray(profiles) ? profiles.slice(0, 18) : [];
  const rows = await Promise.all(items.map(async raw => {
    const p = obj(raw), chain = str(p.chainId), address = str(p.tokenAddress);
    if (!chain || !address) return [];
    try {
      const data = await json<{ pairs?: unknown[] }>(`https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`, 15_000);
      return data.pairs ?? [];
    } catch { return []; }
  }));
  return dedupe(rows.flat()).slice(0, 30);
}
export async function cgSearch(query: string): Promise<unknown[]> {
  const data = await json<{ coins?: unknown[] }>(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query.trim())}`, 60_000);
  return data.coins ?? [];
}
export async function cgPrice(ids: string[]): Promise<Record<string, unknown>> {
  if (!ids.length) return {};
  return json(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`, 30_000);
}
export async function dexToken(chain: string, address: string): Promise<TokenMetrics[]> {
  const data = await json<{ pairs?: unknown[] }>(`https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`);
  return dedupe(data.pairs ?? []);
}
export async function goplusSecurity(chain: string, address: string): Promise<Record<string, unknown> | null> {
  const id = chainIdFor(chain);
  if (!id || id === "solana") return null;
  const data = await json<Record<string, any>>(`https://api.gopluslabs.io/api/v1/token_security/${encodeURIComponent(id)}?contract_addresses=${encodeURIComponent(address)}`, 60_000);
  const result = obj(obj(data.result)[address.toLowerCase()] ?? obj(data.result)[address]);
  return Object.keys(result).length ? result : null;
}
export async function honeypotCheck(address: string, chainId = "1"): Promise<Record<string, unknown> | null> {
  const data = await json<Record<string, any>>(`https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(address)}&chainID=${encodeURIComponent(chainId)}`, 60_000);
  return Object.keys(data).length ? data : null;
}
export async function sec8K(query: string): Promise<unknown[]> {
  if (!query.trim()) return [];
  // Best effort only: the SEC may reject browser-origin requests via CORS.
  const data = await json<{ hits?: { hits?: unknown[] } }>(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(query.trim())}&forms=8-K&dateRange=custom&startdt=2024-01-01&enddt=${new Date().toISOString().slice(0, 10)}`, 120_000);
  return data.hits?.hits ?? [];
}
function boolFlag(v: unknown): boolean | null {
  if (v === "1" || v === 1 || v === true) return true;
  if (v === "0" || v === 0 || v === false) return false;
  return null;
}
export async function verifySecurity(m: TokenMetrics): Promise<SecurityReport | null> {
  const chainId = chainIdFor(m.chain);
  if (!chainId) return null;
  const [gpResult, hpResult] = await Promise.allSettled([goplusSecurity(m.chain, m.address), honeypotCheck(m.address, chainId)]);
  const gp = gpResult.status === "fulfilled" ? gpResult.value : null;
  const hp = hpResult.status === "fulfilled" ? hpResult.value : null;
  if (!gp && !hp) return null;
  const hpFlag = typeof obj(hp?.honeypotResult).isHoneypot === "boolean" ? obj(hp?.honeypotResult).isHoneypot as boolean : null;
  const sim = obj(hp?.simulationResult), buyTax = num(sim.buyTax), sellTax = num(sim.sellTax);
  const mint = gp ? boolFlag(gp.is_mintable) : null;
  const freeze = gp ? (boolFlag(gp.owner_change_balance) === true || boolFlag(gp.is_blacklisted) === true ? true :
    boolFlag(gp.owner_change_balance) === false && boolFlag(gp.is_blacklisted) === false ? false : null) : null;
  const holders = Array.isArray(gp?.lp_holders) ? gp.lp_holders as unknown[] : [];
  const lockedShare = holders.reduce((sum, holder) => {
    const h = obj(holder); return sum + (boolFlag(h.is_locked) === true ? (num(h.percent) ?? 0) : 0);
  }, 0);
  const lpLocked = gp && holders.length ? lockedShare >= 0.95 : null;
  const details: string[] = [];
  if (hpFlag === true) details.push("honeypot.is reports a honeypot");
  if (buyTax !== null && buyTax > 0.15) details.push("Buy tax exceeds 15%");
  if (sellTax !== null && sellTax > 0.15) details.push("Sell tax exceeds 15%");
  if (mint === true) details.push("Contract owner can mint tokens");
  if (freeze === true) details.push("Contract may freeze or blacklist holders");
  if (lpLocked === false) details.push("LP holder data does not show 95% locked liquidity");
  if (lpLocked === null) details.push("Liquidity-lock status could not be verified");
  return {
    honeypot: hpFlag, lpLocked, ownerCanMint: mint, ownerCanFreeze: freeze, buyTax, sellTax,
    verified: Boolean(gp && hp && hpFlag !== null && lpLocked !== null && mint !== null && freeze !== null && buyTax !== null && sellTax !== null),
    checkedAt: Date.now(), providers: [...(gp ? ["GoPlus"] : []), ...(hp ? ["honeypot.is"] : [])], details,
  };
}
export function scoreOpportunity(m: TokenMetrics, security: SecurityReport | null): OpportunitySignal {
  const flags: string[] = [], rationale: string[] = [];
  const liquidity = clamp(((m.liquidityUsd ?? 0) / 100_000) * 100);
  const volumeRatio = (m.marketCap ?? m.fdv ?? 0) > 0 ? (m.volume24h ?? 0) / (m.marketCap ?? m.fdv ?? 1) : 0;
  const momentum = clamp(50 + (m.priceChange24h ?? 0) * 0.35);
  const ageHours = m.pairCreatedAt ? Math.max(0, (Date.now() - m.pairCreatedAt) / 3_600_000) : null;
  const novelty = ageHours === null ? 25 : clamp(100 - ageHours * 1.5);
  let securityScore = security?.verified ? 100 : 20;
  if (security?.honeypot === true || security?.ownerCanMint === true || security?.ownerCanFreeze === true || security?.lpLocked === false) securityScore = 0;
  let score = 0.35 * liquidity + 0.25 * momentum + 0.2 * securityScore + 0.2 * novelty;
  if (volumeRatio > 0.5) { score += 8; flags.push("high-volume"); rationale.push("24h volume is high relative to market value"); }
  if ((m.priceChange24h ?? 0) > 150 && volumeRatio > 1) { score -= 25; flags.push("PUMP-RISK"); rationale.push("Extreme price acceleration with outsized volume"); }
  if ((m.liquidityUsd ?? 0) < 10_000) { flags.push("THIN-LIQUIDITY"); rationale.push("Liquidity is below $10k"); }
  if (!security) { flags.push("SECURITY-UNVERIFIED"); rationale.push("Security providers did not return a usable report"); }
  if (security?.honeypot === true) { flags.push("HONEYPOT"); rationale.push("Hard reject: honeypot detected"); }
  if (security?.lpLocked === false) { flags.push("LP-UNLOCKED"); rationale.push("Hard reject: locked liquidity not established"); }
  if (security?.ownerCanMint === true) { flags.push("MINT-AUTHORITY"); rationale.push("Hard reject: owner can mint"); }
  if (security?.ownerCanFreeze === true) { flags.push("FREEZE-AUTHORITY"); rationale.push("Hard reject: holders may be frozen"); }
  if ((security?.buyTax ?? 0) > 0.15 || (security?.sellTax ?? 0) > 0.15) { flags.push("HIGH-TAX"); rationale.push("Hard reject: trade tax exceeds 15%"); }
  if (m.pairCreatedAt && ageHours !== null && ageHours < 24) { flags.push("NEW-PAIR"); rationale.push("Pair is less than 24 hours old; volatility risk is elevated"); }
  if (liquidity >= 70) rationale.push("Liquidity depth is comparatively strong");
  if (momentum >= 65) rationale.push("24h momentum is positive");
  if (!rationale.length) rationale.push("Insufficient positive evidence; keep on watchlist");
  const hardReject = flags.some(f => ["HONEYPOT", "LP-UNLOCKED", "MINT-AUTHORITY", "FREEZE-AUTHORITY", "HIGH-TAX"].includes(f));
  const securityVerified = Boolean(security?.verified && security.honeypot === false && security.lpLocked === true &&
    security.ownerCanMint === false && security.ownerCanFreeze === false &&
    security.buyTax !== null && security.buyTax <= 0.15 && security.sellTax !== null && security.sellTax <= 0.15);
  const bounded = Math.round(clamp(score));
  return {
    id: `${m.chain}:${m.address.toLowerCase()}`, symbol: m.symbol, address: m.address, chain: m.chain,
    score: bounded, risk: bounded >= 65 && securityVerified ? "safe" : bounded >= 35 ? "caution" : "danger",
    flags: [...new Set(flags)], metrics: m, security, securityVerified,
    tradableInPaperMode: bounded >= 70 && securityVerified && !hardReject && (m.liquidityUsd ?? 0) >= 10_000,
    rationale,
  };
}
const status = (id: ProviderStatus["id"], label: string, state: ProviderStatus["state"], message: string): ProviderStatus =>
  ({ id, label, state, message, checkedAt: Date.now() });
export async function scanOpportunities(query = ""): Promise<ScanResult> {
  const q = query.trim(), providers: ProviderStatus[] = [];
  let metrics: TokenMetrics[] = [];
  try {
    metrics = q ? await dexSearch(q) : await dexTrending();
    providers.push(status("dexscreener", "DexScreener", "ok", `${metrics.length} token pairs loaded`));
  } catch (e) {
    providers.push(status("dexscreener", "DexScreener", "error", e instanceof Error ? e.message : "Request failed"));
  }
  const checked = await Promise.all(metrics.slice(0, 12).map(async m => {
    try { return [m, await verifySecurity(m)] as const; } catch { return [m, null] as const; }
  }));
  const opportunities = checked.map(([m, s]) => scoreOpportunity(m, s))
    .sort((a, b) => Number(b.tradableInPaperMode) - Number(a.tradableInPaperMode) || b.score - a.score);
  const verified = checked.filter(([, s]) => s?.verified).length;
  providers.push(status("goplus", "GoPlus Security", verified ? "ok" : "degraded", verified ? `${verified} candidate(s) passed combined checks` : "Complete security evidence unavailable"));
  providers.push(status("honeypot", "honeypot.is", verified ? "ok" : "degraded", "Missing results fail closed"));
  if (q) {
    try { const coins = await cgSearch(q); providers.push(status("coingecko", "CoinGecko", "ok", `${coins.length} search matches`)); }
    catch (e) { providers.push(status("coingecko", "CoinGecko", "degraded", e instanceof Error ? e.message : "Unavailable")); }
  } else providers.push(status("coingecko", "CoinGecko", "idle", "Optional asset enrichment"));
  providers.push(status("sec-edgar", "SEC EDGAR", "idle", "Best-effort filings adapter; not token-security evidence"));
  return { opportunities, providers, scannedAt: Date.now(), query: q };
}
