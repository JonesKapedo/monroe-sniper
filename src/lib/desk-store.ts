import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type Book,
  type Candidate,
  type ClosedTrade,
  type Memory,
  chooseEntry,
  closeOne,
  deposit,
  emptyBook,
  emptyMemory,
  enter,
  learn,
  markBook,
  setKill,
  withdraw,
  equity,
  DEMO_START,
} from "./paper";
import {
  evaluateRiskAndSize,
  defaultRiskSettings,
  type RiskEngineSettings,
  type SizingProfile,
  type SizingVerdict,
} from "./sniper/risk-engine";
import { setupVector, type SetupVector } from "./math/vectors";
import { fibReentryDelayMin } from "./math/fib";
import { getDbHealth, saveTradeLearning, type TradeLearningEvent } from "./trade-memory.functions";
import { markWhaleActed } from "./whales.functions";
import type { AvenueCategory, DisciplineRules, PaperReadiness } from "./avenues/types";
import {
  defaultDisciplineRules,
  avenueAnchorPrice,
  avenueAnchors,
  scanAllAvenues,
  calculatePaperReadiness,
} from "./avenues/engine";
import { FX_PAIRS } from "./fx/twelvedata";
import type { PerpFunding } from "./perps/hyperliquid";
import { useDyorStore } from "./dyor/store";
import { playHawkCry, playSoftChirp } from "./sound";
import { assessEdge } from "./intel/emh";

export type Mode = "demo" | "live";
export type DbSource = "neon" | "pglite" | "unknown";
export type TurboPhase = "off" | "running" | "cooling";

/** A turbo run is 34 minutes with progress audits at 8, 13, and 21 minutes, then a 10-minute cooldown. */
export const TURBO_RUN_MS = 34 * 60_000;
export const TURBO_COOLDOWN_MS = 10 * 60_000;

export type TurboReport = {
  startedAt: number;
  entries: number;
  startSeen: number;
  startRealized: number;
  startMinScore: number;
};

export type ExecutionVenue =
  | "Binance Spot"
  | "Raydium CLMM"
  | "Uniswap v3"
  | "Orca"
  | "PancakeSwap"
  | "FX Spot";

export type TapeExecution = {
  id: string;
  hash: string;
  ts: number;
  symbol: string;
  venue: ExecutionVenue;
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  notional: number;
  latencyMs: number;
  slippageBps: number;
  type: "BOT_ENTRY" | "BOT_TAKE_PROFIT" | "BOT_STOP" | "MARKET_FLOW";
  note: string;
  atr?: number;
  riskReward?: number;
  avenue?: AvenueCategory;
};

export type WalletTx = {
  id: string;
  ts: number;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRADE_PNL";
  amount: number;
  address?: string;
  network?: string;
  mode: Mode;
  status: "CONFIRMED" | "PROCESSING";
  note: string;
};

type DeskState = {
  power: boolean;
  mode: Mode;
  demo: Book;
  live: Book;
  memory: Memory;
  tape: Candidate[];
  note: string;
  log: string[];
  executions: TapeExecution[];
  walletHistory: WalletTx[];
  riskSettings: RiskEngineSettings;
  disciplineRules: DisciplineRules;
  tradeLearningDbCount: number;
  dbSource: DbSource;
  dbOk: boolean;
  dbError: string | null;
  dbLastWriteAt: number | null;
  /** Most recent persisted closes (newest first) — survives local resets via the DB. */
  dbEvents: TradeLearningEvent[];
  /** Gross sums across persisted closes — profit-factor inputs for readiness. */
  dbGrossWin: number;
  dbGrossLoss: number;
  botStartedAt: number;
  restoreLearningState: (memory: Memory, storedTradeCount: number, source?: DbSource) => void;
  setDbStatus: (patch: { source?: DbSource; ok?: boolean; error?: string | null }) => void;
  setDbHistory: (events: TradeLearningEvent[], grossWin: number, grossLoss: number) => void;
  refreshDbStats: () => void;
  /** Latest FX spot marks by token id (`fx:EURUSD`), session only. */
  fxPrices: Record<string, number>;
  setFxPrices: (prices: Record<string, number>) => void;
  /** Live Hyperliquid funding rows for avenue hydration, session only. */
  perpFunding: PerpFunding[];
  setPerpFunding: (rows: PerpFunding[]) => void;
  /** Symbols under event HALT — entries blocked until the halt clears. */
  eventHalts: string[];
  setEventHalts: (symbols: string[]) => void;
  /** Whale signals already acted on (no double-copying). */
  actedSigs: string[];
  /** Verified security verdicts by candidate id (10-min TTL, refreshed by sweep). */
  security: Record<string, { verdict: "clean" | "reject" | "unknown"; at: number }>;
  setSecurity: (id: string, verdict: "clean" | "reject" | "unknown") => void;
  whaleEnter: (c: Candidate, sig: string, walletLabel: string) => { ok: boolean; note: string };
  // Turbo mode: 34-minute runs with progress audits at 8/13/21 min, then 10-min cooldown.
  turboPhase: TurboPhase;
  turboStartedAt: number | null;
  turboEndsAt: number | null;
  turboCooldownUntil: number | null;
  turboPrevProfile: SizingProfile | null;
  turboEntries: number;
  turboReport: TurboReport | null;
  auditGiven: { 8: boolean; 13: boolean; 21: boolean };
  // Risk-model selection — persists across page visits via localStorage.
  selectedModel: RiskModelProfile;
  modelHistory: string[];
  // Turbo configuration (mutually independent of model selection).
  turboRunMinutes: number;
  turboCooldownMinutes: number;
  flattenAll: () => void;
  halt: (on: boolean) => void;
  fund: (
    side: "in" | "out",
    amount: number,
    address?: string,
    network?: string,
  ) => { ok: boolean; note: string };
  resetDemo: () => void;
  setDemoBalance: (amount: number) => void;
  updateRiskSettings: (patch: Partial<RiskEngineSettings>) => void;
  updateDisciplineRules: (patch: Partial<DisciplineRules>) => void;
  getReadiness: () => PaperReadiness;
};

function pushLog(log: string[], line: string): string[] {
  return [line, ...log].slice(0, 50);
}

function makeHash(prefix = "0x"): string {
  const chars = "0123456789abcdef";
  let str = prefix;
  for (let i = 0; i < 8; i++) str += chars[Math.floor(Math.random() * chars.length)];
  str += "…";
  for (let i = 0; i < 4; i++) str += chars[Math.floor(Math.random() * chars.length)];
  return str;
}

function makeSolHash(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let str = "Sol: ";
  for (let i = 0; i < 6; i++) str += chars[Math.floor(Math.random() * chars.length)];
  str += "…";
  for (let i = 0; i < 4; i++) str += chars[Math.floor(Math.random() * chars.length)];
  return str;
}

function venueFor(c: Candidate): ExecutionVenue {
  if (c.venue === "fx" || c.chain === "fx") return "FX Spot";
  if (c.venue === "binance") return "Binance Spot";
  if (c.chain === "solana") return Math.random() > 0.4 ? "Raydium CLMM" : "Orca";
  if (c.chain === "bsc") return "PancakeSwap";
  return "Uniswap v3";
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/** Winner feature vectors from persisted closes for resemblance scoring. */
function winnerVectors(): SetupVector[] {
  return useDesk
    .getState()
    .dbEvents.filter((e) => e.pnl > 0)
    .slice(0, 60)
    .map((e) =>
      setupVector({ change24h: e.change24h, volume24h: e.volume24h, liquidityUsd: e.liquidityUsd, score: e.score }),
    );
}

function openVectorsOf(book: Book): SetupVector[] {
  return book.positions.map((p) =>
    setupVector({
      change24h: p.entryChange24h,
      volume24h: p.entryVolume24h,
      liquidityUsd: p.entryLiquidityUsd,
      score: p.entryScore,
    }),
  );
}

function mathOverlays(book: Book): { winnerVectors: SetupVector[]; openVectors: SetupVector[] } {
  return { winnerVectors: winnerVectors(), openVectors: openVectorsOf(book) };
}

/** Fire-and-forget Telegram trade alert — alerts never break trading. */
function telegramAlert(text: string): void {
  try {
    const creds = useDyorStore.getState().telegramCreds();
    if (!creds) return;
    void import("./integrations.functions")
      .then((m) => m.sendTelegramAlert({ data: { ...creds, text } }))
      .catch(() => undefined);
  } catch {
    // Alerts never break trading.
  }
}

/** Cached security verdict with a 10-minute TTL; missing/stale reads unknown. */
export function securityVerdictOf(
  security: Record<string, { verdict: "clean" | "reject" | "unknown"; at: number }>,
  id: string,
): "clean" | "reject" | "unknown" {
  const row = security[id];
  if (!row || Date.now() - row.at > 600_000) return "unknown";
  return row.verdict;
}

/** True when a corporate-event HALT covers this symbol. */
export function isHalted(symbol: string, halts: string[]): boolean {
  const base = symbol.toUpperCase().split(/[/:_\- ]/)[0];
  return halts.some((h) => h.toUpperCase() === base);
}

function absorb(
  book: Book,
  prices: Record<string, number>,
  memory: Memory,
  monitorOnly = false,
  staleIds: ReadonlySet<string> = EMPTY_SET,
): { book: Book; memory: Memory; newTrades: typeof book.trades } {
  const priorIds = new Set(book.trades.map((trade) => trade.id));
  const next = markBook(book, prices, Date.now(), !monitorOnly, { staleIds });
  let mem = memory;
  const newTrades = next.trades.filter((trade) => !priorIds.has(trade.id));
  for (const trade of newTrades) {
    // Stale-mark closes and operator MANUAL flattens carry no edge signal.
    if (trade.simulated || trade.reason === "MANUAL") continue;
    mem = learn(mem, trade.pnl);
  }
  return { book: next, memory: mem, newTrades };
}

function archiveClosedTrades(records: Array<{ trade: ClosedTrade; mode: Mode }>): void {
  for (const { trade, mode } of records) {
    if (trade.simulated || trade.reason === "MANUAL") {
      console.info(`[trade-learning] Skipped non-learning close: ${trade.symbol} (${trade.reason}${trade.simulated ? ", no live quote" : ""})`);
      continue;
    }
    void saveTradeLearning({
      data: {
        id: trade.id,
        symbol: trade.symbol,
        chain: trade.chain ?? "unknown",
        venue: trade.venue ?? "unknown",
        entryPrice: trade.entryPrice ?? 0,
        exitPrice: trade.exitPrice ?? 0,
        qty: trade.qty ?? 0,
        pnl: trade.pnl,
        score: trade.entryScore ?? 0,
        change24h: trade.entryChange24h ?? 0,
        liquidityUsd: trade.entryLiquidityUsd ?? 0,
        volume24h: trade.entryVolume24h ?? 0,
        pairAgeHours: trade.pairAgeHours ?? null,
        mode,
        reason: trade.reason,
        openedAt: trade.openedAt ?? trade.closedAt,
        closedAt: trade.closedAt,
      },
    })
      .then(({ inserted, state }) => {
        if (inserted) {
          const event: TradeLearningEvent = {
            id: trade.id,
            symbol: trade.symbol,
            chain: trade.chain ?? "unknown",
            venue: typeof trade.venue === "string" ? trade.venue : "unknown",
            entryPrice: trade.entryPrice ?? 0,
            exitPrice: trade.exitPrice ?? 0,
            qty: trade.qty ?? 0,
            pnl: trade.pnl,
            score: trade.entryScore ?? 0,
            change24h: trade.entryChange24h ?? 0,
            liquidityUsd: trade.entryLiquidityUsd ?? 0,
            volume24h: trade.entryVolume24h ?? 0,
            mode,
            reason: trade.reason,
            openedAt: trade.openedAt ?? trade.closedAt,
            closedAt: trade.closedAt,
          };
          useDesk.setState((prev) => ({
            tradeLearningDbCount: state.seen,
            // The database is the shared source of truth for the adaptive
            // floor: adopt its aggregate so local + Neon never diverge.
            memory: {
              seen: state.seen,
              wins: state.wins,
              losses: state.losses,
              realized: state.realized,
              minScore: state.minScore,
            },
            dbEvents: [event, ...prev.dbEvents].slice(0, 200),
            dbGrossWin: prev.dbGrossWin + (trade.pnl > 0 ? trade.pnl : 0),
            dbGrossLoss: prev.dbGrossLoss + (trade.pnl < 0 ? -trade.pnl : 0),
            dbSource: state.dbSource,
            dbOk: true,
            dbError: null,
            dbLastWriteAt: Date.now(),
          }));
          // Reconcile gross sums with the server (cheap, closes are infrequent).
          void getDbHealth().then((health) => {
            if (!health.ok) return;
            useDesk.setState({
              dbGrossWin: health.grossWin,
              dbGrossLoss: health.grossLoss,
              tradeLearningDbCount: health.events,
            });
          }).catch(() => undefined);
        } else {
          // Duplicate id: row already counted, just mark the link healthy.
          useDesk.setState((prev) => ({
            dbSource: state.dbSource,
            dbOk: true,
            dbError: null,
            dbLastWriteAt: prev.dbLastWriteAt ?? Date.now(),
          }));
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[trade-learning] Failed to persist a closed trade:", error);
        useDesk.setState((state) => ({
          note: "Trade closed, but its learning record could not be saved. Check the database link.",
          log: pushLog(state.log, `Trade learning save failed: ${trade.symbol} (${message.slice(0, 120)})`),
          dbOk: false,
          dbError: message.slice(0, 300),
        }));
      });
  }
}

export const useDesk = create<DeskState>()(
  persist(
    (set, get) => ({
      power: false,
      mode: "demo",
      demo: emptyBook(DEMO_START),
      live: emptyBook(0),
      memory: emptyMemory(),
      tape: [],
      note: `Paper trading sandbox active ($${DEMO_START}). Arm power to auto-snipe.`,
      log: [`System initialized. Demo balance: $${DEMO_START}.00`, "Risk engine active: Volatility-adjusted ATR sizing"],
      executions: [],
      riskSettings: defaultRiskSettings,
      disciplineRules: defaultDisciplineRules,
      tradeLearningDbCount: 0,
      dbSource: "unknown",
      dbOk: false,
      dbError: null,
      dbLastWriteAt: null,
      dbEvents: [],
      dbGrossWin: 0,
      dbGrossLoss: 0,
      fxPrices: {},
      perpFunding: [],
      security: {},
      eventHalts: [],
      actedSigs: [],
      turboPhase: "off",
      turboStartedAt: null,
      turboEndsAt: null,
      turboCooldownUntil: null,
      turboPrevProfile: null,
      turboEntries: 0,
      turboReport: null,
      auditGiven: { 8: false, 13: false, 21: false },
      // Risk-model selection — persists across page visits via localStorage.
      selectedModel:  "[paranoid]" ,
      modelHistory: [],
      // Turbo configuration (mutually independent of model selection).
      turboRunMinutes: 34,
      turboCooldownMinutes: 10,
      botStartedAt: Date.now() - 3600000,
      walletHistory: [
        {
          id: "tx-init-demo",
          ts: Date.now() - 3600000,
          type: "DEPOSIT",
          amount: DEMO_START,
          mode: "demo",
          status: "CONFIRMED",
          note: `Demo desk opening grant: $${DEMO_START}.00 USD`,
        },
      ],

      restoreLearningState: (memory, storedTradeCount, source = "unknown") =>
        set({
          memory,
          tradeLearningDbCount: storedTradeCount,
          dbSource: source,
          dbOk: true,
          dbError: null,
        }),

      setDbStatus: (patch) =>
        set((s) => ({
          dbSource: patch.source ?? s.dbSource,
          dbOk: patch.ok ?? s.dbOk,
          dbError: patch.error !== undefined ? patch.error : s.dbError,
        })),

      startTurbo: () => {
        const s = get();
        if (s.mode !== "demo") {
          return { ok: false, note: "Turbo runs on the paper desk only." };
        }
        if (s.turboPhase === "running") {
          return { ok: true, note: "Turbo run already in progress." };
        }
        if (s.turboPhase === "cooling") {
          return { ok: false, note: "Turbo is cooling — wait it out or bypass the cooldown." };
        }
        const now = Date.now();
        set({
          turboPrevProfile: s.selectedModel.id,
          riskSettings: { ...s.riskSettings, sizingProfile: "[degen]" },
          turboPhase: "running",
          turboStartedAt: now,
          turboEndsAt: now + TURBO_RUN_MS,
          turboCooldownUntil: null,
          turboEntries: 0,
          turboReport: {
            startedAt: now,
            entries: 0,
            startSeen: s.memory.seen,
            startRealized: s.memory.realized,
            startMinScore: s.memory.minScore,
          },
          power: true,
          note: "🔥 TURBO ARMED — 34-minute max-aggression run with audits at 8/13/21min. Safety gates stay armed.",
          log: pushLog(s.log, "🔥 TURBO run started (34:00)"),
        });
        return { ok: true, note: "Turbo run started." };
      },

      bypassTurboCooldown: () => {
        const s = get();
        if (s.turboPhase !== "cooling") return;
        set({
          turboPhase: "off",
          turboCooldownUntil: null,
          note: "Turbo cooldown bypassed by operator — entries resume.",
          log: pushLog(s.log, "Turbo cooldown BYPASSED by operator"),
        });
      },

      tickTurbo: () => {
        const s = get();
        const now = Date.now();
        const runMinutes = s.turboRunMinutes ?? 34;
        const cooldownMinutes = s.turboCooldownMinutes ?? 10;
        // Switching profiles manually abandons the run (no orphaned timers).
        if (s.turboPhase === "running" && s.riskSettings.sizingProfile !== "[degen]") {
          set({
            turboPhase: "off",
            turboStartedAt: null,
            turboEndsAt: null,
            note: "Turbo run cancelled — sizing profile changed manually.",
            log: pushLog(s.log, "Turbo run cancelled (profile changed)"),
          });
          return;
        }
        if (s.turboPhase === "running" && s.turboEndsAt !== null && now >= s.turboEndsAt) {
          const realized = Math.round((s.memory.realized - (s.turboReport?.startRealized ?? 0)) * 100) / 100;
          set({
            turboPhase: "cooling",
            turboCooldownUntil: now + cooldownMinutes * 60_000,
            riskSettings: {
              ...s.riskSettings,
              sizingProfile: s.turboPrevProfile ?? "[paranoid]",
            },
            turboPrevProfile: null,
            turboReport: s.turboReport ? { ...s.turboReport, entries: s.turboEntries } : null,
            note: `Turbo run complete — ${s.turboEntries} entries, ${realized >= 0 ? "+" : ""}$${realized.toFixed(2)} realized. Cooling ${cooldownMinutes}:00; open positions ride to exits.`,
            log: pushLog(
              s.log,
              `Turbo run complete: ${s.turboEntries} entries, ${realized >= 0 ? "+" : ""}$${realized.toFixed(2)} (cooling ${cooldownMinutes}:00)`,
            ),
          });
          // Trigger progress-audit debrief summary.
          useDesk.setState({
            auditGiven: { 8: true, 13: true, 21: true },
          });
          return;
        }
        // Progress audits during the run.
        if (s.turboPhase === "running") {
          const elapsed = now - (s.turboStartedAt ?? 0);
          const auditMinutes = s.auditGiven;
          if (!auditGiven[8] && elapsed >= 8 * 60_000) {
            useDesk.setState({ auditGiven: { ...auditGiven, 8: true } });
            // TODO: emit audit panel event — collect metrics and show debrief.
            // console.log("[Degen] 8-minute progress audit triggered");
          }
          if (!auditGiven[13] && elapsed >= 13 * 60_000) {
            useDesk.setState({ auditGiven: { ...auditGiven, 13: true } });
            // TODO: emit audit panel event.
            // console.log("[Degen] 13-minute progress audit triggered");
          }
          if (!auditGiven[21] && elapsed >= 21 * 60_000) {
            useDesk.setState({ auditGiven: { ...auditGiven, 21: true } });
            // TODO: emit audit panel event.
            // console.log("[Degen] 21-minute progress audit triggered");
          }
        }
        if (s.turboPhase === "cooling" && s.turboCooldownUntil !== null && now >= s.turboCooldownUntil) {
          set({
            turboPhase: "off",
            turboCooldownUntil: null,
            note: "Turbo cooldown elapsed — turbo may be armed again.",
            log: pushLog(s.log, "Turbo cooldown elapsed"),
          });
        }
      },

      setDbHistory: (events, grossWin, grossLoss) =>
        set((s) => ({
          dbEvents: events.slice(0, 200),
          dbGrossWin: grossWin,
          dbGrossLoss: grossLoss,
          tradeLearningDbCount: Math.max(s.tradeLearningDbCount, events.length),
        })),

      setFxPrices: (prices) =>
        set((s) => ({ fxPrices: { ...s.fxPrices, ...prices } })),

      setPerpFunding: (rows) => set({ perpFunding: rows }),

      setSecurity: (id, verdict) =>
        set((prev) => ({
          security: { ...prev.security, [id]: { verdict, at: Date.now() } },
        })),

      setEventHalts: (symbols) =>
        set({ eventHalts: [...new Set(symbols.map((x) => x.toUpperCase()))].slice(0, 30) }),

      whaleEnter: (c, sig, walletLabel) => {
        const s = get();
        if (s.mode !== "demo" || !s.power || s.turboPhase === "cooling") {
          return { ok: false, note: "Bot is not taking entries right now" };
        }
        if (s.actedSigs.includes(sig)) {
          return { ok: false, note: "Already acted on this whale move" };
        }
        const res = get().manualEnter({
          ...c,
          rationale: [...c.rationale, `🐋 Whale copy: ${walletLabel} accumulated ${c.symbol}`],
        });
        if (!res.ok) return res;
        void markWhaleActed({ data: { signatures: [sig] } }).catch(() => undefined);
        useDesk.setState((prev) => ({
          actedSigs: [sig, ...prev.actedSigs].slice(0, 200),
          log: pushLog(prev.log, `🐋 Whale copy: ${c.symbol} behind ${walletLabel} — ${res.note}`),
        }));
        return res;
      },

      refreshDbStats: () => {
        void getDbHealth().then((health) => {
          if (!health.ok || !health.state) {
            get().setDbStatus({
              source: health.source,
              ok: false,
              error: health.error,
            });
            return;
          }
          set({
            dbSource: health.source,
            dbOk: true,
            dbError: null,
            dbGrossWin: health.grossWin,
            dbGrossLoss: health.grossLoss,
            tradeLearningDbCount: health.events,
          });
        }).catch(() => undefined);
      },

      setPower: (on) =>
        set((s) => ({
          power: s.mode === "live" ? false : on,
          note: on
            ? s.mode === "live"
              ? "Live execution is unavailable. The desk only supports paper simulation."
              : "Armed. Sniper is actively scanning simulated markets."
            : s.demo.positions.length
              ? "Standby. Automated entries and exits are paused; open paper positions remain held."
              : "Standby. Automated trading is paused.",
          log: pushLog(
            s.log,
            on && s.mode !== "live" ? "Sniper ARMED [DEMO]" : on ? "Live execution blocked" : "Sniper DISARMED",
          ),
        })),

      setMode: (mode) => {
        // Mode sounds fire only on real transitions: hawk cry into live,
        // soft chirp back to paper. (Live entry is still locked until the
        // wallet phases unlock it — the cry is wired and waiting.)
        const prevMode = get().mode;
        if (mode === "live" && prevMode === "live") return;
        if (mode === "demo" && prevMode === "demo") {
          set({ mode: "demo" });
          return;
        }
        set((s) => {
          if (mode === "live") {
            return {
              mode: "demo",
              power: false,
              note: "Live execution is unavailable. No broker is connected; this desk is simulation-only.",
              log: pushLog(s.log, "Live mode blocked: no broker execution integration"),
            };
          }
          return {
            mode,
            power: mode === "demo" ? s.power : false,
            note: `Switched to paper simulation. Balance: $${s.demo.cash.toFixed(2)}.`,
            log: pushLog(s.log, "Mode switched to DEMO"),
          };
        });
        if (mode === "live" && get().mode === "live") void playHawkCry();
        else if (mode === "demo" && prevMode === "live") void playSoftChirp();
      },

      setTape: (rows, note) => {
        set({ tape: rows, note });
        // Feed top discovered instruments into DYOR (static import: the
        // dynamic import previously defeated chunk splitting).
        if (typeof window !== "undefined" && rows.length > 0) {
          try {
            const ingest = useDyorStore.getState().ingestCandidate;
            rows.slice(0, 5).forEach((cand) => ingest(cand));
          } catch {
            // Ignore in SSR
          }
        }
      },

      updateRiskSettings: (patch) =>
        set((s) => ({
          riskSettings: { ...s.riskSettings, ...patch },
          log: pushLog(s.log, "Risk parameters updated"),
        })),

      updateDisciplineRules: (patch) =>
        set((s) => ({
          disciplineRules: { ...s.disciplineRules, ...patch },
          log: pushLog(s.log, "Discipline parameters updated"),
        })),

      getReadiness: () => {
        const s = get();
        const book = s[s.mode];
        // Merge persisted closes with local ones (dedupe by id): a cleared
        // browser or a fresh device still counts the database's history, so
        // every close keeps moving the readiness bar.
        const seenIds = new Set(book.trades.map((t) => t.id));
        const teachable = (pnl: number, simulated?: boolean, reason?: string) =>
          !simulated && reason !== "MANUAL";
        const history = [
          ...book.trades.filter((t) => teachable(t.pnl, t.simulated, t.reason)).map((t) => ({ pnl: t.pnl })),
          ...s.dbEvents.filter((e) => !seenIds.has(e.id)).map((e) => ({ pnl: e.pnl })),
        ];
        return calculatePaperReadiness(book, history);
      },

      tick: (prices, monitorOnly = false, staleIds: ReadonlySet<string> = EMPTY_SET) => {
        const s = get();
        // Enrich the feed map so every open position has a price: avenue
        // positions resolve through their anchor symbol, anything still
        // unpriced falls back to labeled simulated drift inside markBook.
        const enriched: Record<string, number> = { ...prices };
        const openPositions = [...s.demo.positions, ...s.live.positions];
        if (openPositions.some((p) => !(enriched[p.tokenId] > 0))) {
          const anchors = avenueAnchors(s.demo, s.disciplineRules);
          for (const p of openPositions) {
            if (enriched[p.tokenId] > 0) continue;
            const anchor = anchors.get(p.tokenId);
            const px = anchor ? avenueAnchorPrice(anchor, s.tape) : null;
            if (px !== null) enriched[p.tokenId] = px;
            // Otherwise the position holds its last mark flagged stale:
            // no drift, no stop/target on invented prices, no learning.
          }
        }
        const demoAbs = absorb(s.demo, enriched, s.memory, monitorOnly, staleIds);
        const liveAbs = absorb(s.live, enriched, demoAbs.memory, monitorOnly, staleIds);
        const closedTrades = [
          ...demoAbs.newTrades.map((trade) => ({ trade, mode: "demo" as const })),
          ...liveAbs.newTrades.map((trade) => ({ trade, mode: "live" as const })),
        ];
        let nextExecs = s.executions;
        let nextLog = s.log;
        const stopStreak = { ...s.stopStreak };
        const lastStopAt = { ...s.lastStopAt };

        for (const { trade, mode } of closedTrades) {
          // Fib-spaced re-entry memory: stops stack per symbol, targets forgive.
          if (trade.reason === "STOP") {
            stopStreak[trade.symbol] = (stopStreak[trade.symbol] ?? 0) + 1;
            lastStopAt[trade.symbol] = trade.closedAt;
          } else if (trade.reason === "TARGET") {
            stopStreak[trade.symbol] = 0;
          }
          const isProfit = trade.pnl > 0;
          const verb =
            trade.reason === "TARGET" ? "TAKE PROFIT" : trade.reason === "STOP" ? "STOP LOSS" : "CLOSED";
          const noteLine = `${verb}: ${trade.symbol} ${isProfit ? "+" : ""}$${trade.pnl.toFixed(2)} (${trade.reason})`;
          nextLog = pushLog(nextLog, noteLine);

          const exec: TapeExecution = {
            id: `exit-${trade.closedAt}-${Math.random().toString(36).slice(2, 6)}`,
            hash: trade.symbol.includes("SOL") || trade.symbol.includes("WIF") ? makeSolHash() : makeHash(),
            ts: trade.closedAt,
            symbol: trade.symbol,
            venue: trade.symbol.includes("USDT") ? "Binance Spot" : "Raydium CLMM",
            side: "SELL",
            price: trade.exitPrice ?? 0,
            qty: trade.qty ?? 0,
            notional: Math.abs(trade.pnl),
            latencyMs: 38 + Math.floor(Math.random() * 25),
            slippageBps: 0.3,
            type: isProfit ? "BOT_TAKE_PROFIT" : "BOT_STOP",
            note: `[${mode.toUpperCase()}] ${noteLine}`,
          };
          nextExecs = [exec, ...nextExecs].slice(0, 100);
        }

        set({
          demo: demoAbs.book,
          live: liveAbs.book,
          memory: liveAbs.memory,
          executions: nextExecs,
          log: nextLog,
          stopStreak,
          lastStopAt,
        });
        if (closedTrades.length > 0) {
          const lines = closedTrades.map(({ trade }) => {
            const isProfit = trade.pnl > 0;
            return `${trade.reason === "TARGET" ? "✅ TP" : trade.reason === "STOP" ? "🛑 SL" : "📕 Closed"} ${trade.symbol} ${isProfit ? "+" : ""}$${trade.pnl.toFixed(2)}`;
          });
          telegramAlert(`Monroe paper closes (${closedTrades.length}):\n${lines.slice(0, 8).join("\n")}`);
        }
        archiveClosedTrades(closedTrades);
      },

      autoStep: () => {
        get().tickTurbo();
        const s = get();
        if (!s.power || s.mode !== "demo") return;
        // Cooling halts entries only — open positions still ride to exits via tick().
        if (s.turboPhase === "cooling") return;
        const targetKey = s.mode;
        const currentBook = s[targetKey];
        if (currentBook.positions.length >= s.riskSettings.maxPositions) return;
        const isTurbo = s.selectedModel.id === "[degen]";
        // Model-profile score floor: [degen] drops 15 points, never below 45.
        const scoreFloor = isTurbo ? Math.max(45, s.memory.minScore - 15) : s.memory.minScore;
        const overlays = mathOverlays(currentBook);

        // Fib-spaced re-entry: a symbol that just stopped sits out a few
        // minutes (degen only — other profiles keep classic behavior).
        const fibBlocked = (symbol: string): boolean => {
          if (!isTurbo) return false;
          const last = s.lastStopAt[symbol];
          if (!last) return false;
          const delayMin = fibReentryDelayMin(s.stopStreak[symbol] ?? 1);
          return Date.now() - last < delayMin * 60_000;
        };

        // Capital Discipline: Daily Drawdown Circuit Breaker
        const currentEq = equity(currentBook);
        const peak = Math.max(currentBook.peakEquity, currentEq);
        const currentDd = peak > 0 ? (peak - currentEq) / peak : 0;
        if (currentDd >= s.disciplineRules.maxDailyDrawdownPct) {
          return; // Intraday loss limit circuit breaker triggers
        }

        // 1. Check all money-making avenues (Perps, Arbitrage, Early IPOs, Yield Basis)
        const avenues = scanAllAvenues(currentBook, s.disciplineRules, Date.now(), {
          funding: s.perpFunding,
        });
        const unheldAvenue = avenues.find(
          (a) =>
            !currentBook.positions.some((p) => p.tokenId === a.id) &&
            a.disciplineApproved &&
            a.confidenceScore >= 80 &&
            !fibBlocked(a.symbol) &&
            !isHalted(a.symbol, s.eventHalts),
        );

        // If an avenue setup is available, execute with disciplined parameters
        if (unheldAvenue) {
          const aveCand: Candidate = {
            id: unheldAvenue.id,
            symbol: unheldAvenue.symbol,
            name: unheldAvenue.symbol,
            address: unheldAvenue.id,
            chain: unheldAvenue.chain,
            venue: unheldAvenue.venueA.toLowerCase().includes("binance") ? "binance" : "dex",
            priceUsd: unheldAvenue.priceA,
            change24h:
              (unheldAvenue.grossSpreadPct ?? 2.5) *
              (unheldAvenue.perpSide === "SHORT" ? -1 : 1),
            volume24h: 850_000,
            liquidityUsd: 420_000,
            score: unheldAvenue.confidenceScore,
            pairAgeHours: 24,
            url: null,
            flags: [],
            rationale: [unheldAvenue.title, ...(unheldAvenue.disciplineNotes ?? [])],
          };

          const verdict = evaluateRiskAndSize(
            currentBook,
            aveCand,
            s.riskSettings,
            scoreFloor,
            Date.now(),
            overlays,
          );

          if (verdict.allowed && verdict.notional > 0) {
            const notional = Math.min(verdict.notional, unheldAvenue.maxCapitalAllocationUsd);
            const result = enter(currentBook, aveCand, Date.now(), scoreFloor, {
              notional,
              stop: unheldAvenue.stopLossPrice,
              target: unheldAvenue.targetPrice,
            });

            if (result.ok) {
              const hashStr = unheldAvenue.chain === "solana" ? makeSolHash() : makeHash();
              const exec: TapeExecution = {
                id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                hash: hashStr,
                ts: Date.now(),
                symbol: unheldAvenue.symbol,
                venue: (unheldAvenue.venueA.includes("Binance") ? "Binance Spot" : "Raydium CLMM") as any,
                side: unheldAvenue.perpSide === "SHORT" ? "SELL" : "BUY",
                price: unheldAvenue.priceA,
                qty: notional / unheldAvenue.priceA,
                notional,
                latencyMs: 28,
                slippageBps: 0.2,
                type: "BOT_ENTRY",
                avenue: unheldAvenue.category,
                note: `[${unheldAvenue.category}] ${unheldAvenue.title} · Sized $${notional.toFixed(2)} (R:R ${unheldAvenue.riskRewardRatio}R)`,
                atr: unheldAvenue.estimatedAtrPct,
                riskReward: unheldAvenue.riskRewardRatio,
              };

              const noteLine = `[${unheldAvenue.category}] Disciplined Sizing: ${unheldAvenue.symbol} $${notional.toFixed(2)} on ${unheldAvenue.venueA} (Stop $${unheldAvenue.stopLossPrice.toFixed(4)}, Target $${unheldAvenue.targetPrice.toFixed(4)})`;

              set({
                [targetKey]: result.book,
                note: noteLine,
                log: pushLog(s.log, noteLine),
                executions: [exec, ...s.executions].slice(0, 100),
                turboEntries: s.turboEntries + (isTurbo ? 1 : 0),
              });
              telegramAlert(`Monroe paper entry\n${noteLine}`);
              // Turbo takes a tape trade too when slots remain; otherwise one entry per cycle.
              if (!isTurbo) return;
            }
          }
        }

        // 1b. Turbo forex majors: same gates, TwelveData spots, chain-capped.
        if (isTurbo) {
          const fxState = useDesk.getState();
          const fxBook = fxState[fxState.mode];
          const fxFloor = Math.max(45, fxState.memory.minScore - 15);
          if (fxBook.positions.length < fxState.riskSettings.maxPositions) {
            for (const pair of FX_PAIRS) {
              const id = `fx:${pair.replace("/", "")}`;
              const price = fxState.fxPrices[id];
              if (!(price > 0)) continue;
              if (fxBook.positions.some((p) => p.tokenId === id)) continue;
              if (fibBlocked(pair) || isHalted(pair, fxState.eventHalts)) continue;
              const fxCand: Candidate = {
                id,
                symbol: pair,
                name: `${pair} · FX major`,
                address: pair,
                chain: "fx",
                venue: "fx",
                priceUsd: price,
                change24h: 0.4,
                volume24h: 5_000_000,
                liquidityUsd: 50_000_000,
                score: 72,
                pairAgeHours: null,
                url: null,
                flags: [],
                rationale: ["FX major · TwelveData spot · turbo hunt"],
              };
              const fxVerdict = evaluateRiskAndSize(
                fxBook,
                fxCand,
                fxState.riskSettings,
                fxFloor,
                Date.now(),
                mathOverlays(fxBook),
              );
              if (!fxVerdict.allowed || fxVerdict.notional <= 0) continue;
              const fxResult = enter(fxBook, fxCand, Date.now(), fxFloor, {
                notional: fxVerdict.notional,
                stop: fxVerdict.stopPrice,
                target: fxVerdict.targetPrice,
              });
              if (!fxResult.ok) continue;
              const fxExec: TapeExecution = {
                id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                hash: makeHash("fx"),
                ts: Date.now(),
                symbol: pair,
                venue: "FX Spot",
                side: "BUY",
                price,
                qty: fxVerdict.qty,
                notional: fxVerdict.notional,
                latencyMs: 40,
                slippageBps: 0.2,
                type: "BOT_ENTRY",
                avenue: "SPOT_MOMENTUM",
                note: `Turbo FX BUY ${pair} · $${fxVerdict.notional.toFixed(2)} (R:R ${fxVerdict.riskRewardRatio}R)`,
                atr: fxVerdict.atr,
                riskReward: fxVerdict.riskRewardRatio,
              };
              const fxNote = `Turbo FX: ${pair} $${fxVerdict.notional.toFixed(2)} @ ${price.toFixed(4)}`;
              const afterFx = useDesk.getState();
              set({
                [fxState.mode]: fxResult.book,
                note: fxNote,
                log: pushLog(afterFx.log, fxNote),
                executions: [fxExec, ...afterFx.executions].slice(0, 100),
                turboEntries: afterFx.turboEntries + 1,
              });
              telegramAlert(`Monroe paper entry\n${fxNote}`);
              break; // one FX entry per cycle
            }
          }
        }

        // 2. Otherwise pick from market tape
        {
          const live = useDesk.getState();
          const tapeBook = live[live.mode];
          if (tapeBook.positions.length >= live.riskSettings.maxPositions) return;
          const turboNow = live.riskSettings.sizingProfile === "TURBO";
          const floorNow = turboNow ? Math.max(45, live.memory.minScore - 15) : live.memory.minScore;
          const pick = chooseEntry(tapeBook, live.tape, floorNow, Date.now(), (id) =>
            securityVerdictOf(live.security, id),
          );
          if (!pick || fibBlocked(pick.symbol) || isHalted(pick.symbol, live.eventHalts)) return;

          // Run through the quantitative risk engine
          const verdict = evaluateRiskAndSize(
            tapeBook,
            pick,
            live.riskSettings,
            floorNow,
            Date.now(),
            mathOverlays(tapeBook),
          );

          if (!verdict.allowed || verdict.notional <= 0) return;

          // Execute with risk-engine volatility-adjusted sizing and brackets
          const result = enter(tapeBook, pick, Date.now(), floorNow, {
            notional: verdict.notional,
            stop: verdict.stopPrice,
            target: verdict.targetPrice,
          });

          if (!result.ok) return;

        const venueName = venueFor(pick);
        const hashStr = pick.chain === "solana" ? makeSolHash() : makeHash();
        const latency = 32 + Math.floor(Math.random() * 40);

        const exec: TapeExecution = {
          id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          hash: hashStr,
          ts: Date.now(),
          symbol: pick.symbol,
          venue: venueName,
          side: "BUY",
          price: pick.priceUsd,
          qty: verdict.qty,
          notional: verdict.notional,
          latencyMs: latency,
          slippageBps: 0.4,
          type: "BOT_ENTRY",
          avenue: "SPOT_MOMENTUM",
          note: `Sniper BUY ${pick.symbol} · Vol Sized $${verdict.notional.toFixed(2)} (ATR ${(verdict.atr * 100).toFixed(2)}%, R:R ${verdict.riskRewardRatio}R)`,
          atr: verdict.atr,
          riskReward: verdict.riskRewardRatio,
        };

        const edge = assessEdge(pick);
        const noteLine = `${edge.stance === "EARLY" ? "Early position" : "Risk-sized buy"}: ${pick.symbol} $${verdict.notional.toFixed(2)} on ${venueName}. ${edge.why}`;

        // Fresh state: a turbo avenue entry may have landed above in this cycle.
        const fresh = useDesk.getState();
        set({
          [targetKey]: result.book,
          note: noteLine,
          log: pushLog(fresh.log, noteLine),
          executions: [exec, ...fresh.executions].slice(0, 100),
          turboEntries: fresh.turboEntries + (turboNow ? 1 : 0),
        });
        telegramAlert(`Monroe paper entry\n${noteLine}`);
        }
      },

      manualEnter: (c: Candidate) => {
        const s = get();
        if (s.mode !== "demo") {
          return { ok: false, note: "Live execution is unavailable; this desk only supports paper simulation." };
        }
        if (s.turboPhase === "cooling") {
          return { ok: false, note: "Turbo cooling — new entries resume when the cooldown lapses (or bypass it)." };
        }
        if (securityVerdictOf(s.security, c.id) === "reject") {
          return { ok: false, note: "Blocked: live security audit hard-rejected this token (honeypot, mint/freeze authority, unlocked LP, or >15% tax)." };
        }
        const targetKey = s.mode;
        const currentBook = s[targetKey];
        const isTurbo = s.selectedModel.id === "[degen]";
        const floor = isTurbo ? Math.max(45, s.memory.minScore - 15) : s.memory.minScore;

        // Evaluate sizing with risk engine
        const verdict = evaluateRiskAndSize(
          currentBook,
          c,
          s.riskSettings,
          floor,
          Date.now(),
          mathOverlays(currentBook),
        );

        const notional = verdict.allowed ? verdict.notional : 20;
        const result = enter(currentBook, c, Date.now(), floor, {
          notional,
          stop: verdict.stopPrice,
          target: verdict.targetPrice,
        });

        if (!result.ok) {
          return { ok: false, note: result.note, verdict };
        }

        const venueName = venueFor(c);
        const exec: TapeExecution = {
          id: `manual-${Date.now()}`,
          hash: c.chain === "solana" ? makeSolHash() : makeHash(),
          ts: Date.now(),
          symbol: c.symbol,
          venue: venueName,
          side: "BUY",
          price: c.priceUsd,
          qty: notional / c.priceUsd,
          notional,
          latencyMs: 35,
          slippageBps: 0.5,
          type: "BOT_ENTRY",
          note: `Manual Snipe ${c.symbol} · Sized $${notional.toFixed(2)} [${s.mode.toUpperCase()}]`,
          atr: verdict.atr,
          riskReward: verdict.riskRewardRatio,
        };

        const note = `Filled ${c.symbol} $${notional.toFixed(2)} [${s.mode.toUpperCase()}]`;
        set({
          [targetKey]: result.book,
          note,
          log: pushLog(s.log, note),
          executions: [exec, ...s.executions].slice(0, 100),
          turboEntries: s.turboEntries + (isTurbo && s.turboPhase === "running" ? 1 : 0),
        });
        telegramAlert(`Monroe paper entry\n${note}`);
        return { ok: true, note, verdict };
      },

      flatten: (id: string) => {
        const s = get();
        const mode = s.mode;
        const book = closeOne(s[mode], id);
        const didClose = book.positions.length < s[mode].positions.length;
        const closed = didClose ? book.trades[0] : undefined;
        const memory = didClose && closed ? learn(s.memory, closed.pnl) : s.memory;
        set({
          [mode]: book,
          memory,
          note: didClose && closed ? `Flattened ${closed.symbol}: PnL $${closed.pnl.toFixed(2)}` : "Position closed",
          log: pushLog(
            s.log,
            didClose && closed
              ? `Flattened ${closed.symbol} (${closed.pnl >= 0 ? "+" : ""}$${closed.pnl.toFixed(2)})`
              : "Flattened",
          ),
        });
        if (didClose && closed) archiveClosedTrades([{ trade: closed, mode }]);
      },

      flattenAll: () => {
        const s = get();
        const mode = s.mode;
        let book = s[mode];
        let memory = s.memory;
        const closedTrades: ClosedTrade[] = [];
        for (const position of [...book.positions]) {
          book = closeOne(book, position.id);
          const closed = book.trades[0];
          if (closed) {
            closedTrades.push(closed);
            memory = learn(memory, closed.pnl);
          }
        }
        set({
          [mode]: book,
          memory,
          note: "All open paper positions flattened.",
          log: pushLog(s.log, `Flattened all [${mode.toUpperCase()}]`),
        });
        archiveClosedTrades(closedTrades.map((trade) => ({ trade, mode })));
      },

      halt: (on: boolean) =>
        set((s) => ({
          demo: setKill(s.demo, on),
          live: setKill(s.live, on),
          note: on ? "Kill switch activated. All new entries blocked." : "Kill switch cleared.",
          log: pushLog(s.log, on ? "Kill switch ON" : "Kill switch cleared"),
        })),

      fund: (side, amount) => {
        const s = get();
        if (s.mode === "live") {
          return {
            ok: false,
            note: "External deposits and withdrawals are unavailable; this app has no connected broker or funds rail.",
          };
        }
        if (!(amount > 0)) {
          return { ok: false, note: "Amount must be greater than zero." };
        }

        const now = Date.now();
        const targetBook = s.demo;

        if (side === "in") {
          const updatedBook = deposit(targetBook, amount);
          const tx: WalletTx = {
            id: `tx-dep-${now}`,
            ts: now,
            type: "DEPOSIT",
            amount,
            mode: "demo",
            network: "Paper simulation",
            status: "CONFIRMED",
            note: `Paper balance increased by $${amount.toFixed(2)}.`,
          };
          set({
            demo: updatedBook,
            walletHistory: [tx, ...s.walletHistory],
            note: `Added $${amount.toFixed(2)} to the paper balance.`,
            log: pushLog(s.log, `Paper balance +$${amount.toFixed(2)}`),
          });
          return { ok: true, note: `Added $${amount.toFixed(2)} to the paper balance.` };
        }

        if (amount > targetBook.cash + 0.0001) {
          return { ok: false, note: `Insufficient free cash. Available: $${targetBook.cash.toFixed(2)}` };
        }

        const wResult = withdraw(targetBook, amount);
        if (!wResult.ok) {
          return wResult;
        }

        const tx: WalletTx = {
          id: `tx-wth-${now}`,
          ts: now,
          type: "WITHDRAWAL",
          amount,
          mode: "demo",
          network: "Paper simulation",
          status: "CONFIRMED",
          note: `Paper balance decreased by $${amount.toFixed(2)}.`,
        };

        set({
          demo: wResult.book,
          walletHistory: [tx, ...s.walletHistory],
          note: `Removed $${amount.toFixed(2)} from the paper balance.`,
          log: pushLog(s.log, `Paper balance -$${amount.toFixed(2)}`),
        });
        return { ok: true, note: `Removed $${amount.toFixed(2)} from the paper balance.` };
      },

      resetDemo: () =>
        set((s) => ({
          demo: emptyBook(DEMO_START),
          note: `Paper ledger reset to $${DEMO_START}.00. Archived trade learning remains intact.`,
          log: pushLog(s.log, `Demo reset to $${DEMO_START}.00`),
        })),

      setDemoBalance: (amount: number) =>
        set((s) => {
          const val = Math.max(50, amount);
          return {
            demo: emptyBook(val),
            note: `Demo desk capital rebalanced to $${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}. Dynamic sweet-spot sizing active.`,
            log: pushLog(s.log, `Demo balance rebalanced to $${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}`),
          };
        }),

    }),
    {
      name: "monroe-sniper-v4",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
          : localStorage,
      ),
      partialize: (s) => ({
        power: s.power,
        mode: s.mode,
        demo: s.demo,
        live: s.live,
        memory: s.memory,
        log: s.log,
        walletHistory: s.walletHistory,
        riskSettings: s.riskSettings,
        disciplineRules: s.disciplineRules,
        tradeLearningDbCount: s.tradeLearningDbCount,
        dbSource: s.dbSource,
        dbLastWriteAt: s.dbLastWriteAt,
        dbGrossWin: s.dbGrossWin,
        dbGrossLoss: s.dbGrossLoss,
        turboPhase: s.turboPhase,
        turboStartedAt: s.turboStartedAt,
        turboEndsAt: s.turboEndsAt,
        turboCooldownUntil: s.turboCooldownUntil,
        turboPrevProfile: s.turboPrevProfile,
        turboEntries: s.turboEntries,
        turboReport: s.turboReport,
        auditGiven: s.auditGiven,
        selectedModel: s.selectedModel,
        modelHistory: s.modelHistory,
        botStartedAt: s.botStartedAt,
      }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.mode = "demo";
          // Never disarm on refresh: the persisted power switch is the
          // owner's intent. The loop in Frame resumes auto-stepping.
          if (typeof state.power !== "boolean") state.power = false;
          if (state.demo && state.demo.cash === 100 && state.demo.trades.length === 0) {
            state.demo.cash = DEMO_START;
            state.demo.peakEquity = DEMO_START;
          }
          // Restore risk-model selection from localStorage if available.
          if (state.selectedModel) {
            useDesk.setState({ selectedModel: state.selectedModel });
          } else {
            useDesk.setState({ selectedModel:  "[paranoid]"  });
          }
          if (state.modelHistory) {
            useDesk.setState({ modelHistory: state.modelHistory });
          }
        }
      },
    },
  ),
);

/** Helper hook returning the active book based on whether mode is live or demo */
export function useActiveBook(): Book {
  const mode = useDesk((s) => s.mode);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  return mode === "live" ? live : demo;
}

export function useActiveEquity(): number {
  const book = useActiveBook();
  return equity(book);
}
