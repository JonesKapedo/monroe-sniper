import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Clock,
  LayoutDashboard,
  LogOut,
  Radar,
  ScanSearch,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { catchUpTicks } from "@/lib/sniper/catchup";
import { sessionClock } from "@/lib/sniper/format";
import { formatNairobiTime } from "@/lib/sniper/nairobi-time";
import { hashPin } from "@/lib/sniper/wallet";
import { useSniper } from "@/lib/sniper/store";
import { useDesk } from "@/lib/desk-store";
import { useSupabaseGate } from "@/lib/supabase-gate";
import { getSupabase } from "@/lib/supabase";
import { LoginView } from "@/components/login-view";
import { useDyorStore } from "@/lib/dyor/store";
import { equity } from "@/lib/paper";
import { Button } from "@/components/ui";
import { Mascot } from "@/components/mascot";
import { defaultSettings } from "@/lib/sniper/types";
import { LiveModeTransitionModal } from "@/components/live-mode-transition-modal";
import { StandbyPositionsModal } from "@/components/standby-positions-modal";
import { getDbHealth, getTradeLearningEvents } from "@/lib/trade-memory.functions";

import { loadFeeds } from "@/lib/market.functions";

const NAV = [
  { to: "/", label: "Desk", short: "Desk", icon: LayoutDashboard },
  { to: "/tape", label: "Tape", short: "Tape", icon: Activity },
  { to: "/signals", label: "Signals", short: "Feed", icon: Radar },
  { to: "/opportunities", label: "Scanner", short: "Scan", icon: ScanSearch },
  { to: "/learn", label: "DYOR", short: "DYOR", icon: Search },
  { to: "/wallet", label: "Wallet", short: "Funds", icon: Wallet },
  { to: "/settings", label: "Settings", short: "Setup", icon: SlidersHorizontal },
] as const;

export function Frame({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const gate = useSupabaseGate();
  const signedIn = gate.status === "signed-in";

  useEffect(() => {
    if (!signedIn) return;
    let cancel = false;
    let timer = 0;
    let tickCount = 0;
    const loop = async () => {
      if (cancel) return;
      const sniperBook = useSniper.getState().book;
      const interval = Math.max(1, sniperBook.settings.scanSeconds) * 1000;
      const desk = useDesk.getState();
      tickCount++;

      if (desk.power) {
        const due = catchUpTicks(Date.now(), sniperBook.lastWall, sniperBook.settings.scanSeconds);
        if (due > 0) useSniper.getState().runTicks(due);
      } else {
        useSniper.getState().runTicks(0);
      }

      // Standby refreshes held-position marks without applying automatic exits.
      if ((desk.power || desk.demo.positions.length > 0) && tickCount % 3 === 0) {
        try {
          const feeds = await loadFeeds({ data: {} });
          const combined = [...feeds.binance, ...feeds.dex];
          if (combined.length) {
            const current = useDesk.getState();
            current.setTape(combined, feeds.note);
            const prices: Record<string, number> = {};
            for (const c of combined) {
              prices[c.id] = c.priceUsd;
            }
            if (current.power) current.tick(prices);
            else if (current.demo.positions.length > 0) current.tick(prices, true);
          }
        } catch {
          // Graceful fallback during momentary rate limit
        }
      }

      // Auto-step desk sniper if power is on
      if (useDesk.getState().power) useDesk.getState().autoStep();

      timer = window.setTimeout(loop, interval);
    };
    void (async () => {
      await Promise.all([
        useSniper.persist.rehydrate(),
        useDesk.persist.rehydrate(),
        useDyorStore.persist.rehydrate(),
      ]);
      if (cancel) return;
      setReady(true);
      void getDbHealth()
        .then((health) => {
          if (!health.ok || !health.state) {
            throw new Error(health.error ?? "Trade learning tables returned no state.");
          }
          const state = health.state;
          useDesk.getState().restoreLearningState(
            {
              seen: state.seen,
              wins: state.wins,
              losses: state.losses,
              realized: state.realized,
              minScore: state.minScore,
            },
            health.events,
            health.source,
          );
          useDesk.getState().setDbHistory([], health.grossWin, health.grossLoss);
          // Pull the persisted closes: they feed the Learn history panel and
          // keep readiness honest across devices and browser resets.
          return getTradeLearningEvents({ data: { limit: 200 } });
        })
        .then((pack) => {
          if (!pack) return;
          const desk = useDesk.getState();
          desk.setDbHistory(pack.events, desk.dbGrossWin, desk.dbGrossLoss);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[trade-learning] Failed to restore database learning state:", error);
          useDesk.getState().setDbStatus({ source: "unknown", ok: false, error: message.slice(0, 300) });
          useDesk.setState((desk) => ({
            note: "Database learning state is unavailable; local paper learning remains active.",
            log: [`Database link failed (${message.slice(0, 120)}).`, ...desk.log].slice(
              0,
              50,
            ),
          }));
        });
      loop();
    })();
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [signedIn]);

  if (gate.status === "misconfigured") {
    return <LoginView client={null} misconfigured />;
  }

  if (gate.status === "signed-out") {
    return <LoginView client={gate.client} misconfigured={false} />;
  }

  if (!signedIn || !ready) {
    return (
      <div className="flex min-h-screen flex-col justify-between bg-ink px-6 py-8 text-cream">
        <p className="text-sm tracking-widest text-brass uppercase">Monroe</p>
        <p className="max-w-sm text-2xl font-medium">Opening the paper desk…</p>
      </div>
    );
  }

  return <Shell>{children}</Shell>;
}

function Shell({ children }: { children: ReactNode }) {
  const book = useSniper((s) => s.book);
  const unlocked = useSniper((s) => s.unlocked);
  const locked = Boolean(book.pinHash) && !unlocked;
  const appearance = book.settings.appearance ?? defaultSettings.appearance;

  useEffect(() => {
    document.documentElement.dataset.theme = appearance.theme.toLowerCase();
    const themeColor =
      appearance.theme === "PAPER"
        ? "#f4f1e8"
        : appearance.theme === "MIDNIGHT"
          ? "#000000"
          : "#10120e";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
  }, [appearance.theme]);

  // Real-time ticking clock for Nairobi EAT (UTC+3) timezone
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Read active mode and balances from useDesk
  const mode = useDesk((s) => s.mode);
  const setMode = useDesk((s) => s.setMode);
  const power = useDesk((s) => s.power);
  const setPower = useDesk((s) => s.setPower);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const botStartedAt = useDesk((s) => s.botStartedAt);
  const getReadiness = useDesk((s) => s.getReadiness);

  const activeBook = mode === "live" ? live : demo;
  const activeEq = equity(activeBook);
  const nairobi = formatNairobiTime(botStartedAt, nowTs);
  const readiness = getReadiness ? getReadiness() : null;
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [showStandbyModal, setShowStandbyModal] = useState(false);
  const requestStandby = () => {
    if (!power) {
      setPower(true);
      return;
    }
    setPower(false);
    const openPositions = useDesk.getState().demo.positions;
    if (openPositions.length) setShowStandbyModal(true);
  };

  return (
    <div className="min-h-screen bg-ink text-cream md:pl-56">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-panel md:flex">
        <div className="border-b border-line px-5 py-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs tracking-widest text-brass uppercase">
              {appearance.showMascot ? <Mascot className="size-8 shrink-0" /> : null}
              Monroe
            </p>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
                mode === "live"
                  ? "border border-amber-500/40 bg-amber-500/20 text-amber-300"
                  : "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300",
              )}
            >
              {mode === "live" ? "LOCKED" : "PAPER"}
            </span>
          </div>
          <p className="mt-1 text-lg font-medium">Sniper Bot</p>

          {/* Nairobi Timezone Badge in Sidebar */}
          <div
            className="mt-2.5 flex flex-col gap-0.5 rounded-lg border border-line/60 bg-panel-2 px-2.5 py-1.5 text-[11px]"
            suppressHydrationWarning
          >
            <div className="flex items-center justify-between text-brass">
              <span className="font-medium">Nairobi EAT</span>
              <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[10px] font-bold text-emerald-300">
                {nairobi.dayLabel}
              </span>
            </div>
            <div className="font-mono text-[10px] text-faint">
              {nairobi.dateString} · {nairobi.timeString}
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
        </nav>

        {/* Paper discipline progress */}
        {readiness && (
          <div className="border-t border-line px-4 py-3" suppressHydrationWarning>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-faint">Paper Discipline</span>
              <span className="font-semibold text-emerald-400">{readiness.readinessScore}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${readiness.readinessScore}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-faint">
              {readiness.completedDemoTrades}/{readiness.targetDemoTrades} paper trades recorded
            </p>
          </div>
        )}

        <div className="border-t border-line p-3">
          <div className="rounded-lg border border-line bg-panel-2 p-2.5" suppressHydrationWarning>
            <div className="flex items-center justify-between text-xs text-faint">
              <span>Active Mode</span>
              <span
                className={mode === "live" ? "text-amber-400 font-medium" : "text-gain font-medium"}
              >
                {mode === "live" ? "Legacy state locked" : "Paper simulation"}
              </span>
            </div>
            <p className="num mt-1 text-base font-semibold text-cream">${activeEq.toFixed(2)}</p>
          </div>
        </div>
        <p className="px-5 py-3 text-[11px] text-faint">
          Paper-only trading simulator with automated risk controls.
        </p>
      </aside>

      <div className="flex min-h-screen flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-ink/95 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur sm:gap-3 md:px-8">
          {/* Nairobi EAT (UTC+3) Clock & Active Day Header */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-2 text-brass">
              <Clock className="size-4" />
            </div>
            <div className="min-w-0" suppressHydrationWarning>
              <div className="flex items-center gap-1.5">
                <span className="whitespace-nowrap text-[11px] font-semibold tracking-wider text-brass uppercase">
                  <span className="sm:hidden">Nairobi EAT</span>
                  <span className="hidden sm:inline">Nairobi EAT (UTC+3)</span>
                </span>
                <span className="max-[359px]:hidden rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-300">
                  <span className="sm:hidden">{nairobi.dayLabel.replace(" Active", "")}</span>
                  <span className="hidden sm:inline">{nairobi.dayLabel}</span>
                </span>
              </div>
              <p className="truncate font-mono text-xs font-medium text-cream md:text-sm">
                {nairobi.dateString} · {nairobi.timeString}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Paper discipline summary */}
            {readiness && (
              <div
                title={`${readiness.completedDemoTrades} paper trades recorded`}
                className="hidden items-center gap-2 rounded-full border border-line bg-panel-2 px-3 py-1 lg:flex"
                suppressHydrationWarning
              >
                <ShieldCheck className="size-3.5 text-brass" />
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-faint">Paper discipline:</span>
                  <span
                    className={cn(
                      "font-semibold",
                      readiness.readinessScore >= 85 ? "text-gain" : "text-amber-400",
                    )}
                  >
                    {readiness.readinessScore}%
                  </span>
                </div>
              </div>
            )}

            {/* Mode Switcher */}
            <div className="flex items-center rounded-full border border-line bg-panel-2 p-0.5">
              <button
                type="button"
                aria-label="Paper simulation mode"
                onClick={() => setMode("demo")}
                className={cn(
                  "min-h-11 rounded-full px-2 py-1 text-[11px] font-medium transition-colors sm:px-2.5 sm:text-xs",
                  mode === "demo"
                    ? "bg-brass text-ink font-semibold shadow-xs"
                    : "text-faint hover:text-cream",
                )}
              >
                <span className="sm:hidden" aria-hidden="true">
                  Demo
                </span>
                <span className="hidden sm:inline">Paper</span>
              </button>
              <button
                type="button"
                aria-label="Live trading unavailable. View connection status."
                onClick={() => setShowLiveModal(true)}
                className="min-h-11 rounded-full px-2 py-1 text-[11px] font-medium text-faint transition-colors hover:text-cream sm:px-2.5 sm:text-xs"
              >
                <span className="sm:hidden" aria-hidden="true">
                  Live off
                </span>
                <span className="hidden sm:inline">Live unavailable</span>
              </button>
            </div>

            {/* Active Equity Display */}
            <div className="hidden text-right font-mono sm:block" suppressHydrationWarning>
              <span className="text-[10px] tracking-wider text-faint uppercase">
                Paper balance:
              </span>{" "}
              <span className="text-sm font-semibold text-cream">${activeEq.toFixed(2)}</span>
            </div>
            <DbBadge />

            {/* Power / Armed Button */}
            <button
              type="button"
              aria-label={power ? "Disarm paper bot" : "Arm paper bot"}
              onClick={requestStandby}              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-2 text-xs font-medium transition-colors sm:gap-2 sm:px-3",
                power
                  ? mode === "live"
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                    : "border-gain/50 bg-gain/10 text-gain"
                  : "border-line bg-panel text-faint hover:text-cream",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  power
                    ? mode === "live"
                      ? "bg-amber-400 pulse-dot"
                      : "bg-gain pulse-dot"
                    : "bg-faint",
                )}
              />
              {power ? (
                <>
                  <span className="sm:hidden">Armed</span>
                  <span className="hidden sm:inline">Paper bot armed</span>
                </>
              ) : (
                "Standby"
              )}
            </button>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => void getSupabase()?.auth.signOut()}
              className="inline-flex min-h-11 items-center rounded-full border border-line bg-panel px-2.5 text-faint transition-colors hover:text-cream"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        {/* Keep restored legacy live state visibly identified as simulation-only. */}
        {mode === "live" && (
          <div className="flex items-center justify-between border-b border-amber-500/40 bg-panel-2 px-4 py-2 text-xs md:px-8">
            <span className="font-semibold text-amber-300">
              Live execution is unavailable. This session is simulation-only.
            </span>
            <button
              type="button"
              onClick={() => setMode("demo")}
              className="min-h-11 rounded bg-panel px-3 text-[11px] font-semibold text-cream hover:bg-panel-2"
            >
              Return to paper mode
            </button>
          </div>
        )}

        <main className="flex-1 px-4 py-4 md:px-8 md:py-6">
          {locked ? <LockScreen /> : children}
        </main>

        <LiveModeTransitionModal isOpen={showLiveModal} onClose={() => setShowLiveModal(false)} />
        <StandbyPositionsModal
          isOpen={showStandbyModal}
          onClose={() => setShowStandbyModal(false)}
        />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((item) => (
          <NavLink key={item.to} {...item} compact />
        ))}
      </nav>
    </div>
  );
}

function DbBadge() {
  const source = useDesk((s) => s.dbSource);
  const ok = useDesk((s) => s.dbOk);
  const count = useDesk((s) => s.tradeLearningDbCount);
  const error = useDesk((s) => s.dbError);
  const label =
    source === "neon" ? "Neon" : source === "pglite" ? "Local DB" : "DB…";
  const title = ok
    ? `${label} linked · ${count} learning rows`
    : (error ?? "Database link not verified yet.");
  return (
    <span
      title={title}
      className={cn(
        "hidden rounded-full border px-2.5 py-1 text-[11px] font-semibold lg:inline-flex lg:items-center lg:gap-1.5",
        ok && source === "neon" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
        ok && source !== "neon" && "border-line bg-panel-2 text-faint",
        !ok && "border-amber-500/40 bg-amber-500/10 text-amber-300",
      )}
      suppressHydrationWarning
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          ok ? "bg-emerald-400" : "bg-amber-400",
        )}
      />
      {ok ? `${label} · ${count}` : `${label} offline`}
    </span>
  );
}

function NavLink({
  to,
  label,
  short,
  icon: Icon,
  compact = false,
}: {
  to: (typeof NAV)[number]["to"];
  label: string;
  short: string;
  icon: (typeof NAV)[number]["icon"];
  compact?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const on = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        compact
          ? "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs"
          : "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm",
        on ? "bg-panel-2 text-cream" : "text-faint hover:text-cream",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {compact ? short : label}
    </Link>
  );
}

function LockScreen() {
  const book = useSniper((s) => s.book);
  const unlock = useSniper((s) => s.unlock);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [misses, setMisses] = useState(0);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-10">
      <p className="text-xs tracking-widest text-brass uppercase">Desk locked</p>
      <h1 className="text-3xl font-medium">Enter the PIN</h1>
      <p className="text-sm text-faint">
        The simulator keeps stepping behind this lock. The PIN only guards this browser. It is not a
        bank login.
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (wait > 0) return;
          void hashPin(pin).then((hash) => {
            if (hash === book.pinHash) {
              setError("");
              unlock();
              return;
            }
            const next = misses + 1;
            setMisses(next);
            setPin("");
            if (next >= 5) {
              setWait(20);
              setMisses(0);
              setError("Too many tries. Wait 20 seconds.");
              return;
            }
            setError("That PIN does not match.");
          });
        }}
      >
        <input
          className="field"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={pin}
          aria-label="Desk PIN"
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        {error ? <p className="text-sm text-loss">{error}</p> : null}
        <Button type="submit" disabled={pin.length < 4 || wait > 0}>
          {wait > 0 ? `Wait ${wait}s` : "Unlock"}
        </Button>
      </form>
    </div>
  );
}
