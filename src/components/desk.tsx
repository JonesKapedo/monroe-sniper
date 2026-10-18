import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crosshair,
  Globe2,
  Pause,
  Play,
  RefreshCw,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useFeedHealth } from "@/lib/feeds/status";
import { formatNairobiTime } from "@/lib/sniper/nairobi-time";
import { scanAllAvenues, tapeContextFor } from "@/lib/avenues/engine";
import { stakeBudgetFor } from "@/lib/sniper/tier-config";
import type { AvenueCategory, AvenueOpportunity } from "@/lib/avenues/types";
import {
  equity,
  exposure,
  portfolioLines,
  DEMO_START,
  type Candidate,
} from "@/lib/paper";
import { useDesk } from "@/lib/desk-store";
import { loadFeeds } from "@/lib/market.functions";
import { Button, Card, Label } from "@/components/ui";
import { WalletButton } from "@/components/wallet-modal";
import { Money, capitalMoodClass } from "@/components/money";
import { cn } from "@/lib/cn";
import { StandbyPositionsModal } from "@/components/standby-positions-modal";
import { useMascot } from "@/lib/mascot";
import { EquityDashboard } from "@/components/equity-dashboard";
import { AvenuesTable } from "@/components/avenues-table";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const px = (n: number) => {
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${n.toPrecision(4)}`;
};

function formatCountdown(target: number | null, now: number): string {
  if (!target) return "--:--";
  const ms = Math.max(0, target - now);
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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
  const manualEnter = useDesk((s) => s.manualEnter);
  const flatten = useDesk((s) => s.flatten);
  const flattenAll = useDesk((s) => s.flattenAll);
  const resetDemo = useDesk((s) => s.resetDemo);

  const botStartedAt = useDesk((s) => s.botStartedAt);
  const disciplineRules = useDesk((s) => s.disciplineRules);
  const turboPhase = useDesk((s) => s.turboPhase);
  const turboEndsAt = useDesk((s) => s.turboEndsAt);
  const turboCooldownUntil = useDesk((s) => s.turboCooldownUntil);
  const turboEntries = useDesk((s) => s.turboEntries);
  const turboReport = useDesk((s) => s.turboReport);
  const startTurbo = useDesk((s) => s.startTurbo);
  const stopTurbo = useDesk((s) => s.stopTurbo);
  const bypassTurboCooldown = useDesk((s) => s.bypassTurboCooldown);
  const manualHalt = useDesk((s) => s.manualHalt);
  const manualResume = useDesk((s) => s.manualResume);
  const equityGuardState = useDesk((s) => s.equityGuardState);
  const profitLockState = useDesk((s) => s.profitLockState);
  const currentTier = useDesk((s) => s.currentTier);
  const getReadiness = useDesk((s) => s.getReadiness);
  const riskSettings = useDesk((s) => s.riskSettings);
  const readiness = getReadiness ? getReadiness() : null;

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [filterVenue, setFilterVenue] = useState<"all" | "binance" | "dex">("all");
  const [avenueFilter, setAvenueFilter] = useState<"ALL" | AvenueCategory>("ALL");
  const [showReadinessModal, setShowReadinessModal] = useState(false);
  const [showStandbyModal, setShowStandbyModal] = useState(false);

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
  const perpFunding = useDesk((s) => s.perpFunding);
  const avenues = scanAllAvenues(book, disciplineRules, nowTs, { funding: perpFunding, tape });

  const scan = useCallback(async (q: string) => {
    setBusy(true);
    try {
      const res = await loadFeeds({ data: { query: q } });
      const combined = [...res.binance, ...res.dex, ...res.reference];
      useFeedHealth.getState().setRows(res.health);
      if (combined.length) {
        setTape(combined, res.note);
      } else {
        setTape([], res.note || "No public market data is currently available.");
      }
    } catch {
      setTape([], "Public market data unavailable. No fallback prices are used.");
    } finally {
      setBusy(false);
    }
  }, [setTape]);

  const snipeAvenue = useCallback(
    (opp: AvenueOpportunity) => {
      // Manual snipes use the same live tape context as the bot — no entry
      // without a live quote for the anchor.
      const ctx = tapeContextFor(opp.anchorSymbol, tape);
      if (!ctx) return;
      const aveCand: Candidate = {
        id: opp.id,
        symbol: opp.symbol,
        name: opp.symbol,
        address: opp.id,
        chain: opp.chain,
        venue: opp.venueA.toLowerCase().includes("binance") ? "binance" : "dex",
        priceUsd: opp.priceA,
        change24h: ctx.change24h,
        volume24h: ctx.volume24h,
        liquidityUsd: ctx.liquidityUsd ?? 0,
        liquidityUnknown: ctx.liquidityUnknown || undefined,
        score: opp.confidenceScore,
        pairAgeHours: null,
        url: null,
        flags: [],
        rationale: [opp.title, ...(opp.disciplineNotes ?? [])],
      };
      manualEnter(aveCand);
    },
    [manualEnter, tape],
  );

  // Initial feed load
  useEffect(() => {
    void scan("");
  }, [scan]);

  const toggleBotPower = () => {
    if (!power) {
      setPower(true);
      try {
        useMascot.getState().react("arm-bot");
      } catch {
        // mascot is UI-only
      }
      return;
    }
    setPower(false);
    try {
      useMascot.getState().react("disarm-bot");
    } catch {
      // mascot is UI-only
    }
    if (useDesk.getState().demo.positions.length) setShowStandbyModal(true);
  };

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
              {mode === "live" ? "Legacy state locked" : `Paper simulation ($${DEMO_START})`}
            </span>
          </div>
          <p className="mt-1 text-xs text-faint md:text-sm">
            {mode === "live"
              ? "Live execution is unavailable. This app has no broker connection and cannot move real funds."
              : `Paper environment. Starts at $${DEMO_START}. Simulated closes train the paper risk threshold.`}
          </p>
        </div>

        {/* Mode Switch Button & Power Button */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Trading mode (paper) — separated from wallet connection */}
          <div
            className="flex items-center rounded-xl border border-line bg-panel-2 p-1"
            title="Paper simulation mode. Live execution stays locked."
          >
            <button
              type="button"
              onClick={() => setMode("demo")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                mode === "demo" ? "bg-brass text-ink shadow-sm" : "text-faint hover:text-cream",
              )}
            >
              Paper trading
            </button>
          </div>

          {/* Wallet connection — distinct zone */}
          <div
            className="flex items-center rounded-xl border border-brass/30 bg-brass/5 p-1"
            title="Connect a read-only wallet for balance awareness. Trading stays paper-only."
          >
            <WalletButton compact />
          </div>

          {/* Arm / Disarm Bot */}
          <Button
            variant={power ? "solid" : "ghost"}
            onClick={toggleBotPower}
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

          {/* Turbo mode with kill switch */}
          {turboPhase === "off" ? (
            <Button
              variant="ghost"
              onClick={() => {
                const res = startTurbo();
                try {
                  if (res.ok) useMascot.getState().react("turbo-start");
                } catch {
                  // mascot is UI-only
                }
              }}
              className="border-loss/50 font-semibold text-loss hover:bg-loss/10"
              title="34-minute max-aggression run. Safety gates stay armed."
            >
              Turbo
            </Button>
          ) : (
            <span
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold",
                turboPhase === "running"
                  ? "border-loss/60 bg-loss/10 text-loss"
                  : "border-amber-500/50 bg-amber-500/10 text-amber-300",
              )}
              title={turboPhase === "running" ? "Turbo run in progress" : "Turbo cooling — entries halted"}
            >
              {turboPhase === "running" ? `TURBO ${formatCountdown(turboEndsAt, nowTs)}` : `COOL ${formatCountdown(turboCooldownUntil, nowTs)}`}
              {turboPhase === "running" && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Stop the turbo run now? Profile restores, bot stays armed.")) {
                      stopTurbo();
                    }
                  }}
                  className="ml-1 rounded bg-loss px-1.5 py-0.5 text-[10px] font-bold text-ink hover:bg-loss/80"
                  title="Kill switch: stop turbo immediately"
                >
                  STOP
                </button>
              )}
            </span>
          )}
          {turboPhase === "cooling" && (
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm("Bypass the 10-minute turbo cooldown? New entries resume immediately.")) {
                  bypassTurboCooldown();
                }
              }}
              className="border border-line text-xs text-faint hover:text-cream"
              title="Resume entries now (logged)"
            >
              Bypass cooldown
            </Button>
          )}

          {/* Refresh Feeds */}
          <Button variant="ghost" onClick={() => scan(query)} disabled={busy} title="Scan global feeds">
            <RefreshCw className={cn("size-4", busy && "animate-spin")} />
          </Button>

          {/* 5-min engine cycle: market + whale refresh, guard, profit lock, persist */}
          <Button
            variant="ghost"
            onClick={async () => {
              setBusy(true);
              try {
                const { runTradingCycle } = await import("@/functions/trading-engine");
                const res = await runTradingCycle({ data: undefined as never });
                useDesk.setState((prev) => ({
                  note: res.note,
                  log: [`Engine cycle: ${res.note}`, ...prev.log].slice(0, 50),
                }));
                if (res.profitLocked > 0) {
                  try {
                    useMascot.getState().react("profit-lock");
                  } catch {
                    // mascot is UI-only
                  }
                }
              } catch {
                useDesk.setState((prev) => ({
                  note: "Engine cycle failed — market scan continues locally.",
                  log: ["Engine cycle failed.", ...prev.log].slice(0, 50),
                }));
              } finally {
                await scan(query);
                setBusy(false);
              }
            }}
            disabled={busy}
            title="Run 5-min engine cycle: refresh market + whales, apply guard + profit lock, save to DB"
          >
            <Clock className={cn("size-4", busy && "animate-spin")} />
            <span className="ml-1 hidden text-xs sm:inline">5-min cycle</span>
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

          {/* Global kill switch */}
          {equityGuardState.isHalted ? (
            <Button
              variant="solid"
              onClick={() => manualResume()}
              className="bg-gain font-semibold text-ink hover:bg-gain/90"
              title={equityGuardState.haltReason ?? "Resume trading"}
            >
              Resume
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm("Halt all new entries? Open positions ride to exits.")) {
                  manualHalt("Operator global halt", 60);
                  try {
                    useMascot.getState().react("halt-triggered");
                  } catch {
                    // mascot is UI-only
                  }
                }
              }}
              className="border-loss/50 font-semibold text-loss hover:bg-loss/10"
              title="Global kill switch: block all new entries"
            >
              Halt all
            </Button>
          )}
        </div>
      </div>

      {/* Equity protection: profit lock + tier + guard */}
      <EquityDashboard />

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

        {/* Paper risk history */}
        {readiness && (
          <div className="flex items-center gap-3 border-t border-line/60 pt-2 sm:border-t-0 sm:pt-0">
            <div className="text-left sm:text-right">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-faint">Paper discipline:</span>
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
                {readiness.completedDemoTrades}/{readiness.targetDemoTrades} paper closes · {readiness.currentWinRatePct}% win rate
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => setShowReadinessModal(true)}
              className="h-8 border border-line px-2.5 text-xs text-brass hover:border-brass"
            >
              <ShieldCheck className="mr-1 size-3.5" />               Review paper history
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label={`${mode.toUpperCase()} EQUITY`}
          value={<Money value={eq} kind="balance" className={`text-lg font-bold sm:text-xl ${capitalMoodClass(book.dayPnl)}`} />}
          sub="Paper balance"
        />
        <StatCard
          label="DAY P&L"
          value={<Money value={book.dayPnl} kind="delta" className="text-lg font-bold sm:text-xl" />}
          tone={book.dayPnl >= 0 ? "gain" : "loss"}
          sub={eq > 0 ? `${((book.dayPnl / eq) * 100).toFixed(2)}% ROI` : "0.00%"}
        />
        <StatCard
          label="AVAILABLE CASH"
          value={<Money value={book.cash} kind="balance" className={`text-lg font-bold sm:text-xl ${capitalMoodClass(book.dayPnl)}`} />}
          sub={`Stakable: ${money(Math.max(0, stakeBudgetFor(eq).budget - exp))} of ${money(stakeBudgetFor(eq).budget)} budget`}
        />
        <StatCard
          label="HIT RATE"
          value={book.trades.length > 0 ? `${hitRate.toFixed(1)}%` : "—"}
          sub={`${book.trades.length} closed trades`}
        />
        <StatCard
          label="OPEN RISK"
          value={<Money value={exp} kind="balance" className={`text-lg font-bold sm:text-xl ${capitalMoodClass(book.dayPnl)}`} />}
          sub={`${book.positions.length} positions · $${exp.toFixed(0)} of $${stakeBudgetFor(eq).budget.toFixed(0)} budget`}
        />
        <StatCard
          label="ADAPTIVE BRAIN"
          value={`${memory.minScore}/100`}
          sub={memory.seen >= 4 ? `Tuned on ${memory.seen} trades` : "Initial threshold"}
          accent
        />
      </div>

      {/* Turbo run debrief: what the run (and cooldown) taught the bot */}
      {turboReport && turboPhase !== "off" && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-loss/40 bg-loss/5 px-4 py-3 text-xs">
          <span className="font-bold text-loss">
            🔥 {turboPhase === "running" ? "Turbo running" : "Turbo cooling — entries halted, open positions ride to exits"}
          </span>
          <span className="text-faint">
            Entries this run: <strong className="text-cream">{turboEntries}</strong>
          </span>
          <span className="text-faint">
            Realized:{" "}
            <strong className={memory.realized - turboReport.startRealized >= 0 ? "text-gain" : "text-loss"}>
              {(memory.realized - turboReport.startRealized >= 0 ? "+" : "")}$
              {(memory.realized - turboReport.startRealized).toFixed(2)}
            </strong>
          </span>
          <span className="text-faint">
            Score floor: <strong className="text-brass">{turboReport.startMinScore} → {memory.minScore}</strong>
          </span>
          <span className="text-faint">
            Closes banked: <strong className="text-cream">{memory.seen - turboReport.startSeen}</strong>
          </span>
        </div>
      )}

      {/* Main Grid: Open Positions & Execution Stream */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left Column: Active Positions (2 cols) */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Active positions ({book.positions.length})</Label>
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
                          {p.markSimulated && (
                            <span title="Priced by simulated drift — no live quote for this avenue" className="rounded bg-brass/15 px-1.5 py-0.5 text-[10px] font-semibold text-brass">
                              SIM
                            </span>
                          )}
                        </div>
                        <p className="num mt-0.5 text-xs text-faint">
                          Entry {px(p.entryPrice)} · Mark {px(p.mark)} · Stop {px(p.stop)} · Take Profit {px(targetPx)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="text-right">
                          <Money
                            value={pnl}
                            kind="delta"
                            className="text-sm font-bold"
                          />
                          <p className={cn("num text-[11px]", pnlPct >= 0 ? "text-gain" : "text-loss")}>
                            ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
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
          <Card className="flex flex-col justify-center px-3 py-4">
            <p className="text-[11px] text-faint">
              Live telemetry lives in the <span className="text-brass">Feed</span> strip under the top bar -- expand anytime from any page.
            </p>
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

      <AvenuesTable
        avenues={avenues}
        book={book}
        onSnipe={snipeAvenue}
        maxSlots={riskSettings?.maxPositions ?? 4}
      />

      {/* Paper-performance audit modal */}
      {showReadinessModal && readiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-brass/10 text-brass">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-cream">Paper Performance Review</h3>
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
              <div className="text-xs text-faint">Paper discipline score</div>
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

      <StandbyPositionsModal
        isOpen={showStandbyModal}
        onClose={() => setShowStandbyModal(false)}
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
  value: React.ReactNode;
  sub: string;
  tone?: "gain" | "loss";
  accent?: boolean;
}) {
  return (
    <Card className={cn(accent && "border-brass/40 bg-panel")}>
      <p className="text-[10px] tracking-wider text-faint uppercase">{label}</p>
      <p
        className={cn(
          "num mt-1 text-lg font-bold text-gain sm:text-xl",
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
