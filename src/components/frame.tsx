import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Clock,
  LayoutDashboard,
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
import { useDyorStore } from "@/lib/dyor/store";
import { equity } from "@/lib/paper";
import { Button } from "@/components/ui";
import { LiveModeTransitionModal } from "@/components/live-mode-transition-modal";

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

  useEffect(() => {
    let cancel = false;
    let timer = 0;
    let tickCount = 0;
    const loop = async () => {
      if (cancel) return;
      const book = useSniper.getState().book;
      const interval = Math.max(1, book.settings.scanSeconds) * 1000;
      const due = catchUpTicks(Date.now(), book.lastWall, book.settings.scanSeconds);
      if (due > 0) useSniper.getState().runTicks(due);

      const desk = useDesk.getState();
      tickCount++;

      // Continuous background market fetching & simulation training on real prices
      if (desk.power && tickCount % 3 === 0) {
        try {
          const feeds = await loadFeeds({ data: {} });
          const combined = [...feeds.binance, ...feeds.dex];
          if (combined.length) {
            desk.setTape(combined, feeds.note);
            const prices: Record<string, number> = {};
            for (const c of combined) {
              prices[c.id] = c.priceUsd;
            }
            desk.tick(prices);
          }
        } catch {
          // Graceful fallback during momentary rate limit
        }
      }

      // Auto-step desk sniper if power is on
      if (desk.power) {
        desk.autoStep();
      }

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
      loop();
    })();
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!ready) {
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
  const [justActivatedLive, setJustActivatedLive] = useState(false);

  return (
    <div className={cn("min-h-screen bg-ink text-cream md:pl-56 transition-colors duration-700", justActivatedLive && "live-flash-screen")}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-panel md:flex">
        <div className="border-b border-line px-5 py-5">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-widest text-brass uppercase">Monroe</p>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
                mode === "live"
                  ? "border border-amber-500/40 bg-amber-500/20 text-amber-300"
                  : "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300",
              )}
            >
              {mode.toUpperCase()}
            </span>
          </div>
          <p className="mt-1 text-lg font-medium">Sniper Bot</p>

          {/* Nairobi Timezone Badge in Sidebar */}
          <div className="mt-2.5 flex flex-col gap-0.5 rounded-lg border border-line/60 bg-panel-2 px-2.5 py-1.5 text-[11px]" suppressHydrationWarning>
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

        {/* Readiness progress in sidebar */}
        {readiness && (
          <div className="border-t border-line px-4 py-3" suppressHydrationWarning>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-faint">Real Money Readiness</span>
              <span className="font-semibold text-emerald-400">{readiness.readinessScore}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${readiness.readinessScore}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-faint">
              {readiness.completedDemoTrades}/{readiness.targetDemoTrades} demo trades trained
            </p>
          </div>
        )}

        <div className="border-t border-line p-3">
          <div className="rounded-lg border border-line bg-panel-2 p-2.5" suppressHydrationWarning>
            <div className="flex items-center justify-between text-xs text-faint">
              <span>Active Mode</span>
              <span className={mode === "live" ? "text-amber-400 font-medium" : "text-gain font-medium"}>
                {mode === "live" ? "Live Rail" : "Demo Sandbox"}
              </span>
            </div>
            <p className="num mt-1 text-base font-semibold text-cream">${activeEq.toFixed(2)}</p>
          </div>
        </div>
        <p className="px-5 py-3 text-[11px] text-faint">Global sniper desk. Automated risk & execution.</p>
      </aside>

      <div className="flex min-h-screen flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur md:px-8">
          {/* Nairobi EAT (UTC+3) Clock & Active Day Header */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-2 text-brass">
              <Clock className="size-4" />
            </div>
            <div className="min-w-0" suppressHydrationWarning>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold tracking-wider text-brass uppercase">
                  Nairobi EAT (UTC+3)
                </span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-300">
                  {nairobi.dayLabel}
                </span>
              </div>
              <p className="truncate font-mono text-xs font-medium text-cream md:text-sm">
                {nairobi.dateString} · {nairobi.timeString}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Demo Training & Live Readiness Badge */}
            {readiness && (
              <div
                title={readiness.statusMessage}
                className="hidden items-center gap-2 rounded-full border border-line bg-panel-2 px-3 py-1 lg:flex"
                suppressHydrationWarning
              >
                <ShieldCheck className="size-3.5 text-brass" />
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-faint">Demo Training:</span>
                  <span
                    className={cn(
                      "font-semibold",
                      readiness.readinessScore >= 85 ? "text-gain" : "text-amber-400",
                    )}
                  >
                    {readiness.readinessScore}% Ready
                  </span>
                </div>
              </div>
            )}

            {/* Mode Switcher */}
            <div className="flex items-center rounded-full border border-line bg-panel-2 p-0.5">
              <button
                type="button"
                onClick={() => setMode("demo")}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  mode === "demo"
                    ? "bg-brass text-ink font-semibold shadow-xs"
                    : "text-faint hover:text-cream",
                )}
              >
                Demo ($500)
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
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  mode === "live"
                    ? "bg-amber-500 text-ink font-semibold shadow-xs"
                    : "text-faint hover:text-cream",
                )}
              >
                Live (${live.cash.toFixed(0)})
              </button>
            </div>

            {/* Active Equity Display */}
            <div className="hidden text-right font-mono sm:block" suppressHydrationWarning>
              <span className="text-[10px] tracking-wider text-faint uppercase">
                {mode === "live" ? "Live Bal" : "Demo Bal"}:
              </span>{" "}
              <span className={cn("text-sm font-semibold", mode === "live" ? "text-amber-300" : "text-cream")}>
                ${activeEq.toFixed(2)}
              </span>
            </div>

            {/* Power / Armed Button */}
            <button
              type="button"
              onClick={() => setPower(!power)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
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
                  power ? (mode === "live" ? "bg-amber-400 pulse-dot" : "bg-gain pulse-dot") : "bg-faint",
                )}
              />
              {power ? (mode === "live" ? "Live Armed" : "Sniper Armed") : "Standby"}
            </button>
          </div>
        </header>

        {/* Live Mode High-Stakes Banner */}
        {mode === "live" && (
          <div className="flex items-center justify-between border-b border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-panel-2 to-amber-950/60 px-4 py-2 text-xs backdrop-blur md:px-8">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-bold tracking-wider text-amber-300 uppercase">
                ⚡ Live Capital Execution Rail Active
              </span>
              <span className="hidden text-faint md:inline">
                · Non-custodial DEX/CEX execution routing with strict 1.5% ATR sizing
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowLiveModal(true)}
              className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              Deposit Address & Rail Status
            </button>
          </div>
        )}

        <main className="flex-1 px-4 py-4 md:px-8 md:py-6">{locked ? <LockScreen /> : children}</main>

        <LiveModeTransitionModal
          isOpen={showLiveModal}
          onClose={() => setShowLiveModal(false)}
          onConfirm={() => {
            setMode("live");
            setShowLiveModal(false);
            setJustActivatedLive(true);
            setTimeout(() => setJustActivatedLive(false), 2000);
          }}
        />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-panel md:hidden">
        {NAV.map((item) => (
          <NavLink key={item.to} {...item} compact />
        ))}
      </nav>
    </div>
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
        The simulator keeps stepping behind this lock. The PIN only guards this browser. It is not a bank login.
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
