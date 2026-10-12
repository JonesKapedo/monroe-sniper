import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight, CheckCircle2, Clock3, ExternalLink,
  RefreshCw, Search, ShieldCheck, ShieldX, TrendingUp, Wallet, XCircle, Zap,
} from "lucide-react";
import { Button, Card, Label } from "@/components/ui";
import {
  dexToken, scanOpportunities, type OpportunitySignal, type ProviderStatus, type ScanResult,
} from "@/lib/data/market-sources";
import {
  applyPaperMarketUpdates, auditScan, closePaperPosition, createPaperPortfolio,
  enterPaperPosition, evaluateRiskGate, gateStatusText, paperEquityUsd, paperExposureUsd,
  PAPER_STARTING_CASH, resetPaperPortfolio, type MarketUpdate, type PaperPortfolio, type PaperPosition,
} from "@/lib/data/paper-risk";
import { cn } from "@/lib/cn";

const PAPER_STORAGE_KEY = "monroe-paper-portfolio-v1";
const money = (n: number | null) => n == null ? "—" : n.toLocaleString("en-US", {
  style: "currency", currency: "USD", notation: Math.abs(n) >= 1_000_000 ? "compact" : "standard",
  maximumFractionDigits: Math.abs(n) < 1 ? 8 : 2,
});
const pct = (n: number | null) => n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
const ageText = (ms: number) => ms < 60_000 ? `${Math.max(0, Math.round(ms / 1000))}s ago` : `${Math.round(ms / 60_000)}m ago`;

function loadPaperPortfolio(): PaperPortfolio {
  if (typeof window === "undefined") return createPaperPortfolio();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PAPER_STORAGE_KEY) ?? "null") as Partial<PaperPortfolio> | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.positions) || !Array.isArray(parsed.trades) || !Array.isArray(parsed.decisions)) {
      return createPaperPortfolio();
    }
    const cashUsd = typeof parsed.cashUsd === "number" && Number.isFinite(parsed.cashUsd) ? Math.max(0, parsed.cashUsd) : 500;
    return { version: 1, cashUsd, positions: parsed.positions as PaperPosition[], trades: parsed.trades, decisions: parsed.decisions };
  } catch {
    return createPaperPortfolio();
  }
}
function persistPaperPortfolio(book: PaperPortfolio): void {
  try { if (typeof window !== "undefined") window.localStorage.setItem(PAPER_STORAGE_KEY, JSON.stringify(book)); }
  catch { /* Private browsing or a full storage quota must not break the desk. */ }
}
function short(address: string) { return address.length > 15 ? `${address.slice(0, 7)}…${address.slice(-5)}` : address; }
function tokenKey(chain: string, address: string) { return `${chain}:${address.toLowerCase()}`; }

export function OpportunitiesView() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<OpportunitySignal | null>(null);
  const [lastNotice, setLastNotice] = useState("");
  const [portfolio, setPortfolio] = useState<PaperPortfolio>(createPaperPortfolio);
  useEffect(() => {
    setPortfolio(loadPaperPortfolio());
  }, []);
  const positionsRef = useRef(portfolio.positions);
  useEffect(() => { positionsRef.current = portfolio.positions; }, [portfolio.positions]);
  useEffect(() => { persistPaperPortfolio(portfolio); }, [portfolio]);

  const scan = useCallback(async (term: string) => {
    setLoading(true);
    setError("");
    try {
      const next = await scanOpportunities(term);
      const at = Date.now();
      setResult(next);
      setSelected(current => current ? next.opportunities.find(item => item.id === current.id) ?? null : next.opportunities[0] ?? null);
      setPortfolio(old => {
        const updated = applyPaperMarketUpdates(old, next.opportunities.map(item => ({
          tokenId: item.id, priceUsd: item.metrics.priceUsd, liquidityUsd: item.metrics.liquidityUsd,
          fetchedAt: item.metrics.fetchedAt,
        })), at);
        return auditScan(updated, next.opportunities, at);
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Market scan failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void scan(""); }, [scan]);

  // While this page is open, held tokens are independently refreshed even when
  // they fall outside the latest trending/search results. This also advances
  // the six-hour time stop if a provider is momentarily unavailable.
  useEffect(() => {
    let cancelled = false;
    const refreshPositions = async () => {
      const held = positionsRef.current;
      const quoteResults = await Promise.all(held.map(async position => {
        try {
          const pairs = await dexToken(position.chain, position.address);
          // Do not fall back to the pair's base token: the requested asset can
          // appear as the quote token, and marking it with the other asset's
          // price would corrupt the paper ledger.
          const preferred = pairs.find(pair => tokenKey(pair.chain, pair.address) === position.tokenId);
          if (!preferred) return null;
          const update: MarketUpdate = {
            tokenId: position.tokenId, priceUsd: preferred.priceUsd,
            liquidityUsd: preferred.liquidityUsd, fetchedAt: Date.now(),
          };
          return update;
        } catch { return null; }
      }));
      const updates: MarketUpdate[] = [];
      for (const row of quoteResults) if (row !== null) updates.push(row);
      if (cancelled) return;
      setPortfolio(old => applyPaperMarketUpdates(old, updates, Date.now()));
    };
    const timer = window.setInterval(() => { void refreshPositions(); }, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("monroe-watchlist-v1") ?? "[]") as string[]; }
    catch { return []; }
  });

  const toggleWatch = (id: string) => {
    setWatchlist(old => {
      const next = old.includes(id) ? old.filter(value => value !== id) : [...old, id];
      try { window.localStorage.setItem("monroe-watchlist-v1", JSON.stringify(next)); } catch { /* optional preference */ }
      return next;
    });
  };

  const items = result?.opportunities ?? [];
  const equity = paperEquityUsd(portfolio);
  const exposure = paperExposureUsd(portfolio);
  const totalPnl = equity - PAPER_STARTING_CASH;
  const realizedPnl = portfolio.trades.reduce((sum, trade) => sum + trade.pnlUsd, 0);
  const unrealizedPnl = portfolio.positions.reduce((sum, position) => sum + (position.currentPrice - position.entryPrice) * position.qty, 0);
  const selectedVerdict = useMemo(
    () => selected ? evaluateRiskGate(selected, portfolio, Date.now()) : null,
    [selected, portfolio],
  );

  const executePaper = () => {
    if (!selected) return;
    const execution = enterPaperPosition(portfolio, selected, Date.now());
    setPortfolio(execution.portfolio);
    setLastNotice(execution.entered
      ? `PAPER FILL · ${selected.symbol} opened for ${money(execution.verdict.plannedNotionalUsd)}. No live order was sent.`
      : gateStatusText(execution.verdict));
  };
  const closePaper = (position: PaperPosition) => {
    setPortfolio(old => closePaperPosition(old, position.id, Date.now()));
    setLastNotice(`PAPER CLOSE · ${position.symbol} marked and closed at ${money(position.currentPrice)}.`);
  };
  const resetPaper = () => {
    if (!window.confirm(`Reset the paper portfolio to $${PAPER_STARTING_CASH.toLocaleString("en-US")}? This clears open positions and paper trade history.`)) return;
    setPortfolio(resetPaperPortfolio());
    setLastNotice(`Paper portfolio reset to $${PAPER_STARTING_CASH.toLocaleString("en-US")}. No live funds are involved.`);
  };

  return <div className="mx-auto flex max-w-7xl flex-col gap-5">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs tracking-[0.24em] text-brass uppercase">Market intelligence / public feeds</p>
          <span className="inline-flex items-center gap-1 rounded-md border border-gain/40 px-2 py-1 text-[10px] tracking-wide text-gain"><span className="size-1.5 rounded-full bg-gain" />PAPER ONLY</span>
        </div>
        <h1 className="mt-2 text-3xl font-medium md:text-4xl">Opportunity scanner</h1>
        <p className="mt-2 max-w-2xl text-sm text-faint">Scan real public token-pair data, inspect every risk gate, and simulate entries and exits in an isolated paper book.</p>
      </div>
      <Button onClick={() => void scan(query)} disabled={loading}>
        <RefreshCw className={cn("size-4", loading && "animate-spin")} />{loading ? "Scanning feeds…" : "Refresh scan"}
      </Button>
    </div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <PortfolioMetric label="Paper equity" value={money(equity)} detail={`${totalPnl >= 0 ? "+" : ""}${money(totalPnl)} total P&L`} positive={totalPnl >= 0} icon="equity" />
      <PortfolioMetric label="Available paper cash" value={money(portfolio.cashUsd)} detail="USD simulator ledger" icon="cash" />
      <PortfolioMetric label="Open risk" value={money(exposure)} detail={`${equity > 0 ? (exposure / equity * 100).toFixed(1) : "0.0"}% of equity · max 15%`} icon="risk" />
      <PortfolioMetric label="Open positions" value={`${portfolio.positions.length}/3`} detail={`Realized ${money(realizedPnl)} · Unrealized ${money(unrealizedPnl)}`} icon="positions" positive={realizedPnl + unrealizedPnl >= 0} />
    </div>

    <Card>
      <div className="flex flex-col gap-3 sm:flex-row" role="search">
        <form className="flex min-w-0 flex-1 gap-3" onSubmit={event => { event.preventDefault(); if (query.trim()) void scan(query.trim()); }}>
          <label className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <input className="field pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="Token name, ticker, or contract address…" aria-label="Search token markets" />
          </label>
          <Button type="submit" disabled={loading || !query.trim()}><Search className="size-4" />Search</Button>
        </form>
        {query && <Button type="button" variant="ghost" onClick={() => { setQuery(""); void scan(""); }}>Trending</Button>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Candidates" value={String(items.length)} />
        <Metric label="Security verified" value={String(items.filter(item => item.securityVerified).length)} />
        <Metric label="Paper gate passed" value={String(items.filter(item => evaluateRiskGate(item, portfolio).allowed).length)} />
        <Metric label="Danger flagged" value={String(items.filter(item => item.risk === "danger").length)} />
      </div>
    </Card>

    <Card>
      <div className="flex items-center justify-between gap-3"><Label>Provider health</Label><span className="text-xs text-faint">{result ? `Updated ${new Date(result.scannedAt).toLocaleTimeString()}` : "Waiting for first scan"}</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{(result?.providers ?? skeleton).map(source => <Provider key={source.id} item={source} />)}</div>
      <p className="mt-3 text-xs text-faint">Public endpoints can throttle or block browser requests. Missing or incomplete security evidence always blocks paper entry.</p>
    </Card>

    {error && <div role="alert" className="rounded-xl border border-loss/40 bg-loss/10 p-4 text-sm text-loss">{error}</div>}
    {lastNotice && <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-line bg-panel-2 p-3 text-sm"><span>{lastNotice}</span><button type="button" className="text-faint hover:text-cream" onClick={() => setLastNotice("")} aria-label="Dismiss notice"><XCircle className="size-4" /></button></div>}

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-3"><Label>{query ? `Results for “${query}”` : "Latest token profiles"}</Label><span className="text-xs text-faint">Score ≥ 70 + every hard gate</span></div>
        {loading && !result && <Card><p className="text-sm text-faint">Connecting to public market feeds…</p></Card>}
        {!loading && !items.length && !error && <Card><p className="font-medium">No candidates returned</p><p className="mt-1 text-sm text-faint">The provider may be throttling requests. Try a contract address or refresh shortly.</p></Card>}
        {items.map(item => <OpportunityCard
          key={item.id} item={item} selected={selected?.id === item.id} watched={watchlist.includes(item.id)}
          verdict={evaluateRiskGate(item, portfolio)}
          onSelect={() => setSelected(item)} onWatch={() => toggleWatch(item.id)}
        />)}
      </div>

      <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-24">
        <Card>
          <div className="flex items-center justify-between gap-2"><Label>Risk verdict & paper order</Label><ShieldCheck className="size-4 text-brass" /></div>
          {selected && selectedVerdict ? <div className="mt-3">
            <div className="flex items-start justify-between gap-2">
              <div><p className="text-lg font-medium">{selected.symbol}</p><p className="text-xs text-faint">{selected.chain} · {short(selected.address)}</p></div>
              <Score score={selected.score} risk={selected.risk} />
            </div>
            <div className={cn("mt-4 rounded-lg border p-3", selectedVerdict.allowed ? "border-gain/40 bg-gain/5" : "border-loss/40 bg-loss/5")}>
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide">{selectedVerdict.allowed ? <CheckCircle2 className="size-4 text-gain" /> : <ShieldX className="size-4 text-loss" />}{selectedVerdict.allowed ? "Risk gates passed" : "ENTRY BLOCKED"}</p>
              <p className="mt-1 text-sm">{selectedVerdict.allowed ? "Eligible for paper execution only." : `${selectedVerdict.checks.filter(check => !check.pass).length} gate(s) need to pass before an entry is permitted.`}</p>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {selectedVerdict.checks.map(check => <div key={check.id} className="flex items-start gap-2">
                {check.pass ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gain" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-loss" />}
                <div className="min-w-0"><p className="text-sm">{check.label}</p><p className="text-xs text-faint">{check.detail}</p></div>
              </div>)}
            </div>
            <div className="mt-4 rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="text-faint">Proposed paper notional</span><span className="font-mono">{money(selectedVerdict.plannedNotionalUsd)}</span></div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm"><span className="text-faint">Stop loss</span><span className="font-mono">{selected.metrics.priceUsd ? money(selected.metrics.priceUsd * 0.92) : "—"} (−8%)</span></div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm"><span className="text-faint">First scale-out</span><span className="font-mono">{selected.metrics.priceUsd ? money(selected.metrics.priceUsd * 1.2) : "—"} (+20%)</span></div>
            </div>
            <Button className="mt-4 w-full" disabled={!selectedVerdict.allowed || loading} onClick={executePaper}><Zap className="size-4" />Simulate paper entry</Button>
            <p className="mt-2 text-center text-xs text-faint">No wallet connection, live order, or real money is used.</p>
            <div className="mt-4">
              <p className="text-xs tracking-wide text-faint uppercase">Signal rationale</p>
              <ul className="mt-2 flex flex-col gap-2">{selected.rationale.map(line => <li key={line} className="flex gap-2 text-sm"><span className="text-brass">•</span>{line}</li>)}</ul>
            </div>
            {selected.security?.details.length ? <div className="mt-4 rounded-lg border border-line p-3"><p className="text-xs text-faint">Security findings</p><ul className="mt-2 flex flex-col gap-2">{selected.security.details.map(line => <li key={line} className="text-sm">{line}</li>)}</ul></div> : null}
            {selected.metrics.url && <a className="mt-4 inline-flex items-center gap-2 text-sm text-brass hover:underline" href={selected.metrics.url} target="_blank" rel="noreferrer">Open pair on DexScreener <ExternalLink className="size-3" /></a>}
          </div> : <p className="mt-3 text-sm text-faint">Select a candidate to see its full risk verdict. A blocked verdict cannot be overridden in this prototype.</p>}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2"><Label>Paper positions</Label><span className="text-xs text-faint">Auto-marked ~30s</span></div>
          {portfolio.positions.length ? <div className="mt-3 flex flex-col gap-3">
            {portfolio.positions.map(position => <PositionCard key={position.id} position={position} onClose={() => closePaper(position)} />)}
          </div> : <div className="mt-3 rounded-lg border border-dashed border-line p-4"><Wallet className="size-5 text-faint" /><p className="mt-2 text-sm">No open paper positions.</p><p className="mt-1 text-xs text-faint">Only candidates passing every risk gate can open a position.</p></div>}
          <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-faint">Paper history · {portfolio.trades.length} fills</span><button type="button" onClick={resetPaper} className="text-xs text-loss hover:underline">Reset paper book</button></div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2"><Label>Risk audit trail</Label><span className="text-xs text-faint">Newest first</span></div>
          {portfolio.decisions.length ? <div className="mt-3 flex flex-col divide-y divide-line">
            {portfolio.decisions.slice(0, 6).map(decision => {
              const failed = decision.checks.filter(check => !check.pass);
              return <div key={decision.id} className="py-3 first:pt-0">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{decision.symbol} <span className="font-mono text-xs text-faint">{decision.score}/100</span></p><span className={cn("text-[10px] tracking-wide", decision.allowed ? "text-gain" : "text-loss")}>{decision.allowed ? "PASS" : "BLOCKED"}</span></div>
                <p className="mt-1 text-xs text-faint">{new Date(decision.decidedAt).toLocaleTimeString()} · {decision.allowed ? `Notional ${money(decision.plannedNotionalUsd)}` : failed.slice(0, 2).map(check => check.label).join(" · ")}</p>
              </div>;
            })}
          </div> : <p className="mt-3 text-sm text-faint">Risk verdicts will appear as candidates are scanned.</p>}
        </Card>
      </div>
    </div>

    <Card>
      <Label>Execution discipline · guide-aligned paper simulation</Label>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Rule title="Position budget" body="At most 5% of equity per idea, no more than three open positions or 15% aggregate initial exposure." />
        <Rule title="Hard stop" body="Close the remaining position if price falls 8% below entry." />
        <Rule title="Scale-out + trail" body="Sell half at +20%; trail the remainder 10% below its highest observed price." />
        <Rule title="Time & liquidity guard" body="Close after six hours or when observed pool liquidity falls more than 30% from its peak." />
      </div>
      <p className="mt-4 text-xs text-faint">This is an auditable prototype, not investment advice. Security providers may be incomplete or inaccurate; no scanner can guarantee that a token is safe.</p>
    </Card>
  </div>;
}

function PortfolioMetric({ label, value, detail, icon, positive }: { label: string; value: string; detail: string; icon: "equity" | "cash" | "risk" | "positions"; positive?: boolean }) {
  const Icon = icon === "equity" ? TrendingUp : icon === "cash" ? Wallet : icon === "risk" ? ShieldCheck : Clock3;
  return <Card className="min-w-0"><div className="flex items-start justify-between gap-2"><Label>{label}</Label><Icon className="size-4 shrink-0 text-brass" /></div><p className="mt-3 truncate font-mono text-xl md:text-2xl">{value}</p><p className={cn("mt-1 text-xs", positive === undefined ? "text-faint" : positive ? "text-gain" : "text-loss")}>{detail}</p></Card>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-line p-3"><p className="text-xs text-faint">{label}</p><p className="mt-1 font-mono text-xl">{value}</p></div>;
}
function Provider({ item }: { item: ProviderStatus }) {
  const color = item.state === "ok" ? "text-gain" : item.state === "error" ? "text-loss" : item.state === "degraded" ? "text-brass" : "text-faint";
  return <div className="rounded-lg border border-line p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{item.label}</p><span className={cn("size-2 rounded-full", item.state === "ok" ? "bg-gain" : item.state === "error" ? "bg-loss" : "bg-brass")} /></div><p className={cn("mt-1 text-xs", color)}>{item.state.toUpperCase()}</p><p className="mt-1 text-xs text-faint">{item.message}</p></div>;
}
function OpportunityCard({ item, selected, watched, verdict, onSelect, onWatch }: { item: OpportunitySignal; selected: boolean; watched: boolean; verdict: ReturnType<typeof evaluateRiskGate>; onSelect: () => void; onWatch: () => void }) {
  const move = item.metrics.priceChange24h;
  return <article className={cn("rounded-xl border bg-panel p-4 transition", selected ? "border-brass" : "border-line hover:border-brass/60")}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <button className="min-w-0 flex-1 text-left" onClick={onSelect} type="button">
        <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{item.symbol}</span><span className="rounded-md border border-line px-2 py-0.5 text-xs text-faint">{item.chain}</span><span className={cn("rounded-md px-2 py-0.5 text-xs uppercase", item.risk === "safe" ? "bg-gain/10 text-gain" : item.risk === "danger" ? "bg-loss/10 text-loss" : "bg-brass/10 text-brass")}>{item.risk}</span></div>
        <p className="mt-1 truncate text-xs text-faint">{item.metrics.name} · {short(item.address)}</p>
      </button>
      <div className="flex items-center justify-between gap-4 sm:justify-end"><Score score={item.score} risk={item.risk} />
        <button type="button" onClick={onWatch} aria-pressed={watched} className={cn("min-h-10 rounded-lg border px-3 text-xs", watched ? "border-brass text-brass" : "border-line text-faint")}>{watched ? "Watching" : "Watch"}</button>
      </div>
    </div>
    <button type="button" onClick={onSelect} className="mt-4 grid w-full grid-cols-2 gap-3 text-left md:grid-cols-4">
      <Mini label="Price" value={money(item.metrics.priceUsd)} />
      <Mini label="Liquidity" value={money(item.metrics.liquidityUsd)} />
      <Mini label="24h volume" value={money(item.metrics.volume24h)} />
      <Mini label="24h move" value={pct(move)} />
    </button>
    <div className="mt-3 flex flex-wrap gap-2">{item.flags.slice(0, 5).map(flag => <span key={flag} className="rounded-md border border-line px-2 py-1 text-[11px] text-faint">{flag}</span>)}</div>
    <div className="mt-3 flex items-center gap-2 text-xs">
      {verdict.allowed ? <CheckCircle2 className="size-4 text-gain" /> : <ShieldX className="size-4 text-loss" />}
      <span className={verdict.allowed ? "text-gain" : "text-loss"}>{verdict.allowed ? "All risk gates pass" : `${verdict.checks.filter(check => !check.pass).length} gate(s) blocking`}</span>
      <span className="ml-auto text-faint">{verdict.allowed ? "Paper only" : "No entry"}</span>
    </div>
  </article>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg bg-ink/60 p-2"><p className="text-[11px] text-faint">{label}</p><p className="mt-1 truncate font-mono text-sm">{value}</p></div>;
}
function Score({ score, risk }: { score: number; risk: string }) {
  return <div className="text-right"><p className={cn("font-mono text-xl", risk === "safe" ? "text-gain" : risk === "danger" ? "text-loss" : "text-brass")}>{score}<span className="text-xs text-faint">/100</span></p><p className="text-[10px] text-faint">composite score</p></div>;
}
function PositionCard({ position, onClose }: { position: PaperPosition; onClose: () => void }) {
  const change = (position.currentPrice / position.entryPrice - 1) * 100;
  const openedFor = Math.max(0, Date.now() - position.openedAt);
  const pnl = (position.currentPrice - position.entryPrice) * position.qty + position.realizedPnlUsd;
  return <div className="rounded-lg border border-line p-3">
    <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{position.symbol}</p><p className="text-xs text-faint">{position.chain} · {short(position.address)}</p></div><button type="button" onClick={onClose} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 text-xs text-faint hover:text-cream" aria-label={`Close ${position.symbol} paper position`}><XCircle className="size-3" />Close</button></div>
    <div className="mt-3 grid grid-cols-2 gap-3"><Mini label="Mark / entry" value={`${money(position.currentPrice)} / ${money(position.entryPrice)}`} /><Mini label="Unrealized + realized" value={money(pnl)} /></div>
    <div className="mt-3 flex items-center justify-between gap-2 text-xs"><span className={change >= 0 ? "text-gain" : "text-loss"}>{pct(change)} price move</span><span className="text-faint">{ageText(openedFor)} open</span></div>
    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-faint"><span className="rounded-md border border-line px-2 py-1">Stop {money(position.stopPrice)}</span><span className="rounded-md border border-line px-2 py-1">Scale {position.scaledOut ? "done" : money(position.scaleOutPrice)}</span><span className="rounded-md border border-line px-2 py-1">Trail {position.scaledOut ? money(position.highWaterPrice * 0.9) : "activates after scale"}</span></div>
  </div>;
}
function Rule({ title, body }: { title: string; body: string }) {
  return <div className="rounded-lg border border-line p-3"><p className="flex items-center gap-2 text-sm font-medium"><ArrowDownRight className="size-4 text-brass" />{title}</p><p className="mt-2 text-xs leading-relaxed text-faint">{body}</p></div>;
}
const skeleton: ProviderStatus[] = [
  { id: "dexscreener", label: "DexScreener", state: "idle", message: "Waiting for scan", checkedAt: null },
  { id: "coingecko", label: "CoinGecko", state: "idle", message: "Optional asset enrichment", checkedAt: null },
  { id: "goplus", label: "GoPlus Security", state: "idle", message: "Waiting for checks", checkedAt: null },
  { id: "honeypot", label: "honeypot.is", state: "idle", message: "Waiting for checks", checkedAt: null },
  { id: "sec-edgar", label: "SEC EDGAR", state: "idle", message: "Best-effort filings enrichment", checkedAt: null },
];
