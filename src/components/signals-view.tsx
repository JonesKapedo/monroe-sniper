import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/desk-store";
import { equity } from "@/lib/paper";
import { Card } from "@/components/ui";

const EXIT_PAGE_SIZE = 50;
const ENTRY_PAGE_SIZE = 50;

export function SignalsView() {
  const tape = useDesk((s) => s.tape);
  const mode = useDesk((s) => s.mode);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const executions = useDesk((s) => s.executions);
  const dbEvents = useDesk((s) => s.dbEvents);
  const getReadiness = useDesk((s) => s.getReadiness);

  const activeBook = mode === "live" ? live : demo;
  const activeEq = equity(activeBook);

  const [historyTab, setHistoryTab] = useState<"ALL" | "ENTRIES" | "EXITS">("ALL");
  const [resultFilter, setResultFilter] = useState<"ALL" | "WIN" | "LOSS">("ALL");
  const [query, setQuery] = useState("");

  const readiness = getReadiness ? getReadiness() : null;

  // Lightweight history stats from closed trades + executions (display only).
  const closed = activeBook.trades ?? [];
  const totalTrades = closed.length;
  const wins = closed.filter((t) => t.pnl > 0).length;
  const losses = closed.filter((t) => t.pnl < 0).length;
  const winRate = totalTrades ? Math.round((wins / totalTrades) * 100) : 0;
  const totalRealizedPnl = closed.reduce((s, t) => s + t.pnl, 0);
  const grossWin = closed.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(closed.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
  const profitFactor =
    grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : grossWin > 0 ? "∞" : "—";

  const filteredEntries = useMemo(() => {
    const rows = executions.filter((e) => e.type === "BOT_ENTRY" || e.side === "BUY");
    const q = query.trim().toUpperCase();
    return rows
      .filter((e) => (!q || e.symbol.toUpperCase().includes(q)))
      .slice(0, ENTRY_PAGE_SIZE);
  }, [executions, query]);

  const filteredExits = useMemo(() => {
    const rows = closed.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      venue: typeof t.venue === "string" ? t.venue : "—",
      holdingTime: "—",
      reason: t.reason,
      reasonBadge:
        t.reason === "TP" || t.reason === "TARGET"
          ? "TARGET"
          : t.reason === "SL" || t.reason === "STOP"
            ? "STOP"
            : t.reason === "TIME" || t.reason === "EXPIRY"
              ? "TIME"
              : t.reason === "MANUAL"
                ? "MANUAL"
                : "SIGNAL",
      pnlPct:
        t.entryPrice && t.exitPrice && t.entryPrice > 0
          ? ((t.exitPrice - t.entryPrice) / t.entryPrice) * 100
          : null,
      pnlUsd: t.pnl,
    }));
    const q = query.trim().toUpperCase();
    return rows
      .filter((x) => {
        if (q && !x.symbol.toUpperCase().includes(q)) return false;
        if (resultFilter === "WIN" && !(x.pnlUsd > 0)) return false;
        if (resultFilter === "LOSS" && !(x.pnlUsd < 0)) return false;
        return true;
      })
      .slice(0, EXIT_PAGE_SIZE);
  }, [closed, query, resultFilter]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl text-cream">Signals</h1>
        <p className="mt-1 text-sm text-faint">
          Live tape ranked by score · paper equity ${activeEq.toFixed(2)}{" "}
          <span className="text-faint ml-1.5 font-mono">(${activeBook.cash.toFixed(2)} cash)</span>
        </p>
        {readiness && (
          <p className="mt-2 text-[11px] text-brass font-mono">
            Paper discipline {readiness.readinessScore}% · {readiness.completedDemoTrades ?? 0} qualifying
          </p>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-full border border-line bg-panel-2 p-0.5">
            {(["ALL", "ENTRIES", "EXITS"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setHistoryTab(tab)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  historyTab === tab ? "bg-brass text-ink" : "text-faint hover:text-cream",
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search symbol (e.g. SOL, BTC)..."
                className="field h-8 pl-8 pr-3 text-xs w-48 rounded-lg border-line bg-panel-2 text-cream outline-none focus:border-brass"
              />
            </div>
            {historyTab !== "ENTRIES" && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-faint">Result:</span>
                {(["ALL", "WIN", "LOSS"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setResultFilter(filter)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      resultFilter === filter
                        ? "bg-brass text-ink"
                        : "bg-panel-2 text-faint hover:text-cream",
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="rounded-xl border border-line bg-panel-2 p-3">
            <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">Trades</span>
            <p className="font-mono text-lg font-bold text-cream mt-0.5">{totalTrades}</p>
          </div>
          <div className="rounded-xl border border-line bg-panel-2 p-3">
            <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">Win rate</span>
            <p className={cn("font-mono text-lg font-bold mt-0.5", winRate >= 50 ? "text-gain" : "text-amber-400")}>
              {winRate}%
            </p>
          </div>
          <div className="rounded-xl border border-line bg-panel-2 p-3">
            <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">Realized</span>
            <p className={cn("font-mono text-lg font-bold mt-0.5", totalRealizedPnl >= 0 ? "text-gain" : "text-loss")}>
              {totalRealizedPnl >= 0 ? "+" : ""}${totalRealizedPnl.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-panel-2 p-3">
            <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">Profit factor</span>
            <p className="font-mono text-lg font-bold text-cream mt-0.5">{profitFactor}</p>
          </div>
          <div className="rounded-xl border border-line bg-panel-2 p-3">
            <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">W / L</span>
            <p className="font-mono text-lg font-bold text-brass mt-0.5">
              {wins}/{losses}
            </p>
          </div>
        </div>
      </Card>

      {/* Live tape */}
      <Card>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-cream uppercase tracking-wider">Live tape</h3>
          <span className="text-[11px] text-faint">
            Computed live per symbol · {tape.length} symbols
          </span>
        </div>

        {!tape.length ? (
          <p className="mt-4 py-6 text-center text-xs text-faint">
            No live tape yet — feeds are unreachable or still loading. No signals are shown rather than estimated ones.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line/40">
            {[...tape]
              .sort((a, b) => b.score - a.score)
              .slice(0, 14)
              .map((c) => {
                const venueLabel = c.venue === "binance" ? "Binance" : c.chain;
                const flagText = c.flags.length
                  ? c.flags.slice(0, 4).join(" · ")
                  : (c.rationale?.[0] ?? "Ordinary tape; size only if the gate clears");
                const symbolLabel =
                  c.symbol.length > 28 ? `${c.symbol.slice(0, 26)}…` : c.symbol;
                return (
                  <li key={c.id} className="py-3">
                    <div className="flex min-w-0 items-baseline justify-between gap-3">
                      <p
                        className="min-w-0 truncate font-semibold text-cream"
                        title={`${c.symbol} (${venueLabel})`}
                      >
                        {symbolLabel}{" "}
                        <span className="text-xs font-normal text-faint">({venueLabel})</span>
                      </p>
                      <p className="shrink-0 font-mono text-xs text-cream">
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
                        <p
                          className={cn(
                            "font-mono text-xs font-semibold",
                            c.change24h >= 0 ? "text-gain" : "text-loss",
                          )}
                        >
                          {c.change24h >= 0 ? "+" : ""}
                          {c.change24h.toFixed(2)}%
                        </p>
                      </div>
                      <div className="rounded-lg border border-line bg-panel-2 p-2">
                        <p className="text-[10px] text-faint uppercase">24h volume</p>
                        <p className="font-mono text-xs text-cream">
                          ${Math.round(c.volume24h).toLocaleString()}
                        </p>
                      </div>
                      <div className="min-w-0 rounded-lg border border-line bg-panel-2 p-2">
                        <p className="text-[10px] text-faint uppercase">Flags</p>
                        <p className="truncate text-[11px] text-faint" title={flagText}>
                          {flagText}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </Card>
    </div>
  );
}
