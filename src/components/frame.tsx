import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Clock,
  LayoutDashboard,
  LayoutGrid,
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
import { catchUpTicks, unreplayedMs } from "@/lib/sniper/catchup";
import { sessionClock } from "@/lib/sniper/format";
import { formatNairobiTime } from "@/lib/sniper/nairobi-time";
import { hashPin } from "@/lib/sniper/wallet";
import { useSniper } from "@/lib/sniper/store";
import { useFeedHealth } from "@/lib/feeds/status";
import { useDesk } from "@/lib/desk-store";
import { useSupabaseGate } from "@/lib/supabase-gate";
import { getSupabase } from "@/lib/supabase";
import { LoginView } from "@/components/login-view";
import { useDyorStore } from "@/lib/dyor/store";
import { equity, exposure } from "@/lib/paper";
import { Button } from "@/components/ui";
import { WalletButton, WalletModal } from "@/components/wallet-modal";
import { Money, capitalMoodClass } from "@/components/money";
import { Mascot } from "@/components/mascot";
import { defaultSettings } from "@/lib/sniper/types";
import { StandbyPositionsModal } from "@/components/standby-positions-modal";
import { OperatorStrip } from "@/components/operator-strip";
import { TelemetryStrip } from "@/components/telemetry-strip";
import { SystemBar } from "@/components/system-bar";
import { NotificationBell, NotificationToasts } from "@/components/notification-center";
import { CommandPalette, OPEN_PALETTE_EVENT } from "@/components/command-palette";
import { useDeskNotifications } from "@/lib/use-desk-notifications";
import { getDbHealth, getTradeLearningEvents } from "@/lib/trade-memory.functions";

import { loadFeeds, loadFxSpot, loadPerpFunding, verifyInstrument } from "@/lib/market.functions";
import { scanAllAvenues } from "@/lib/avenues/engine";
import { loadCorpEvents } from "@/lib/events.functions";
import { listWhaleWatches, refreshWhaleMoves } from "@/lib/whales.functions";
import { FX_PAIRS } from "@/lib/fx/twelvedata";

const EMPTY_FX_STALE: ReadonlySet<string> = new Set<string>();

type NavItem = { to: string; label: string; short: string; icon: typeof LayoutDashboard };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Trade",
    items: [{ to: "/terminal", label: "Terminal", short: "Term", icon: LayoutGrid }],
  },
  {
    label: "Live · now",
    items: [
      { to: "/", label: "Desk", short: "Desk", icon: LayoutDashboard },
      { to: "/tape", label: "Tape", short: "Tape", icon: Activity },
      { to: "/signals", label: "Signals", short: "Feed", icon: Radar },
    ],
  },
  {
    label: "Discover",
    items: [{ to: "/opportunities", label: "Scanner", short: "Scan", icon: ScanSearch }],
  },
  {
    label: "Research",
    items: [{ to: "/learn", label: "DYOR", short: "DYOR", icon: Search }],
  },
  {
    label: "Account",
    items: [
      { to: "/wallet", label: "Wallet", short: "Funds", icon: Wallet },
      { to: "/settings", label: "Settings", short: "Setup", icon: SlidersHorizontal },
    ],
  },
];

const NAV: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function Frame({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const gate = useSupabaseGate();
  // The platform ships auth OFF (`VITE_AUTH_ENABLED=false`, .grok/app-env.json).
  // In that mode the Supabase sign-in gate is bypassed so the desk actually runs
  // — and therefore learns — without a configured Supabase project. When auth is
  // enabled the sign-in gate is enforced exactly as before.
  const authDisabled = import.meta.env.VITE_AUTH_ENABLED === "false";
  const signedIn = authDisabled || gate.status === "signed-in";
  useDeskNotifications();

  useEffect(() => {
    if (!signedIn) return;
    let cancel = false;
    let timer = 0;
    let tickCount = 0;
    let lastEngineCycleAt = 0;
    let lastPrices: Record<string, number> = {};
    let lastHadPrices = false;
    const loop = async () => {
      if (cancel) return;
      const sniperBook = useSniper.getState().book;
      const interval = Math.max(1, sniperBook.settings.scanSeconds) * 1000;
      const desk = useDesk.getState();
      tickCount++;

      if (desk.power) {
        const at = Date.now();
        const due = catchUpTicks(at, sniperBook.lastWall, sniperBook.settings.scanSeconds);
        if (due > 0) useSniper.getState().runTicks(due);
        const droppedMs = unreplayedMs(at, sniperBook.lastWall, sniperBook.settings.scanSeconds, due);
        if (droppedMs > 60_000) {
          const droppedMin = (droppedMs / 60000).toFixed(1);
          useDesk.setState((prev) => ({
            log: [`Catch-up replayed ${due} ticks; ${droppedMin} min of sim history discarded (cap hit).`, ...prev.log].slice(0, 50),
          }));
        }
      } else {
        useSniper.getState().runTicks(0);
      }

      const hasWorking = useDesk.getState().workingOrders.some((o) => o.status === "WORKING");
      const hasAlerts = useDesk.getState().alerts.some((a) => !a.fired);
      if ((desk.power || desk.demo.positions.length > 0 || hasWorking || hasAlerts) && tickCount % 3 === 0) {
        try {
          const feeds = await loadFeeds({ data: {} });
          useFeedHealth.getState().setRows(feeds.health);
          const combined = [...feeds.binance, ...feeds.dex, ...feeds.gmgn];
          if (!combined.length) {
            if (lastHadPrices) {
              const current = useDesk.getState();
              if (current.power) current.tick({ ...lastPrices }, false);
              else if (current.demo.positions.length > 0) current.tick({ ...lastPrices }, true);
              useFeedHealth.getState().setRows([
                { id: "binance", label: "Binance", state: "down", detail: "Outage — last-known marks" },
                { id: "dex", label: "DEX", state: "down", detail: "Outage — last-known marks" },
                { id: "gmgn", label: "GMGN", state: "down", detail: "Outage — last-known marks" },
                { id: "coingecko", label: "CoinGecko", state: "down", detail: "Outage — last-known marks" },
                { id: "coinmarketcap", label: "CoinMarketCap", state: "down", detail: "Outage — last-known marks" },
              ]);
            }
          }
          if (combined.length) {
            const current = useDesk.getState();
            if (current.power) {
              try {
                const avenues = scanAllAvenues(current[current.mode], current.disciplineRules, Date.now(), {
                  funding: current.perpFunding,
                  tape: combined,
                });
                const onTape = new Set(
                  combined.map((c) => c.symbol.toUpperCase().split(/[/:_\- ]/)[0]),
                );
                const missing = [
                  ...new Set(
                    avenues
                      .map((a) => (a.anchorSymbol ?? "").toUpperCase())
                      .filter((a) => a && !onTape.has(a)),
                  ),
                ];
                if (missing.length) {
                  const { loadAnchorQuotes } = await import("@/lib/market.functions");
                  const aq = await loadAnchorQuotes({ data: { symbols: missing } });
                  for (const row of aq.rows) {
                    if (!combined.some((c) => c.id === row.id)) combined.push(row);
                  }
                }
              } catch {
                // Best-effort
              }
            }
            current.setTape(combined, feeds.note);
            const prices: Record<string, number> = {};
            for (const c of combined) {
              prices[c.id] = c.priceUsd;
            }
            for (const c of feeds.gmgnQuotes) {
              prices[c.id] = c.priceUsd;
            }
            const gmgnOpen = [...current.demo.positions, ...current.live.positions]
              .map((p) => {
                const m = /^gmgn:([^:]+):(.+)$/.exec(p.tokenId);
                return m ? { id: p.tokenId, chain: m[1], address: m[2] } : null;
              })
              .filter((row): row is { id: string; chain: string; address: string } => row !== null);
            if (gmgnOpen.length) {
              try {
                const { loadTokenQuotes } = await import("@/lib/market.functions");
                const quotes = await loadTokenQuotes({ data: { tokens: gmgnOpen } });
                Object.assign(prices, quotes.prices);
              } catch {
                // GMGN positions hold their last mark when DexScreener is down.
              }
            }
            const fxIdForPair = (pair: (typeof FX_PAIRS)[number]) => `fx:${pair.replace("/", "")}`;
            const fxSymbols = [...current.demo.positions, ...current.live.positions]
              .map((p) => p.tokenId)
              .filter((id) => id.startsWith("fx:"));
            const wantFx =
              fxSymbols.length > 0 ||
              (current.power && current.riskSettings.sizingProfile === "TURBO");
            let fxStale: ReadonlySet<string> = EMPTY_FX_STALE;
            if (wantFx) {
              try {
                const wanted = new Set<string>();
                for (const id of fxSymbols) {
                  const found = FX_PAIRS.find((p) => fxIdForPair(p) === id);
                  if (found) wanted.add(found);
                }
                const pairs = [...wanted];
                if (!pairs.length) pairs.push(...FX_PAIRS);
                const fx = await loadFxSpot({ data: { pairs } });
                Object.assign(prices, fx.prices);
                current.setFxPrices(fx.prices);
                if (fx.daily.length) fxStale = new Set(fx.daily);
              } catch {
                // FX best-effort
              }
            }
            if (current.power) current.tick(prices, false, fxStale);
            else if (current.demo.positions.length > 0) current.tick(prices, true, fxStale);
            useDesk.getState().workOrders(prices);
            lastPrices = prices;
            lastHadPrices = true;
          }
        } catch {
          // rate limit
        }
      }

      if (useDesk.getState().power) useDesk.getState().autoStep();
      // Live mode: drain queued real orders and apply venue fills (no-op when
      // live execution is not armed). Runs after autoStep so this cycle's
      // candidates are already enqueued.
      if (useDesk.getState().mode === "live") void useDesk.getState().liveStep();

      {
        const cfg = useDesk.getState().engineCycle;
        const now = Date.now();
        const due = cfg.enabled && now - lastEngineCycleAt >= cfg.minutes * 60_000;
        if (due) lastEngineCycleAt = now;
        if (due) {
          void (async () => {
            try {
              const { runTradingCycle } = await import("@/functions/trading-engine");
              const res = await runTradingCycle({ data: undefined as never });
              if (res.profitLocked > 0 || res.halted) {
                useDesk.setState((prev) => ({
                  note: res.note,
                  log: [`Engine cycle: ${res.note}`, ...prev.log].slice(0, 50),
                }));
              }
            } catch {
              // best-effort
            }
          })();
        }
      }

      if (tickCount % 30 === 0) {
        void loadPerpFunding()
          .then((res) => {
            if (res.rows.length) useDesk.getState().setPerpFunding(res.rows);
          })
          .catch(() => undefined);
      }

      if (tickCount % 60 === 0) {
        void (async () => {
          try {
            const st = useDesk.getState();
            const now = Date.now();
            const fresh = (id: string) => {
              const row = st.security[id];
              return row && now - row.at < 600_000;
            };
            const targets = st.tape
              .filter((c) => c.venue === "dex" && !fresh(c.id))
              .sort((a, b) => b.score - a.score)
              .slice(0, 3);
            for (const c of targets) {
              const res = await verifyInstrument({ data: { chain: c.chain, address: c.address } });
              const sec = res.security;
              const reject =
                sec !== null &&
                (sec.honeypot === true ||
                  sec.ownerCanMint === true ||
                  sec.ownerCanFreeze === true ||
                  sec.lpLocked === false ||
                  (sec.buyTax ?? 0) > 0.15 ||
                  (sec.sellTax ?? 0) > 0.15);
              useDesk.getState().setSecurity(c.id, sec === null ? "unknown" : reject ? "reject" : "clean");
            }
          } catch {
            // best-effort
          }
        })();
      }

      if (tickCount % 150 === 0) {
        const heldSyms = [...desk.demo.positions, ...desk.live.positions].map((p) => p.symbol);
        void loadCorpEvents({ data: { query: "merger", universe: heldSyms } })
          .then((res) => useDesk.getState().setEventHalts(res.halts))
          .catch(() => undefined);
      }

      if (desk.power && tickCount % 45 === 0) {
        void (async () => {
          try {
            const watches = (await listWhaleWatches()).watches.filter((w) => w.follow);
            for (const w of watches.slice(0, 5)) {
              const { moves } = await refreshWhaleMoves({ data: { wallet: w.wallet } });
              for (const m of moves) {
                if (m.direction !== "IN") continue;
                const st = useDesk.getState();
                if (!st.power) return;
                const cand = st.tape.find(
                  (t) => t.address.toLowerCase() === m.mint.toLowerCase(),
                );
                if (!cand) continue;
                st.whaleEnter(cand, m.signature, w.label || w.wallet.slice(0, 8));
              }
            }
          } catch {
            // best-effort
          }
        })();
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
      void useDesk.getState().refreshLiveStatus();
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
          return getTradeLearningEvents({ data: { limit: 200 } });
        })
        .then((pack) => {
          if (!pack) return;
          const desk = useDesk.getState();
          desk.setDbHistory(pack.events, desk.dbGrossWin, desk.dbGrossLoss);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          // No DB configured (auth-off deploys keep learning in localStorage) is
          // the normal state, not a failure — log at info, surface via dbStatus.
          console.info("[trade-learning] Database learning unavailable; keeping learning local.", message.slice(0, 160));
          useDesk.getState().setDbStatus({ source: "unknown", ok: false, error: message.slice(0, 300) });
          useDesk.setState((desk) => ({
            note: "Database learning state is unavailable; local demo learning remains active.",
            log: [`Database link failed (${message.slice(0, 120)}).`, ...desk.log].slice(0, 50),
          }));
        });
      loop();
    })();
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [signedIn]);

  if (!authDisabled && gate.status === "misconfigured") {
    return <LoginView client={null} misconfigured />;
  }

  if (!authDisabled && gate.status === "signed-out") {
    return <LoginView client={gate.client} misconfigured={false} />;
  }

  if (!signedIn || !ready) {
    return (
      <div className="flex min-h-screen flex-col justify-between bg-ink px-6 py-8 text-cream">
        <p className="text-sm tracking-widest text-brass uppercase">Monroe</p>
        <p className="max-w-sm text-2xl font-medium">Opening the desk…</p>
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

  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const mode = useDesk((s) => s.mode);
  const power = useDesk((s) => s.power);
  const setPower = useDesk((s) => s.setPower);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const botStartedAt = useDesk((s) => s.botStartedAt);
  const getReadiness = useDesk((s) => s.getReadiness);

  const activeBook = mode === "live" ? live : demo;
  const activeEq = equity(activeBook);
  const activeLocked = exposure(activeBook);
  const turboRunning = useDesk((s) => s.turboPhase) === "running";
  const nairobi = formatNairobiTime(botStartedAt, nowTs);
  const readiness = getReadiness ? getReadiness() : null;
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
              {appearance.showMascot ? <Mascot className="size-8 shrink-0" turbo={turboRunning} /> : null}
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
              {mode === "live" ? "GATED" : "DEMO"}
            </span>
          </div>
          <p className="mt-1 text-lg font-medium">Sniper Bot</p>
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
          {NAV_GROUPS.map((group, i) => (
            <div key={group.label} className={cn("flex flex-col gap-1", i > 0 && "mt-3")}>
              <p className="px-3 text-[10px] font-semibold tracking-wider text-faint/70 uppercase">
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavLink key={item.to} {...item} />
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-4 py-4">
          <p className="text-[10px] uppercase tracking-wider text-faint">Session</p>
          <p className="num mt-1 text-base font-semibold text-cream">${activeEq.toFixed(2)}</p>
          <p className="text-[11px] text-faint">
            cash ${activeBook.cash.toFixed(2)} · locked ${activeLocked.toFixed(2)}
          </p>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-ink/95 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur sm:gap-3 md:px-8">
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
            {readiness && (
              <div
                title={`${readiness.completedDemoTrades} demo trades recorded`}
                className="hidden items-center gap-2 rounded-full border border-line bg-panel-2 px-3 py-1 lg:flex"
                suppressHydrationWarning
              >
                <ShieldCheck className="size-3.5 text-brass" />
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-faint">Discipline:</span>
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

            <div className="flex items-center rounded-full border border-brass/30 bg-brass/5 p-0.5" title="Read-only wallet connection">
              <WalletButton compact />
            </div>

            <div className="hidden text-right font-mono sm:block" suppressHydrationWarning>
              <span className="text-[10px] tracking-wider text-faint uppercase">{mode === "live" ? "Wallet balance:" : "Demo balance:"}</span>{" "}
              <Money value={activeEq} kind="balance" className={`text-sm font-semibold ${capitalMoodClass(activeBook.dayPnl)}`} />
              <span className="ml-2 text-[10px] text-faint">
                cash ${activeBook.cash.toFixed(2)} · locked ${activeLocked.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              aria-label="Open command palette"
              title="Command palette (Ctrl/⌘ + K)"
              onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
              className="hidden min-h-11 items-center gap-1.5 rounded-full border border-line bg-panel px-3 text-faint transition-colors hover:text-cream lg:inline-flex"
            >
              <Search className="size-4" />
              <span className="font-mono text-[10px] tracking-wider">⌘K</span>
            </button>
            <NotificationBell />
            <DbBadge />

            <button
              type="button"
              aria-label={power ? "Disarm demo bot" : "Arm demo bot"}
              onClick={requestStandby}
              className={cn(
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
                  power ? (mode === "live" ? "bg-amber-400 pulse-dot" : "bg-gain pulse-dot") : "bg-faint",
                )}
              />
              {power ? (
                <>
                  <span className="sm:hidden">Armed</span>
                  <span className="hidden sm:inline">Bot armed</span>
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

        <OperatorStrip />
        <SystemBar />
        <TelemetryStrip />

        {mode === "live" && (
          <div className="flex items-center justify-between border-b border-amber-500/40 bg-panel-2 px-4 py-2 text-xs md:px-8">
            <span className="font-semibold text-amber-300">
              Live execution is gated. Connect a broker to route orders — this session runs simulated fills.
            </span>
          </div>
        )}

        <main className="flex-1 px-4 py-4 md:px-8 md:py-6">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-panel/95 backdrop-blur md:hidden">
          {NAV.map((item) => (
            <MobileNavLink key={item.to} {...item} />
          ))}
        </nav>
      </div>

      {locked && <PinGate />}
      {showStandbyModal && <StandbyPositionsModal isOpen={showStandbyModal} onClose={() => setShowStandbyModal(false)} />}
      <WalletModal />
      <NotificationToasts />
      <CommandPalette />
    </div>
  );
}

function NavLink({ to, label, icon: Icon }: { to: string; label: string; short: string; icon: typeof LayoutDashboard }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || (to !== "/" && pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-brass/15 font-medium text-brass" : "text-faint hover:bg-panel-2 hover:text-cream",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}

function MobileNavLink({ to, short, icon: Icon }: { to: string; label: string; short: string; icon: typeof LayoutDashboard }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || (to !== "/" && pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
        active ? "text-brass" : "text-faint",
      )}
    >
      <Icon className="size-5" />
      {short}
    </Link>
  );
}

function DbBadge() {
  const dbOk = useDesk((s) => s.dbOk);
  const dbSource = useDesk((s) => s.dbSource);
  return (
    <span
      className={cn(
        "hidden rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider sm:inline",
        dbOk ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400",
      )}
      title={dbOk ? `Learning DB: ${dbSource}` : "Learning DB offline"}
    >
      {dbOk ? dbSource : "local"}
    </span>
  );
}

function PinGate() {
  const [pin, setPin] = useState("");
  const unlock = useSniper((s) => s.unlock);
  const book = useSniper((s) => s.book);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-6 backdrop-blur">
      <form
        className="w-full max-w-xs space-y-4 rounded-2xl border border-line bg-panel p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void hashPin(pin).then(() => unlock());
        }}
      >
        <p className="text-sm font-medium text-cream">Desk PIN</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 font-mono text-cream outline-none focus:border-brass"
          autoFocus
        />
        <Button type="submit" className="w-full">
          Unlock
        </Button>
      </form>
    </div>
  );
}
