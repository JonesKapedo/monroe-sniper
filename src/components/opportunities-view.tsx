import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw, Search, ShieldCheck, ShieldX, Zap } from "lucide-react";
import { Button, Card, Label } from "@/components/ui";
import { scanOpportunities, type OpportunitySignal, type ProviderStatus, type ScanResult } from "@/lib/data/market-sources";
import { cn } from "@/lib/cn";

const money = (n: number | null) => n == null ? "—" : n.toLocaleString("en-US", {
  style: "currency", currency: "USD", notation: n >= 1_000_000 ? "compact" : "standard",
  maximumFractionDigits: n < 1 ? 8 : 2,
});
const pct = (n: number | null) => n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

export function OpportunitiesView() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<OpportunitySignal | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("monroe-watchlist-v1") ?? "[]") as string[]; }
    catch { return []; }
  });
  const scan = useCallback(async (term: string) => {
    setLoading(true); setError("");
    try {
      const next = await scanOpportunities(term);
      setResult(next);
      setSelected(old => old ? next.opportunities.find(x => x.id === old.id) ?? null : null);
    } catch (e) { setError(e instanceof Error ? e.message : "Market scan failed"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void scan(""); }, [scan]);

  const toggleWatch = (id: string) => setWatchlist(old => {
    const next = old.includes(id) ? old.filter(x => x !== id) : [...old, id];
    try { localStorage.setItem("monroe-watchlist-v1", JSON.stringify(next)); } catch { /* private browsing */ }
    return next;
  });
  const items = result?.opportunities ?? [];
  return <div className="mx-auto flex max-w-7xl flex-col gap-5">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><p className="text-xs tracking-[0.24em] text-brass uppercase">Market intelligence / public feeds</p>
        <h1 className="mt-2 text-3xl font-medium md:text-4xl">Opportunity scanner</h1>
        <p className="mt-2 max-w-2xl text-sm text-faint">Discover token pairs, normalize market data, and inspect security evidence before a candidate reaches the paper gate.</p>
      </div>
      <Button onClick={() => void scan(query)} disabled={loading}><RefreshCw className={cn("size-4", loading && "animate-spin")} />{loading ? "Scanning…" : "Refresh scan"}</Button>
    </div>
    <Card>
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={e => { e.preventDefault(); void scan(query); }}>
        <label className="relative flex-1"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input className="field pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Token name, ticker, or contract address…" aria-label="Search token markets" />
        </label>
        <Button type="submit" disabled={loading || !query.trim()}><Search className="size-4" />Search</Button>
        {query && <Button type="button" variant="ghost" onClick={() => { setQuery(""); void scan(""); }}>Trending</Button>}
      </form>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Candidates" value={String(items.length)} />
        <Metric label="Security verified" value={String(items.filter(x => x.securityVerified).length)} />
        <Metric label="Paper gate passed" value={String(items.filter(x => x.tradableInPaperMode).length)} />
        <Metric label="Danger flagged" value={String(items.filter(x => x.risk === "danger").length)} />
      </div>
    </Card>
    <Card>
      <div className="flex items-center justify-between gap-3"><Label>Provider health</Label><span className="text-xs text-faint">{result ? new Date(result.scannedAt).toLocaleTimeString() : "Waiting for first scan"}</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{(result?.providers ?? skeleton).map(x => <Provider key={x.id} item={x} />)}</div>
      <p className="mt-3 text-xs text-faint">Public APIs may throttle or block browser requests. Missing security evidence is unverified, never safe.</p>
    </Card>
    {error && <div role="alert" className="rounded-xl border border-loss/40 bg-loss/10 p-4 text-sm text-loss">{error}</div>}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-3"><Label>{query ? `Results for “${query}”` : "Latest token profiles"}</Label><span className="text-xs text-faint">Score ≥ 70 + security gates</span></div>
        {loading && !result && <Card><p className="text-sm text-faint">Connecting to public market feeds…</p></Card>}
        {!loading && !items.length && !error && <Card><p className="font-medium">No candidates returned</p><p className="mt-1 text-sm text-faint">The provider may be throttling requests. Try a contract address or refresh shortly.</p></Card>}
        {items.map(item => <article key={item.id} className={cn("rounded-xl border bg-panel p-4", selected?.id === item.id ? "border-brass" : "border-line")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(item)} type="button">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{item.symbol}</span><span className="rounded-md border border-line px-2 py-0.5 text-xs text-faint">{item.chain}</span><span className={cn("rounded-md px-2 py-0.5 text-xs uppercase", item.risk === "safe" ? "bg-gain/10 text-gain" : item.risk === "danger" ? "bg-loss/10 text-loss" : "bg-brass/10 text-brass")}>{item.risk}</span></div>
              <p className="mt-1 truncate text-xs text-faint">{item.metrics.name} · {short(item.address)}</p>
            </button>
            <div className="flex items-center justify-between gap-4 sm:justify-end"><div className="text-right"><p className={cn("font-mono text-xl", item.risk === "safe" ? "text-gain" : item.risk === "danger" ? "text-loss" : "text-brass")}>{item.score}<span className="text-xs text-faint">/100</span></p><p className="text-[10px] text-faint">composite score</p></div>
              <button type="button" onClick={() => toggleWatch(item.id)} aria-pressed={watchlist.includes(item.id)} className={cn("min-h-10 rounded-lg border px-3 text-xs", watchlist.includes(item.id) ? "border-brass text-brass" : "border-line text-faint")}>{watchlist.includes(item.id) ? "Watching" : "Watch"}</button>
            </div>
          </div>
          <button type="button" onClick={() => setSelected(item)} className="mt-4 grid w-full grid-cols-2 gap-3 text-left md:grid-cols-4">
            <Mini label="Price" value={money(item.metrics.priceUsd)} /><Mini label="Liquidity" value={money(item.metrics.liquidityUsd)} /><Mini label="24h volume" value={money(item.metrics.volume24h)} /><Mini label="24h move" value={pct(item.metrics.priceChange24h)} />
          </button>
          <div className="mt-3 flex flex-wrap gap-2">{item.flags.slice(0, 5).map(flag => <span key={flag} className="rounded-md border border-line px-2 py-1 text-[11px] text-faint">{flag}</span>)}</div>
          <div className="mt-3 flex items-center gap-2 text-xs">{item.securityVerified ? <ShieldCheck className="size-4 text-gain" /> : <ShieldX className="size-4 text-loss" />}<span className={item.securityVerified ? "text-gain" : "text-loss"}>{item.securityVerified ? "Security verified" : "Security unverified — blocked"}</span>{item.tradableInPaperMode ? <span className="ml-auto text-gain"><Zap className="mr-1 inline size-3" />Gate passed</span> : <span className="ml-auto text-faint">No order submitted</span>}</div>
        </article>)}
      </div>
      <div className="flex flex-col gap-4 xl:sticky xl:top-24">
        <Card><Label>Decision trace</Label>{selected ? <div className="mt-3">
          <div className="flex items-start justify-between gap-2"><div><p className="text-lg font-medium">{selected.symbol}</p><p className="text-xs text-faint">{selected.chain} · {short(selected.address)}</p></div><p className="font-mono text-xl">{selected.score}/100</p></div>
          <div className="mt-4 rounded-lg border border-line p-3"><p className="text-xs text-faint">Paper gate</p><p className={cn("mt-1 font-medium", selected.tradableInPaperMode ? "text-gain" : "text-loss")}>{selected.tradableInPaperMode ? "Eligible for paper mode" : "BLOCKED — gates not satisfied"}</p><p className="mt-1 text-xs text-faint">Eligibility is informational; this scanner does not submit orders.</p></div>
          <div className="mt-4 flex flex-col gap-3"><Trace label="Liquidity · 35%" value={money(selected.metrics.liquidityUsd)} /><Trace label="Momentum · 25%" value={pct(selected.metrics.priceChange24h)} /><Trace label="Security · 20%" value={selected.securityVerified ? "Verified clean" : "Unverified / failed"} /><Trace label="Novelty · 20%" value={selected.metrics.pairCreatedAt ? age(selected.metrics.pairCreatedAt) : "Unknown pair age"} /></div>
          <p className="mt-4 text-xs tracking-wide text-faint uppercase">Rationale</p><ul className="mt-2 flex flex-col gap-2">{selected.rationale.map(line => <li key={line} className="flex gap-2 text-sm"><span className="text-brass">•</span>{line}</li>)}</ul>
          {selected.security?.details.length ? <div className="mt-4 rounded-lg border border-line p-3"><p className="text-xs text-faint">Security findings</p><ul className="mt-2 flex flex-col gap-2">{selected.security.details.map(line => <li key={line} className="text-sm">{line}</li>)}</ul></div> : null}
          {selected.metrics.url && <a className="mt-4 inline-flex items-center gap-2 text-sm text-brass hover:underline" href={selected.metrics.url} target="_blank" rel="noreferrer">Open pair on DexScreener <ExternalLink className="size-3" /></a>}
        </div> : <p className="mt-3 text-sm text-faint">Select a candidate to inspect its score, evidence, and hard gates.</p>}</Card>
        <Card><Label>Operator rules</Label><ul className="mt-3 flex flex-col gap-3 text-sm text-faint">
          <li className="flex gap-2"><ShieldX className="mt-0.5 size-4 shrink-0 text-loss" />Honeypot, mint/freeze authority, excessive tax, or unlocked LP blocks eligibility.</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-gain" />Security must be fresh and independently checked; missing data is not safe.</li>
          <li className="flex gap-2"><Zap className="mt-0.5 size-4 shrink-0 text-brass" />A score of 70 is necessary, never sufficient.</li>
          <li className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-brass" />Heuristics are indicators, not guarantees or investment advice.</li>
        </ul></Card>
      </div>
    </div>
  </div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-line p-3"><p className="text-xs text-faint">{label}</p><p className="mt-1 font-mono text-xl">{value}</p></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-lg bg-ink/60 p-2"><p className="text-[11px] text-faint">{label}</p><p className="mt-1 truncate font-mono text-sm">{value}</p></div>; }
function Trace({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-faint">{label}</span><span className="text-right font-mono">{value}</span></div>; }
function Provider({ item }: { item: ProviderStatus }) { const color = item.state === "ok" ? "text-gain" : item.state === "error" ? "text-loss" : item.state === "degraded" ? "text-brass" : "text-faint"; return <div className="rounded-lg border border-line p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{item.label}</p><span className={cn("size-2 rounded-full", item.state === "ok" ? "bg-gain" : item.state === "error" ? "bg-loss" : "bg-brass")} /></div><p className={cn("mt-1 text-xs", color)}>{item.state.toUpperCase()}</p><p className="mt-1 text-xs text-faint">{item.message}</p></div>; }
function short(address: string) { return address.length > 15 ? `${address.slice(0, 7)}…${address.slice(-5)}` : address; }
function age(ts: number) { const h = Math.max(0, (Date.now() - ts) / 3_600_000); return h < 24 ? `${h.toFixed(1)}h old` : `${(h / 24).toFixed(1)}d old`; }
const skeleton: ProviderStatus[] = [
  { id: "dexscreener", label: "DexScreener", state: "idle", message: "Waiting for scan", checkedAt: null },
  { id: "coingecko", label: "CoinGecko", state: "idle", message: "Optional asset enrichment", checkedAt: null },
  { id: "goplus", label: "GoPlus Security", state: "idle", message: "Waiting for checks", checkedAt: null },
  { id: "honeypot", label: "honeypot.is", state: "idle", message: "Waiting for checks", checkedAt: null },
  { id: "sec-edgar", label: "SEC EDGAR", state: "idle", message: "Best-effort filings enrichment", checkedAt: null },
];
