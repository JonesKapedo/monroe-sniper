import { useState, useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  History,
  Search,
} from "lucide-react";
import { formatNairobiTime } from "@/lib/sniper/nairobi-time";
import { useDesk } from "@/lib/desk-store";
import { useFeedHealth } from "@/lib/feeds/status";
import { getTradeLearningEvents, type TradeLearningEvent } from "@/lib/trade-memory.functions";
import { Button, Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";

const EXIT_PAGE_SIZE = 13;
const ARCHIVE_PAGE_SIZE = 50;

export function SignalsView() {
  const mode = useDesk((s) => s.mode);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const executions = useDesk((s) => s.executions);
  const tape = useDesk((s) => s.tape);

  const activeBook = mode === "live" ? live : demo;
  const feedRows = useFeedHealth((s) => s.rows);
  const feedById = new Map(feedRows.map((r) => [r.id, r]));
  const feedDot = (state: string | undefined) =>
    state === "live"
      ? "size-2 rounded-full bg-gain pulse-dot"
      : state === "locked"
        ? "size-2 rounded-full bg-amber-400"
        : state === "down"
          ? "size-2 rounded-full bg-loss"
          : "size-2 rounded-full bg-faint";
  const feedLabel = (state: string | undefined) =>
    state === "live" ? "Live" : state === "down" ? "Down" : state === "locked" ? "Locked" : "No data yet";

  // Trade History Panel state
  const [historyTab, setHistoryTab] = useState<"ALL" | "ENTRIES" | "EXITS">("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<"ALL" | "WIN" | "LOSS">("ALL");
  const [symbolSearch, setSymbolSearch] = useState("");

  // Trade Entries from authentic position + execution records only.
  // No synthesized stops, scores, or rationales — missing fields render as "—".
  const entryReports = useMemo(() => {
    const list: Array<{
      id: string;
      ts: number;
      symbol: string;
      venue: string;
      side: "BUY" | "SELL" | "LONG" | "SHORT";
      entryPrice: number;
      notional: number;
      qty: number;
      stopPrice: number | null;
      targetPrice: number | null;
      riskRewardRatio: number | null;
      score: number | null;
      rationale: string;
      status: "OPEN" | "CLOSED";
      activePnl?: number;
    }> = [];

    // 1. Current Active Positions (authentic brackets + entry score when recorded)
    activeBook.positions.forEach((p) => {
      const diff = p.mark - p.entryPrice;
      const unPnl = p.qty > 0 ? diff * p.qty : diff;
      const rr =
        p.target !== undefined && p.stop !== undefined && p.entryPrice - p.stop !== 0
          ? Math.abs((p.target - p.entryPrice) / (p.entryPrice - p.stop))
          : null;

      list.push({
        id: `pos-${p.id}`,
        ts: p.openedAt,
        symbol: p.symbol,
        venue: p.venue === "binance" ? "Binance Spot" : `${p.chain.toUpperCase()} DEX`,
        side: "LONG",
        entryPrice: p.entryPrice,
        notional: p.notional,
        qty: p.qty,
        stopPrice: p.stop ?? null,
        targetPrice: p.target ?? null,
        riskRewardRatio: rr !== null ? Math.round(rr * 10) / 10 : null,
        score: p.entryScore ?? null,
        rationale: "Open position brackets",
        status: "OPEN",
        activePnl: unPnl,
      });
    });

    // 2. Historical Executions from Tape (execution record only — no invented brackets)
    executions
      .filter((e) => e.type === "BOT_ENTRY")
      .forEach((e) => {
        if (!list.some((existing) => existing.symbol === e.symbol && Math.abs(existing.ts - e.ts) < 5000)) {
          list.push({
            id: `exec-${e.id}`,
            ts: e.ts,
            symbol: e.symbol,
            venue: e.venue,
            side: e.side,
            entryPrice: e.price,
            notional: e.notional,
            qty: e.qty,
            stopPrice: null,
            targetPrice: null,
            riskRewardRatio: e.riskReward !== undefined ? Math.round(e.riskReward * 10) / 10 : null,
            score: null,
            rationale: e.note || "Bot entry execution",
            status: "CLOSED",
          });
        }
      });

    return list.sort((a, b) => b.ts - a.ts);
  }, [activeBook.positions, executions]);

  // Trade Exits from authentic closed-trade records only.
  // Rows without recorded entry/exit prices are skipped — never estimated.
  const exitReports = useMemo(() => {
    const list: Array<{
      id: string;
      ts: number;
      symbol: string;
      side: "LONG" | "SHORT" | "SELL";
      entryPrice: number | null;
      exitPrice: number | null;
      pnlUsd: number;
      pnlPct: number | null;
      reason: string;
      reasonBadge: "TARGET" | "STOP" | "TIME" | "SIGNAL" | "MANUAL";
      holdingTime: string;
      outcome: "WIN" | "LOSS";
    }> = [];

    const formatHolding = (openedAt: number | undefined, closedAt: number): string => {
      if (!openedAt || closedAt <= openedAt) return "—";
      const mins = Math.max(1, Math.round((closedAt - openedAt) / 60000));
      if (mins < 60) return `${mins}m`;
      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    // Desk Closed Trades (authentic prices/timestamps only)
    activeBook.trades.forEach((t) => {
      if (t.entryPrice === undefined || t.exitPrice === undefined) return;
      const isWin = t.pnl > 0;
      let badge: "TARGET" | "STOP" | "TIME" | "SIGNAL" | "MANUAL" = "TARGET";
      const r = t.reason.toUpperCase();
      if (r.includes("STOP")) badge = "STOP";
      else if (r.includes("TIME")) badge = "TIME";
      else if (r.includes("SIGNAL")) badge = "SIGNAL";
      else if (r.includes("MANUAL") || r.includes("FLATTEN")) badge = "MANUAL";

      const pnlPct =
        t.entryPrice > 0 ? ((t.exitPrice - t.entryPrice) / t.entryPrice) * 100 : null;

      list.push({
        id: `desk-trade-${t.id}`,
        ts: t.closedAt,
        symbol: t.symbol,
        side: "LONG",
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        pnlUsd: t.pnl,
        pnlPct: pnlPct !== null ? Math.round(pnlPct * 10) / 10 : null,
        reason: t.reason,
        reasonBadge: badge,
        holdingTime: formatHolding(t.openedAt, t.closedAt),
        outcome: isWin ? "WIN" : "LOSS",
      });
    });

    return list.sort((a, b) => b.ts - a.ts);
  }, [activeBook.trades]);

  // Statistics calculation
  const totalTrades = exitReports.length;
  const winCount = exitReports.filter((t) => t.outcome === "WIN").length;
  const winRate = totalTrades > 0 ? Math.round((winCount / totalTrades) * 100) : 0;
  const totalRealizedPnl = exitReports.reduce((sum, t) => sum + t.pnlUsd, 0);
  const grossProfit = exitReports.filter((t) => t.pnlUsd > 0).reduce((sum, t) => sum + t.pnlUsd, 0);
  const grossLoss = Math.abs(exitReports.filter((t) => t.pnlUsd < 0).reduce((sum, t) => sum + t.pnlUsd, 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "∞" : "0.00";

  // Filtered views
  const filteredEntries = useMemo(() => {
    return entryReports.filter((item) => {
      if (symbolSearch.trim() && !item.symbol.toLowerCase().includes(symbolSearch.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [entryReports, symbolSearch]);

  const filteredExits = useMemo(() => {
    return exitReports.filter((item) => {
      if (outcomeFilter !== "ALL" && item.outcome !== outcomeFilter) return false;
      if (symbolSearch.trim() && !item.symbol.toLowerCase().includes(symbolSearch.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [exitReports, outcomeFilter, symbolSearch]);

  // The live report breathes: newest 13 only, full history lives in the archive.
  const visibleExits = filteredExits.slice(0, EXIT_PAGE_SIZE);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePage, setArchivePage] = useState(0);
  const [archiveRows, setArchiveRows] = useState<TradeLearningEvent[]>([]);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const openArchive = (page: number) => {
    setArchiveOpen(true);
    setArchivePage(page);
    setArchiveBusy(true);
    setArchiveError(null);
    getTradeLearningEvents({ data: { limit: ARCHIVE_PAGE_SIZE, offset: page * ARCHIVE_PAGE_SIZE } })
      .then((res) => {
        setArchiveRows(res.events);
        setArchiveTotal(res.total);
      })
      .catch((error: unknown) => {
        setArchiveError(error instanceof Error ? error.message : "Archive unavailable");
        setArchiveRows([]);
      })
      .finally(() => setArchiveBusy(false));
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl text-cream">
              Signal Intelligence & Trade Reports
            </h1>
            <span className="rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 text-xs font-semibold text-brass uppercase">
              5-SOURCE CONSENSUS
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-faint md:text-sm">
            Institutional consensus monitoring paired with complete execution transparency. Inspect exact trade entries, risk/reward parameters, and realized exit reports.
          </p>
        </div>

        {/* Active Mode Tag */}
        <div className="flex items-center gap-2 rounded-xl border border-line bg-panel p-2">
          <span
            className={cn(
              "size-2 rounded-full",
              mode === "live" ? "bg-amber-400 pulse-dot" : "bg-emerald-400",
            )}
          />
          <div className="text-xs">
            <span className="font-bold text-cream uppercase">{mode} DESK</span>
            <span className="text-faint ml-1.5 font-mono">(${activeBook.cash.toFixed(2)})</span>
          </div>
        </div>
      </div>

      {/* Feed Status (authentic — from live feed health, never hardcoded live) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-line bg-panel p-3.5">
          <div className="flex items-center justify-between">
            <Label>Binance Spot CEX</Label>
            <span className={feedDot(feedById.get("binance")?.state)} />
          </div>
          <p className="mt-1 text-xs text-cream">Order flow & 24h volume delta</p>
          <p className="mt-2 text-[11px] text-brass font-mono">
            Weight 30% · {feedLabel(feedById.get("binance")?.state)}
            {feedById.get("binance")?.detail ? ` — ${feedById.get("binance")?.detail}` : ""}
          </p>
        </Card>

        <Card className="border-line bg-panel p-3.5">
          <div className="flex items-center justify-between">
            <Label>DexScreener Pools</Label>
            <span className={feedDot(feedById.get("dex")?.state)} />
          </div>
          <p className="mt-1 text-xs text-cream">Raydium & Uniswap liquidity</p>
          <p className="mt-2 text-[11px] text-brass font-mono">
            Weight 25% · {feedLabel(feedById.get("dex")?.state)}
            {feedById.get("dex")?.detail ? ` — ${feedById.get("dex")?.detail}` : ""}
          </p>
        </Card>

        <Card className="border-line bg-panel p-3.5">
          <div className="flex items-center justify-between">
            <Label>CoinGecko Reference</Label>
            <span className={feedDot(feedById.get("coingecko")?.state)} />
          </div>
          <p className="mt-1 text-xs text-cream">Reference pricing & market caps</p>
          <p className="mt-2 text-[11px] text-brass font-mono">
            Reference · {feedLabel(feedById.get("coingecko")?.state)}
            {feedById.get("coingecko")?.detail ? ` — ${feedById.get("coingecko")?.detail}` : ""}
          </p>
        </Card>

        <Card className="border-line bg-panel p-3.5">
          <div className="flex items-center justify-between">
            <Label>CoinMarketCap</Label>
            <span className={feedDot(feedById.get("coinmarketcap")?.state)} />
          </div>
          <p className="mt-1 text-xs text-cream">Cross-venue reference checks</p>
          <p className="mt-2 text-[11px] text-brass font-mono">
            Reference · {feedLabel(feedById.get("coinmarketcap")?.state)}
            {feedById.get("coinmarketcap")?.detail ? ` — ${feedById.get("coinmarketcap")?.detail}` : ""}
          </p>
        </Card>

        <Card className="border-line bg-panel p-3.5">
          <div className="flex items-center justify-between">
            <Label>Ensemble Consensus</Label>
            <span className="size-2 rounded-full bg-brass" />
          </div>
          <p className="mt-1 text-xs text-cream">Invo + Finviz + Simul8or composite</p>
          <p className="mt-2 text-[11px] text-brass font-mono">
            Computed live per symbol below · {tape.length} symbols
          </p>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* TRADE HISTORY PANEL: TRADE ENTRY & TRADE EXIT REPORTS */}
      {/* ========================================================================= */}
      <Card className="border-line bg-panel">
        {/* Panel Header */}
        <div className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-brass/40 bg-brass/10 text-brass">
              <History className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label>Trade History & Execution Audits</Label>
                <span className="rounded bg-panel-2 px-1.5 py-0.2 text-[10px] font-mono text-faint uppercase">
                  {mode.toUpperCase()} RAIL
                </span>
              </div>
              <p className="text-xs text-faint">
                Granular ledger of algorithm entry points and verified exit triggers with PnL accounting.
              </p>
            </div>
          </div>

          {/* Sub-tab Selectors */}
          <div className="flex items-center rounded-xl border border-line bg-panel-2 p-1">
            <button
              type="button"
              onClick={() => setHistoryTab("ALL")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                historyTab === "ALL" ? "bg-brass text-ink" : "text-faint hover:text-cream",
              )}
            >
              All Activity ({entryReports.length + exitReports.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab("ENTRIES")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                historyTab === "ENTRIES" ? "bg-brass text-ink" : "text-faint hover:text-cream",
              )}
            >
              Trade Entry Report ({entryReports.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab("EXITS")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                historyTab === "EXITS" ? "bg-brass text-ink" : "text-faint hover:text-cream",
              )}
            >
              Trade Exit Report ({exitReports.length})
            </button>
          </div>
        </div>

        {/* Executive Trade History Metrics Row */}
        <div className="grid grid-cols-2 gap-3 py-4 border-b border-line/60 sm:grid-cols-5">
          <div className="rounded-lg border border-line/60 bg-panel-2 p-3">
            <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">
              Closed Trades (session)
            </span>
            <p className="font-mono text-lg font-bold text-cream mt-0.5">{totalTrades}</p>
          </div>

          <div className="rounded-lg border border-line/60 bg-panel-2 p-3">
            <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">
              Win Rate (session exits)
            </span>
            <p className={cn("font-mono text-lg font-bold mt-0.5", winRate >= 50 ? "text-gain" : "text-amber-400")}>
              {winRate}%
            </p>
          </div>

          <div className="rounded-lg border border-line/60 bg-panel-2 p-3">
            <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">
              Realized PnL
            </span>
            <p className={cn("font-mono text-lg font-bold mt-0.5", totalRealizedPnl >= 0 ? "text-gain" : "text-loss")}>
              {totalRealizedPnl >= 0 ? "+" : ""}${totalRealizedPnl.toFixed(2)}
            </p>
          </div>

          <div className="rounded-lg border border-line/60 bg-panel-2 p-3">
            <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">
              Profit Factor
            </span>
            <p className="font-mono text-lg font-bold text-cream mt-0.5">{profitFactor}</p>
          </div>

          <div className="rounded-lg border border-line/60 bg-panel-2 p-3">
            <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">
              Active Entries
            </span>
            <p className="font-mono text-lg font-bold text-brass mt-0.5">
              {entryReports.filter((e) => e.status === "OPEN").length} open
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col gap-2 pt-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-faint" />
              <input
                value={symbolSearch}
                onChange={(e) => setSymbolSearch(e.target.value)}
                placeholder="Search symbol (e.g. SOL, BTC)..."
                className="field h-8 pl-8 pr-3 text-xs w-48 rounded-lg border-line bg-panel-2 text-cream outline-none focus:border-brass"
              />
            </div>
            {symbolSearch && (
              <button
                type="button"
                onClick={() => setSymbolSearch("")}
                className="text-[11px] text-faint hover:text-cream"
              >
                Clear
              </button>
            )}
          </div>

          {(historyTab === "ALL" || historyTab === "EXITS") && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-faint">Result:</span>
              {(["ALL", "WIN", "LOSS"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setOutcomeFilter(filter)}
                  className={cn(
                    "rounded px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    outcomeFilter === filter
                      ? "bg-brass text-ink font-bold"
                      : "bg-panel-2 text-faint hover:text-cream",
                  )}
                >
                  {filter === "ALL" ? "All" : filter === "WIN" ? "Wins" : "Losses"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: TRADE ENTRY REPORT */}
        {/* ===================================================================== */}
        {(historyTab === "ALL" || historyTab === "ENTRIES") && (
          <div className="mt-3">
            <div className="flex items-center justify-between border-b border-line/60 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="size-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-cream uppercase tracking-wider">
                  Trade Entry Report ({filteredEntries.length})
                </h3>
              </div>
              <span className="text-[11px] text-faint">Sized by Volatility ATR & Discipline Gates</span>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="py-8 text-center text-xs text-faint">
                No trade entries recorded yet. Arm the sniper on the Desk to begin automated entry.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="border-b border-line text-[10px] tracking-wider text-faint uppercase">
                    <tr>
                      <th className="pb-2 font-normal">Timestamp (Nairobi EAT)</th>
                      <th className="pb-2 font-normal">Symbol / Venue</th>
                      <th className="pb-2 font-normal">Side</th>
                      <th className="pb-2 font-normal">Entry Price</th>
                      <th className="pb-2 font-normal">Size / Notional</th>
                      <th className="pb-2 font-normal">Stop Loss</th>
                      <th className="pb-2 font-normal">Target (R:R)</th>
                      <th className="pb-2 font-normal">Score</th>
                      <th className="pb-2 text-right font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/30">
                    {filteredEntries.map((e) => {
                      const nairobiTime = formatNairobiTime(undefined, e.ts);
                      return (
                        <tr key={e.id} className="hover:bg-panel-2/50">
                          <td className="py-2.5 text-faint whitespace-nowrap">
                            <span suppressHydrationWarning>{nairobiTime.timeString}</span>
                            <span className="ml-1 text-[10px] opacity-60" suppressHydrationWarning>
                              ({nairobiTime.dateString})
                            </span>
                          </td>
                          <td className="py-2.5 font-bold text-cream">
                            {e.symbol}
                            <span className="ml-1 text-[10px] text-faint font-normal">({e.venue})</span>
                          </td>
                          <td className="py-2.5">
                            <span className="rounded bg-gain/15 px-1.5 py-0.5 text-[10px] font-bold text-gain">
                              {e.side}
                            </span>
                          </td>
                          <td className="py-2.5 text-cream font-semibold">
                            ${e.entryPrice >= 1 ? e.entryPrice.toFixed(2) : e.entryPrice.toPrecision(4)}
                          </td>
                          <td className="py-2.5 text-cream">
                            ${e.notional.toFixed(2)}{" "}
                            <span className="text-[10px] text-faint">({e.qty.toFixed(2)} units)</span>
                          </td>
                          <td className="py-2.5 text-loss">
                            {e.stopPrice !== null
                              ? `$${e.stopPrice >= 1 ? e.stopPrice.toFixed(2) : e.stopPrice.toPrecision(4)}`
                              : "—"}
                          </td>
                          <td className="py-2.5 text-gain">
                            {e.targetPrice !== null ? (
                              <>
                                ${e.targetPrice >= 1 ? e.targetPrice.toFixed(2) : e.targetPrice.toPrecision(4)}
                                <span className="ml-1 text-[10px] text-brass">
                                  ({e.riskRewardRatio !== null ? `${e.riskRewardRatio}:1 R` : "—"})
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2.5">
                            {e.score !== null ? (
                              <span className="text-brass font-bold">{e.score}/100</span>
                            ) : (
                              <span className="text-faint">—</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            {e.status === "OPEN" ? (
                              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                ACTIVE IN BOOK
                              </span>
                            ) : (
                              <span className="rounded bg-panel-2 px-2 py-0.5 text-[10px] font-medium text-faint">
                                SETTLED
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: TRADE EXIT REPORT */}
        {/* ===================================================================== */}
        {(historyTab === "ALL" || historyTab === "EXITS") && (
          <div className="mt-5 border-t border-line/60 pt-4">
            <div className="flex items-center justify-between border-b border-line/60 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="size-4 text-amber-400" />
                <h3 className="text-sm font-bold text-cream uppercase tracking-wider">
                  Trade Exit Report ({Math.min(visibleExits.length, EXIT_PAGE_SIZE)} of {filteredExits.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-[11px] text-faint sm:inline">Realized Returns & Verified Exit Reasons</span>
                <Button
                  variant="ghost"
                  onClick={() => openArchive(0)}
                  className="h-8 border border-line px-2.5 text-xs text-brass hover:border-brass"
                >
                  <ExternalLink className="mr-1 size-3.5" /> Full report
                </Button>
              </div>
            </div>

            {filteredExits.length === 0 ? (
              <div className="py-8 text-center text-xs text-faint">
                No trade exits finalized yet. Once open positions hit Take-Profit or Stop-Loss, exits are logged here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="border-b border-line text-[10px] tracking-wider text-faint uppercase">
                    <tr>
                      <th className="pb-2 font-normal">Exit Time (Nairobi EAT)</th>
                      <th className="pb-2 font-normal">Symbol</th>
                      <th className="pb-2 font-normal">Entry &rarr; Exit Price</th>
                      <th className="pb-2 font-normal">Duration</th>
                      <th className="pb-2 font-normal">Exit Reason Trigger</th>
                      <th className="pb-2 font-normal">Realized Return</th>
                      <th className="pb-2 text-right font-normal">Net PnL (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/30">
                    {visibleExits.map((x) => {
                      const nairobiTime = formatNairobiTime(undefined, x.ts);
                      const isWin = x.outcome === "WIN";
                      return (
                        <tr key={x.id} className="hover:bg-panel-2/50">
                          <td className="py-2.5 text-faint whitespace-nowrap">
                            <span suppressHydrationWarning>{nairobiTime.timeString}</span>
                            <span className="ml-1 text-[10px] opacity-60" suppressHydrationWarning>
                              ({nairobiTime.dateString})
                            </span>
                          </td>
                          <td className="py-2.5 font-bold text-cream">{x.symbol}</td>
                          <td className="py-2.5 text-cream">
                            {x.entryPrice !== null && x.exitPrice !== null ? (
                              <>
                                ${x.entryPrice >= 1 ? x.entryPrice.toFixed(2) : x.entryPrice.toPrecision(4)}{" "}
                                &rarr;{" "}
                                <span className={cn("font-bold", isWin ? "text-gain" : "text-loss")}>
                                  ${x.exitPrice >= 1 ? x.exitPrice.toFixed(2) : x.exitPrice.toPrecision(4)}
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2.5 text-faint">{x.holdingTime}</td>
                          <td className="py-2.5">
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                                x.reasonBadge === "TARGET" && "bg-gain/20 text-gain",
                                x.reasonBadge === "STOP" && "bg-loss/20 text-loss",
                                x.reasonBadge === "TIME" && "bg-amber-500/20 text-amber-300",
                                x.reasonBadge === "SIGNAL" && "bg-blue-500/20 text-blue-300",
                                x.reasonBadge === "MANUAL" && "bg-panel-2 text-faint",
                              )}
                            >
                              {x.reason}
                            </span>
                          </td>
                          <td className="py-2.5">
                            {x.pnlPct !== null ? (
                              <span className={cn("font-bold", isWin ? "text-gain" : "text-loss")}>
                                {x.pnlPct >= 0 ? "+" : ""}
                                {x.pnlPct.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-faint">—</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-bold">
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 text-xs font-bold",
                                isWin ? "bg-gain/20 text-gain" : "bg-loss/20 text-loss",
                              )}
                            >
                              {x.pnlUsd >= 0 ? "+" : ""}${x.pnlUsd.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {filteredExits.length > EXIT_PAGE_SIZE && (
              <p className="mt-2 text-[11px] text-faint">
                Showing the latest {EXIT_PAGE_SIZE} of {filteredExits.length} exits — open the full report for the complete database archive.
              </p>
            )}
          </div>
        )}

        {archiveOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
              <div className="flex items-center justify-between border-b border-line p-4">
                <div>
                  <h3 className="text-base font-bold text-cream">Full Exit Archive</h3>
                  <p className="text-xs text-faint">
                    Every persisted close, newest first · {archiveTotal} total
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setArchiveOpen(false)}
                  className="rounded-lg p-1.5 text-faint hover:bg-panel-2 hover:text-cream"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {archiveBusy ? (
                  <p className="py-8 text-center text-xs text-faint">Loading archive…</p>
                ) : archiveError ? (
                  <p className="py-8 text-center text-xs text-loss">{archiveError}</p>
                ) : archiveRows.length === 0 ? (
                  <p className="py-8 text-center text-xs text-faint">No persisted closes yet.</p>
                ) : (
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="border-b border-line text-[10px] tracking-wider text-faint uppercase">
                      <tr>
                        <th className="pb-2 font-normal">Closed</th>
                        <th className="pb-2 font-normal">Symbol</th>
                        <th className="pb-2 font-normal">Venue</th>
                        <th className="pb-2 font-normal">Reason</th>
                        <th className="pb-2 text-right font-normal">Net PnL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/30">
                      {archiveRows.map((t) => (
                        <tr key={t.id} className="hover:bg-panel-2/50">
                          <td className="py-2 text-faint">{new Date(t.closedAt).toLocaleString()}</td>
                          <td className="py-2 font-bold text-cream">{t.symbol}</td>
                          <td className="py-2 text-faint">{t.venue}</td>
                          <td className="py-2 text-faint">{t.reason}</td>
                          <td className={cn("py-2 text-right font-bold", t.pnl >= 0 ? "text-gain" : "text-loss")}>
                            {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-line p-3">
                <Button
                  variant="ghost"
                  disabled={archivePage === 0 || archiveBusy}
                  onClick={() => openArchive(archivePage - 1)}
                  className="h-9 text-xs"
                >
                  ← Newer
                </Button>
                <span className="text-xs text-faint">
                  Page {archivePage + 1} of {Math.max(1, Math.ceil(archiveTotal / ARCHIVE_PAGE_SIZE))}
                </span>
                <Button
                  variant="ghost"
                  disabled={archiveBusy || (archivePage + 1) * ARCHIVE_PAGE_SIZE >= archiveTotal}
                  onClick={() => openArchive(archivePage + 1)}
                  className="h-9 text-xs"
                >
                  Older →
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Live Tape Signals — real-time scored candidates from live feeds */}
      <Card className="border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <Label>Live Tape Signals</Label>
            <p className="text-xs text-faint">
              Real-time scored candidates from live feeds — price, 24h move, volume and score update as the tape refreshes.
            </p>
          </div>
        </div>

        {tape.length === 0 ? (
          <p className="py-8 text-center text-xs text-faint">
            No live tape yet — feeds are unreachable or still loading. No signals are shown rather than estimated ones.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line/40">
            {[...tape]
              .sort((a, b) => b.score - a.score)
              .slice(0, 14)
              .map((c) => (
                <li key={c.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold text-cream">
                      {c.symbol}{" "}
                      <span className="text-xs font-normal text-faint">
                        ({c.venue === "binance" ? "Binance" : c.chain})
                      </span>
                    </p>
                    <p className="font-mono text-xs text-cream">
                      ${c.priceUsd >= 1 ? c.priceUsd.toFixed(2) : c.priceUsd.toPrecision(4)}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-lg border border-line bg-panel-2 p-2">
                      <p className="text-[10px] text-faint uppercase">Score</p>
                      <p className="font-mono text-xs font-semibold text-brass">{c.score}/100</p>
                    </div>
                    <div className="rounded-lg border border-line bg-panel-2 p-2">
                      <p className="text-[10px] text-faint uppercase">24h move</p>
                      <p className={cn("font-mono text-xs font-semibold", c.change24h >= 0 ? "text-gain" : "text-loss")}>
                        {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(2)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-line bg-panel-2 p-2">
                      <p className="text-[10px] text-faint uppercase">24h volume</p>
                      <p className="font-mono text-xs text-cream">${Math.round(c.volume24h).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-line bg-panel-2 p-2">
                      <p className="text-[10px] text-faint uppercase">Flags</p>
                      <p className="truncate text-[11px] text-faint">
                        {c.flags.length ? c.flags.join(" · ") : c.rationale[0] ?? "—"}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
}


