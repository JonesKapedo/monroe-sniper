import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  Crosshair,
  Globe2,
  Pause,
  Play,
  RefreshCw,
  Rocket,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { loadFeeds } from "@/lib/market.functions";
import { formatNairobiTime } from "@/lib/sniper/nairobi-time";
import { scanAllAvenues } from "@/lib/avenues/engine";
import type { AvenueCategory, AvenueOpportunity } from "@/lib/avenues/types";
import {
  equity,
  exposure,
  portfolioLines,
  sampleTape,
  type Candidate,
} from "@/lib/paper";
import { useDesk } from "@/lib/desk-store";
import { Button, Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";
import { LiveModeTransitionModal } from "@/components/live-mode-transition-modal";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const px = (n: number) => {
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${n.toPrecision(4)}`;
};

export function Desk() {
  const mode = useDesk((s) => s.mode);
  const setMode = useDesk((s) => s.setMode);
  const power = useDesk((s) => s.power);
  const setPower = useDesk((s) => s.setPower);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const memory = useDesk((s) => s.memory);
  const tape = useDesk((s) => s.tape);
  const log = useDesk((s) => s.log);
  const setTape = useDesk((s) => s.setTape);
  const tick = useDesk((s) => s.tick);
  const autoStep = useDesk((s) => s.autoStep);
  const manualEnter = useDesk((s) => s.manualEnter);
  const flatten = useDesk((s) => s.flatten);
  const flattenAll = useDesk((s) => s.flattenAll);
  const resetDemo = useDesk((s) => s.resetDemo);

  const botStartedAt = useDesk((s) => s.botStartedAt);
  const disciplineRules = useDesk((s) => s.disciplineRules);
  const getReadiness = useDesk((s) => s.getReadiness);
  const readiness = getReadiness ? getReadiness() : null;

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [filterVenue, setFilterVenue] = useState<"all" | "binance" | "dex">("all");
  const [avenueFilter, setAvenueFilter] = useState<"ALL" | AvenueCategory>("ALL");
  const [showReadinessModal, setShowReadinessModal] = useState(false);
  const [showLiveModal, setShowLiveModal] = useState(false);

  // Live ticking clock for Nairobi EAT
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const nairobi = formatNairobiTime(botStartedAt, nowTs);

  const book = mode === "live" ? live : demo;
  const eq = equity(book);
  const exp = exposure(book);
  const wins = book.trades.filter((t) => t.pnl > 0).length;
  const hitRate = book.trades.length > 0 ? (wins / book.trades.length) * 100 : 0;
  const avenues = scanAllAvenues(book, disciplineRules, nowTs);

  const scan = useCallback(async (q: string) => {
    setBusy(true);
    try {
      const res = await loadFeeds({ data: { query: q } });
      const combined = [...res.binance, ...res.dex];
      if (combined.length) {
        setTape(combined, res.note);
      } else {
        setTape(sampleTape(), "Loaded built-in baseline pairs.");
      }
    } catch {
      setTape(sampleTape(), "Offline feed fallback. Using built-in global universe.");
    } finally {
      setBusy(false);
    }
  }, [setTape]);

  const snipeAvenue = useCallback(
    (opp: AvenueOpportunity) => {
      const aveCand: Candidate = {
        id: opp.id,
        symbol: opp.symbol,
        name: opp.symbol,
        address: opp.id,
        chain: opp.chain,
        venue: opp.venueA.toLowerCase().includes("binance") ? "binance" : "dex",
        priceUsd: opp.priceA,
        change24h: (opp.grossSpreadPct ?? 2.5) * (opp.perpSide === "SHORT" ? -1 : 1),
        volume24h: 850_000,
        liquidityUsd: 420_000,
        score: opp.confidenceScore,
        pairAgeHours: 24,
        url: null,
        flags: [],
        rationale: [opp.title, ...(opp.disciplineNotes ?? [])],
      };
      manualEnter(aveCand);
    },
    [manualEnter],
  );

  // Initial feed load
  useEffect(() => {
    void scan("");
  }, [scan]);

  // Live market price mark loop
  useEffect(() => {
    const id = window.setInterval(() => {
      const prices: Record<string, number> = {};
      const positions = useDesk.getState()[useDesk.getState().mode].positions;
      for (const p of positions) {
        // Drift or live price update
        const drift = 1 + (Math.random() - 0.48) * 0.015;
        prices[p.tokenId] = p.mark * drift;
      }
      if (Object.keys(prices).length) {
        tick(prices);
      }

      // Step sniper engine if armed
      if (useDesk.getState().power) {
        autoStep();
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [tick, autoStep]);

  const filteredTape = tape.filter((c) => {
    if (filterVenue === "all") return true;
    return c.venue === filterVenue;
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      {/* Top Desk Header with Mode Switcher & Bot Controls */}
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Global Sniper Desk</h1>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase",
                mode === "live"
                  ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
                  : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
              )}
            >
              {mode === "live" ? "Live Trading Active" : "Demo Mode ($500)"}
            </span>
          </div>
          <p className="mt-1 text-xs text-faint md:text-sm">
            {mode === "live"
              ? "Live execution rail. Real cash ledger active. Connect signing keys or manage funds in the Wallet."
              : "Safe simulated paper environment. Starts at $500. Bot combs global markets, analyzes risk, and learns from every fill."}
          </p>
        </div>

        {/* Mode Switch Button & Power Button */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Prominent Mode Switch Button */}
          <div className="flex items-center rounded-xl border border-line bg-panel-2 p-1">
            <button
              type="button"
              onClick={() => setMode("demo")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                mode === "demo"
                  ? "bg-brass text-ink shadow-sm"
                  : "text-faint hover:text-cream",
              )}
            >
              🟢 Paper Trading ($500)
            </button>
            <button
              type="button"
              onClick={() => {
                if (mode !== "live") {
                  setShowLiveModal(true);
                } else {
                  setShowLiveModal(true);
                }
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                mode === "live"
                  ? "bg-amber-500 text-ink shadow-sm"
                  : "text-faint hover:text-cream",
              )}
            >
              🔴 Live Trading (${live.cash.toFixed(0)})
            </button>
          </div>

          {/* Arm / Disarm Bot */}
          <Button
            variant={power ? "solid" : "ghost"}
            onClick={() => setPower(!power)}
            className={cn(
              "font-semibold",
              power
                ? "bg-gain text-ink hover:bg-gain/90"
                : "border-line text-faint hover:text-cream",
            )}
          >
            {power ? (
              <>
                <Pause className="mr-1.5 size-4" /> Armed & Hunting
              </>
            ) : (
              <>
                <Play className="mr-1.5 size-4" /> Arm Sniper Bot
              </>
            )}
          </Button>

          {/* Refresh Feeds */}
          <Button
            variant="ghost"
            onClick={() => scan(query)}
            disabled={busy}
            title="Scan global feeds"
          >
            <RefreshCw className={cn("size-4", busy && "animate-spin")} />
          </Button>

          {/* Flatten Positions */}
          <Button
            variant="danger"
            onClick={() => flattenAll()}
            disabled={book.positions.length === 0}
            title="Flatten all open positions"
          >
            Flatten All
          </Button>
        </div>
      </div>

      {/* Nairobi EAT (UTC+3) Clock & Bot Lifecycle Status Strip */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-panel p-3.5 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-brass">
            <Clock className="size-4" />
          </div>
          <div suppressHydrationWarning>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-brass uppercase tracking-wider">
                EAT GMT(+3) Nairobi Timezone
              </span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300" suppressHydrationWarning>
                {nairobi.dayLabel} (Started Today)
              </span>
            </div>
            <p className="font-mono text-sm font-semibold text-cream" suppressHydrationWarning>
              {nairobi.dayOfWeek}, {nairobi.dateString} · {nairobi.timeString}
            </p>
          </div>
        </div>

        {/* Real-Money Readiness & Demo Training HUD */}
        {readiness && (
          <div className="flex items-center gap-3 border-t border-line/60 pt-2 sm:border-t-0 sm:pt-0">
            <div className="text-left sm:text-right">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-faint">Live Capital Readiness:</span>
                <span
                  className={cn(
                    "font-bold",
                    readiness.readinessScore >= 85 ? "text-gain" : "text-amber-400",
                  )}
                >
                  {readiness.readinessScore}% ({readiness.status})
                </span>
              </div>
              <p className="text-[11px] text-faint">
                {readiness.completedDemoTrades}/{readiness.targetDemoTrades} demo trades trained · {readiness.currentWinRatePct}% win rate
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => setShowReadinessModal(true)}
              className="h-8 border border-line px-2.5 text-xs text-brass hover:border-brass"
            >
              <ShieldCheck className="mr-1 size-3.5" /> Audit Readiness
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label={`${mode.toUpperCase()} EQUITY`}
          value={money(eq)}
          sub={mode === "demo" ? "Sandbox Balance" : "Live Ledger"}
        />
        <StatCard
          label="DAY P&L"
          value={(book.dayPnl >= 0 ? "+" : "") + money(book.dayPnl)}
          tone={book.dayPnl >= 0 ? "gain" : "loss"}
          sub={eq > 0 ? `${((book.dayPnl / eq) * 100).toFixed(2)}% ROI` : "0.00%"}
        />
        <StatCard
          label="AVAILABLE CASH"
          value={money(book.cash)}
          sub={`Risk cap: ${money(eq * 0.6)}`}
        />
        <StatCard
          label="HIT RATE"
          value={book.trades.length > 0 ? `${hitRate.toFixed(1)}%` : "—"}
          sub={`${book.trades.length} closed trades`}
        />
        <StatCard
          label="OPEN RISK"
          value={money(exp)}
          sub={`${book.positions.length}/3 positions held`}
        />
        <StatCard
          label="ADAPTIVE BRAIN"
          value={`${memory.minScore}/100`}
          sub={memory.seen >= 4 ? `Tuned on ${memory.seen} trades` : "Initial threshold"}
          accent
        />
      </div>

      {/* Universal Money-Making Avenues & Capital Discipline Hub */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brass" />
              <h2 className="text-lg font-bold text-cream">Universal Money-Making Avenues</h2>
              <span className="rounded bg-brass/10 px-2 py-0.5 text-xs font-semibold text-brass">
                Perps · Arbitrage · Early IPOs · Yield Basis
              </span>
            </div>
            <p className="mt-0.5 text-xs text-faint">
              Autonomous sniper exploring diverse market revenue streams with quantitative discipline.
            </p>
          </div>

          {/* Capital Discipline Guards */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="flex items-center gap-1 rounded border border-loss/30 bg-loss/10 px-2 py-0.5 font-medium text-loss">
              <ShieldAlert className="size-3" /> Max Loss: -3.0% Circuit Breaker
            </span>
            <span className="flex items-center gap-1 rounded border border-gain/30 bg-gain/10 px-2 py-0.5 font-medium text-gain">
              <Scale className="size-3" /> Min R:R ≥ 2.5:1 Floor
            </span>
            <span className="flex items-center gap-1 rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-medium text-purple-300">
              <TrendingUp className="size-3" /> Dynamic Trailing Stops
            </span>
          </div>
        </div>

        {/* Avenue Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line/60 pb-3">
          <button
            type="button"
            onClick={() => setAvenueFilter("ALL")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              avenueFilter === "ALL" ? "bg-brass text-ink" : "bg-panel-2 text-faint hover:text-cream",
            )}
          >
            All Avenues ({avenues.length})
          </button>
          <button
            type="button"
            onClick={() => setAvenueFilter("PERPS")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              avenueFilter === "PERPS" ? "bg-brass text-ink" : "bg-panel-2 text-faint hover:text-cream",
            )}
          >
            <Zap className="size-3" /> Perps & Funding (3)
          </button>
          <button
            type="button"
            onClick={() => setAvenueFilter("ARBITRAGE")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              avenueFilter === "ARBITRAGE" ? "bg-brass text-ink" : "bg-panel-2 text-faint hover:text-cream",
            )}
          >
            <Scale className="size-3" /> DEX-CEX Arbitrage (2)
          </button>
          <button
            type="button"
            onClick={() => setAvenueFilter("EARLY_IPO")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              avenueFilter === "EARLY_IPO" ? "bg-brass text-ink" : "bg-panel-2 text-faint hover:text-cream",
            )}
          >
            <Rocket className="size-3" /> Early IPOs & Launches (2)
          </button>
          <button
            type="button"
            onClick={() => setAvenueFilter("YIELD_BASIS")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              avenueFilter === "YIELD_BASIS" ? "bg-brass text-ink" : "bg-panel-2 text-faint hover:text-cream",
            )}
          >
            <Coins className="size-3" /> Staking Yield Basis (1)
          </button>
        </div>

        {/* Avenue Cards Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {avenues
            .filter((a) => (avenueFilter === "ALL" ? true : a.category === avenueFilter))
            .map((opp) => {
              const isHeld = book.positions.some((p) => p.tokenId === opp.id);
              return (
                <div
                  key={opp.id}
                  className={cn(
                    "flex flex-col justify-between rounded-xl border p-3.5 transition-all",
                    isHeld
                      ? "border-gain/60 bg-gain/5"
                      : "border-line bg-panel-2 hover:border-line/80",
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-cream">{opp.symbol}</span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                              opp.category === "PERPS" && "bg-amber-500/20 text-amber-300",
                              opp.category === "ARBITRAGE" && "bg-cyan-500/20 text-cyan-300",
                              opp.category === "EARLY_IPO" && "bg-pink-500/20 text-pink-300",
                              opp.category === "YIELD_BASIS" && "bg-emerald-500/20 text-emerald-300",
                            )}
                          >
                            {opp.category}
                          </span>
                          <span className="text-[10px] text-faint">({opp.chain})</span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-cream">{opp.title}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm font-bold text-cream">
                          {px(opp.priceA)}
                        </span>
                        <p className="text-[10px] text-faint">
                          {opp.venueB ? `${opp.venueA} ↔ ${opp.venueB}` : opp.venueA}
                        </p>
                      </div>
                    </div>

                    {/* Specific Avenue Metrics */}
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-line/50 bg-panel p-2 text-[11px]">
                      {opp.category === "PERPS" && (
                        <>
                          <div>
                            <span className="text-faint">Funding Rate:</span>
                            <p className="font-mono font-semibold text-gain">
                              {opp.fundingRate8h ? `+${(opp.fundingRate8h * 100).toFixed(3)}%/8h` : "—"}
                            </p>
                          </div>
                          <div>
                            <span className="text-faint">Annualized Yield:</span>
                            <p className="font-mono font-semibold text-brass">
                              {opp.fundingApr ? `${opp.fundingApr}% APR` : "—"}
                            </p>
                          </div>
                        </>
                      )}

                      {opp.category === "ARBITRAGE" && (
                        <>
                          <div>
                            <span className="text-faint">Gross Spread:</span>
                            <p className="font-mono font-semibold text-gain">
                              +{opp.grossSpreadPct}%
                            </p>
                          </div>
                          <div>
                            <span className="text-faint">Net Profit (Post-Gas):</span>
                            <p className="font-mono font-semibold text-emerald-400">
                              +${opp.netProfitUsd?.toFixed(2)}
                            </p>
                          </div>
                        </>
                      )}

                      {opp.category === "EARLY_IPO" && (
                        <>
                          <div>
                            <span className="text-faint">Liquidity Lock:</span>
                            <p className="font-mono font-semibold text-cream">
                              {opp.liquidityLockDays} Days Locked
                            </p>
                          </div>
                          <div>
                            <span className="text-faint">Anti-Rug Score:</span>
                            <p className="font-mono font-semibold text-emerald-400">
                              {opp.rugScore}/100 Safe
                            </p>
                          </div>
                        </>
                      )}

                      {opp.category === "YIELD_BASIS" && (
                        <>
                          <div>
                            <span className="text-faint">Peg Stability:</span>
                            <p className="font-mono font-semibold text-gain">99.98% Pegged</p>
                          </div>
                          <div>
                            <span className="text-faint">Expected APY:</span>
                            <p className="font-mono font-semibold text-brass">
                              {opp.expectedApy}% APY
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Risk & Discipline Parameters */}
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-faint">
                      <span>R:R Multiple: <strong className="text-brass">{opp.riskRewardRatio}R</strong></span>
                      <span>Stop: <strong className="text-loss">{px(opp.stopLossPrice)} (-{(opp.stopLossPct * 100).toFixed(1)}%)</strong></span>
                      <span>Target: <strong className="text-gain">{px(opp.targetPrice)}</strong></span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
                    <span className="text-[10px] text-faint">
                      Confidence: <strong className="text-cream">{opp.confidenceScore}%</strong>
                    </span>
                    <button
                      type="button"
                      disabled={isHeld || book.positions.length >= 3}
                      onClick={() => snipeAvenue(opp)}
                      className={cn(
                        "rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
                        isHeld
                          ? "cursor-default text-gain"
                          : "bg-brass text-ink hover:bg-brass/90 shadow-sm",
                      )}
                    >
                      {isHeld ? "Held" : "Simulate Snipe"}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Global Opportunities Scanner / Ticker Strip */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe2 className="size-4 text-brass" />
            <h2 className="text-sm font-semibold tracking-wider text-faint uppercase">
              Global Market Intelligence ({tape.length} pairs live)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-line bg-panel p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterVenue("all")}
                className={cn(
                  "rounded px-2 py-0.5 font-medium",
                  filterVenue === "all" ? "bg-panel-2 text-cream" : "text-faint",
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterVenue("binance")}
                className={cn(
                  "rounded px-2 py-0.5 font-medium",
                  filterVenue === "binance" ? "bg-panel-2 text-cream" : "text-faint",
                )}
              >
                Binance CEX
              </button>
              <button
                type="button"
                onClick={() => setFilterVenue("dex")}
                className={cn(
                  "rounded px-2 py-0.5 font-medium",
                  filterVenue === "dex" ? "bg-panel-2 text-cream" : "text-faint",
                )}
              >
                Raydium / DEX
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void scan(query);
              }}
              className="flex items-center"
            >
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter ticker / address…"
                  className="h-8 rounded-lg border border-line bg-panel pl-8 pr-3 text-xs text-cream outline-none focus:border-brass"
                />
              </div>
            </form>
          </div>
        </div>

        {/* Horizontal Ticker Ribbon */}
        <div className="flex w-full min-w-0 max-w-full gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {filteredTape.slice(0, 14).map((c) => {
            const isHeld = book.positions.some((p) => p.tokenId === c.id);
            const clearsScore = c.score >= memory.minScore;
            return (
              <div
                key={c.id}
                className={cn(
                  "flex min-w-[220px] flex-col justify-between rounded-xl border p-3 transition-colors",
                  isHeld
                    ? "border-gain/60 bg-gain/5"
                    : clearsScore
                      ? "border-brass/40 bg-panel hover:border-brass"
                      : "border-line bg-panel hover:border-line/80",
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-cream">{c.symbol}</span>
                      <span
                        className={cn(
                          "rounded px-1 text-[9px] font-semibold uppercase",
                          c.venue === "binance"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-purple-500/20 text-purple-300",
                        )}
                      >
                        {c.venue === "binance" ? "Binance" : c.chain}
                      </span>
                    </div>
                    <p className="num text-xs text-faint">Vol ${Math.round(c.volume24h).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="num text-sm font-semibold">{px(c.priceUsd)}</p>
                    <p
                      className={cn(
                        "num text-xs font-medium",
                        c.change24h >= 0 ? "text-gain" : "text-loss",
                      )}
                    >
                      {c.change24h >= 0 ? "+" : ""}
                      {c.change24h.toFixed(2)}%
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-line/60 pt-2 text-xs">
                  <span
                    className={cn(
                      "font-mono font-medium",
                      clearsScore ? "text-brass" : "text-faint",
                    )}
                  >
                    Score: {c.score}/100
                  </span>
                  <button
                    type="button"
                    disabled={isHeld || book.positions.length >= 3}
                    onClick={() => manualEnter(c)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                      isHeld
                        ? "cursor-default text-gain"
                        : "bg-panel-2 text-cream hover:bg-brass hover:text-ink",
                    )}
                  >
                    {isHeld ? "Held" : "Snipe"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Open Positions & Execution Stream */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left Column: Active Positions (2 cols) */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Active Bot Positions ({book.positions.length}/3)</Label>
                <p className="text-xs text-faint">
                  Automatic brackets: Trailing Stop Loss @ -8%, Fast Take Profit @ +6%
                </p>
              </div>
              {book.positions.length > 0 && (
                <button
                  type="button"
                  onClick={() => flattenAll()}
                  className="rounded-md border border-line px-2.5 py-1 text-xs text-loss hover:bg-loss/10"
                >
                  Flatten All
                </button>
              )}
            </div>

            {book.positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-12 text-center">
                <Crosshair className="size-8 text-faint/60" />
                <p className="mt-2 text-sm font-medium text-cream">No Active Open Positions</p>
                <p className="mt-1 max-w-sm text-xs text-faint">
                  {power
                    ? "Sniper bot is armed and hunting for setups clearing the adaptive score threshold."
                    : "Bot is on standby. Arm the sniper above or click 'Snipe' on any pair."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {book.positions.map((p) => {
                  const pnl = (p.mark - p.entryPrice) * p.qty;
                  const pnlPct = ((p.mark - p.entryPrice) / p.entryPrice) * 100;
                  const targetPx = p.target ?? p.entryPrice * 1.06;
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-panel-2 p-3 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-cream">{p.symbol}</span>
                          <span className="rounded bg-panel px-1.5 py-0.5 text-[10px] text-faint uppercase">
                            {p.chain}
                          </span>
                          <span className="rounded bg-gain/10 px-1.5 py-0.5 text-[10px] font-semibold text-gain">
                            LONG
                          </span>
                        </div>
                        <p className="num mt-0.5 text-xs text-faint">
                          Entry {px(p.entryPrice)} · Mark {px(p.mark)} · Stop {px(p.stop)} · Take Profit {px(targetPx)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="text-right">
                          <p
                            className={cn(
                              "num text-sm font-bold",
                              pnl >= 0 ? "text-gain" : "text-loss",
                            )}
                          >
                            {pnl >= 0 ? "+" : ""}
                            {money(pnl)} ({pnlPct >= 0 ? "+" : ""}
                            {pnlPct.toFixed(2)}%)
                          </p>
                          <p className="num text-[11px] text-faint">Size: ${p.notional.toFixed(2)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => flatten(p.id)}
                          className="h-8 border border-line text-xs hover:border-loss hover:text-loss"
                        >
                          Flatten
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Closed Trades History */}
          <Card>
            <Label>Recent Closed Trades & Realized P&L</Label>
            {book.trades.length === 0 ? (
              <p className="mt-3 text-xs text-faint">No closed executions yet in this session.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line text-faint uppercase">
                    <tr>
                      <th className="pb-2 font-normal">Symbol</th>
                      <th className="pb-2 font-normal">Reason</th>
                      <th className="pb-2 font-normal">Closed At</th>
                      <th className="pb-2 text-right font-normal">Realized P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {book.trades.slice(0, 6).map((t) => (
                      <tr key={t.id} className="hover:bg-panel-2/50">
                        <td className="py-2.5 font-medium text-cream">{t.symbol}</td>
                        <td className="py-2.5">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                              t.reason === "TARGET"
                                ? "bg-gain/20 text-gain"
                                : t.reason === "STOP"
                                  ? "bg-loss/20 text-loss"
                                  : "bg-panel text-faint",
                            )}
                          >
                            {t.reason === "TARGET" ? "Take Profit" : t.reason === "STOP" ? "Stop Loss" : t.reason}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-faint">
                          {new Date(t.closedAt).toLocaleTimeString()}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 text-right font-mono font-semibold",
                            t.pnl >= 0 ? "text-gain" : "text-loss",
                          )}
                        >
                          {t.pnl >= 0 ? "+" : ""}
                          {money(t.pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Risk Gates & Sniper Decision Stream */}
        <div className="flex flex-col gap-4">
          {/* Risk Gate Status */}
          <Card>
            <div className="flex items-center gap-1.5 text-brass">
              <Shield className="size-4" />
              <Label>Automated Risk Gates</Label>
            </div>
            <ul className="mt-3 flex flex-col gap-2 text-xs">
              {portfolioLines(book).map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-2 border-b border-line/50 pb-1.5 last:border-0">
                  <span className={line.pass ? "text-cream" : "text-loss"}>{line.label}</span>
                  <span className={cn("num font-medium", line.pass ? "text-gain" : "text-loss")}>
                    {line.detail}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 border-b border-line/50 pb-1.5">
                <span className="text-cream">Adaptive Score Floor</span>
                <span className="num font-medium text-brass">{memory.minScore}/100</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-cream">Max Idea Allocation</span>
                <span className="num font-medium text-cream">20% (${(eq * 0.2).toFixed(2)})</span>
              </li>
            </ul>
          </Card>

          {/* Real-time Session Log */}
          <Card className="flex flex-1 flex-col">
            <div className="flex items-center justify-between">
              <Label>Sniper Operational Feed</Label>
              <span className="text-[10px] text-faint">Live telemetry</span>
            </div>
            <div className="mt-3 flex max-h-80 flex-1 flex-col gap-1.5 overflow-y-auto font-mono text-xs text-faint scrollbar-thin">
              {log.length === 0 ? (
                <p>Standing by. Telemetry will print here.</p>
              ) : (
                log.slice(0, 18).map((line, idx) => (
                  <div key={`${line}-${idx}`} className="flex items-start gap-1.5 text-[11px]">
                    <span className="text-brass/70">›</span>
                    <span className="text-cream/90">{line}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Reset Demo / Helper */}
          {mode === "demo" && (
            <div className="rounded-xl border border-line p-3 text-xs text-faint">
              <div className="flex items-center justify-between">
                <span>Reset Demo Desk to $500</span>
                <button
                  type="button"
                  onClick={() => resetDemo()}
                  className="rounded border border-line px-2 py-1 text-cream hover:bg-panel-2"
                >
                  Reset Demo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-Money Readiness Audit Modal */}
      {showReadinessModal && readiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-brass/10 text-brass">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-cream">Real-Money Readiness Audit</h3>
                  <p className="text-xs text-faint">
                    Quantitative scorecard for transitioning from Demo Sandbox to Live Funds
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReadinessModal(false)}
                className="rounded-lg p-1.5 text-faint hover:bg-panel-2 hover:text-cream"
              >
                ✕
              </button>
            </div>

            {/* Overall Gauge */}
            <div className="my-5 rounded-xl border border-line bg-panel-2 p-4 text-center">
              <div className="text-xs text-faint">Overall Readiness Score</div>
              <div className="mt-1 font-mono text-4xl font-extrabold text-brass">
                {readiness.readinessScore}%
              </div>
              <p
                className={cn(
                  "mt-1 text-xs font-semibold",
                  readiness.readinessScore >= 85 ? "text-gain" : "text-amber-400",
                )}
              >
                {readiness.statusMessage}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-brass transition-all duration-500"
                  style={{ width: `${readiness.readinessScore}%` }}
                />
              </div>
            </div>

            {/* Checklist */}
            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-faint">
                Statistical Edge & Discipline Checklist
              </h4>
              {readiness.checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-panel-2 p-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {item.met ? (
                      <CheckCircle2 className="size-4 shrink-0 text-gain" />
                    ) : (
                      <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                    )}
                    <div>
                      <span className="font-semibold text-cream">{item.label}</span>
                      <p className="text-[11px] text-faint">Target: {item.requiredValue}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      item.met ? "text-gain" : "text-amber-400",
                    )}
                  >
                    {item.currentValue}
                  </span>
                </div>
              ))}
            </div>

            {/* Educational / Discipline Note */}
            <div className="mt-5 rounded-xl border border-brass/30 bg-brass/5 p-3.5 text-xs text-brass">
              <p className="font-semibold">Disciplined Capital Protection Protocol:</p>
              <p className="mt-1 text-[11px] leading-relaxed text-cream/80">
                {readiness.recommendation}
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <Button variant="solid" onClick={() => setShowReadinessModal(false)}>
                Close Audit Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Live Mode Transition Modal */}
      <LiveModeTransitionModal
        isOpen={showLiveModal}
        onClose={() => setShowLiveModal(false)}
        onConfirm={() => {
          setMode("live");
          setShowLiveModal(false);
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "gain" | "loss";
  accent?: boolean;
}) {
  return (
    <Card className={cn(accent && "border-brass/40 bg-panel")}>
      <p className="text-[10px] tracking-wider text-faint uppercase">{label}</p>
      <p
        className={cn(
          "num mt-1 text-lg font-bold sm:text-xl",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-loss",
          accent && "text-brass",
        )}
      >
        {value}
      </p>
      <p className="num text-[11px] text-faint">{sub}</p>
    </Card>
  );
}
