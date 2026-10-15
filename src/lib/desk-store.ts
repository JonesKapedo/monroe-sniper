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
  exposure,
  DEMO_START,
} from "./paper";
import {
  evaluateRiskAndSize,
  defaultRiskSettings,
  type RiskEngineSettings,
  type SizingProfile,
  type SizingVerdict,
} from "./sniper/risk-engine";
import { MODELS, type RiskModelProfile } from "./sniper/risk-models";
import {
  TIER_CONFIGS,
  applyStakeBudget,
  detectTier,
  type TierConfig,
  type TierName,
} from "./sniper/tier-config";
import {
  DEFAULT_PROFIT_LOCK_CONFIG,
  applyProfitLock,
  formatProfitLockStatus,
  type ProfitLockState,
  type ProfitLockConfig,
} from "./sniper/profit-lock";
import {
  DEFAULT_EQUITY_GUARD_CONFIG,
  createInitialEquityGuardState,
  evaluateEquityGuard as evaluateGuard,
  recordTradeOutcome,
  manualHalt as guardHalt,
  manualResume as guardResume,
  type EquityGuardState,
  type EquityGuardConfig,
  type GuardEvaluationResult,
} from "./sniper/equity-guard";
import {
  calculateDynamicSize,
  type SizingContext,
  type SizingResult as DynamicSizingResult,
} from "./sniper/dynamic-sizing";
import { setupVector, type SetupVector } from "./math/vectors";
import { fibReentryDelayMin } from "./math/fib";
import { useMascot } from "./mascot";
import { getDbHealth, saveTradeLearning, type TradeLearningEvent } from "./trade-memory.functions";
import { markWhaleActed } from "./whales.functions";
import { evaluateWhaleMoveForCopy, type WhaleProfile } from "./whales/intelligence";
import type { AvenueCategory, DisciplineRules, PaperReadiness } from "./avenues/types";
import {
  defaultDisciplineRules,
  avenueAnchorPrice,
  avenueAnchors,
  scanAllAvenues,
  calculatePaperReadiness,
  tapeContextFor,
} from "./avenues/engine";
import type { PerpFunding } from "./perps/hyperliquid";
import { useDyorStore } from "./dyor/store";
import { playHawkCry, playSoftChirp } from "./sound";
import { assessEdge } from "./intel/emh";

export type Mode = "demo" | "live";
export type DbSource = "neon" | "pglite" | "unknown";
export type TurboPhase = "off" | "running" | "cooling";

/** A turbo run is 34 minutes with progress audits at 8, 13, and 21 minutes, then a 10-minute cooldown. */
/** Legacy defaults — turbo timing now lives in state (turboRunMinutes). Kept for reference. */
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
  | "FX Spot"
  | "Hyperliquid Perps"
  | "Solana DEX";

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
  whaleEnter: (
    c: Candidate,
    sig: string,
    walletLabel: string,
  ) => Promise<{ ok: boolean; note: string; verdict?: SizingVerdict; whaleCheck?: unknown }>;
  /** Fib re-entry memory */
  stopStreak: Record<string, number>;
  lastStopAt: Record<string, number>;
  /** Last close timestamp per symbol, ANY reason — kills 7-second re-fire loops. */
  lastCloseAt: Record<string, number>;
  /** Turbo kill switch */
  stopTurbo: () => { ok: boolean; note: string };
  setPower: (on: boolean) => void;
  setMode: (mode: Mode) => void;
  setTape: (rows: Candidate[], note: string) => void;
  tick: (
    prices: Record<string, number>,
    monitorOnly?: boolean,
    staleIds?: ReadonlySet<string>,
  ) => void;
  autoStep: () => void;
  manualEnter: (c: Candidate) => { ok: boolean; note: string; verdict?: SizingVerdict };
  flatten: (id: string) => void;
  startTurbo: () => { ok: boolean; note: string };
  bypassTurboCooldown: () => void;
  tickTurbo: () => void;
  // Turbo mode: 34-minute runs with progress audits at 8/13/21 min, then 10-min cooldown.
  turboPhase: TurboPhase;
  turboStartedAt: number | null;
  turboEndsAt: number | null;
  turboCooldownUntil: number | null;
  turboPrevProfile: SizingProfile | null;
  turboEntries: number;
  turboReport: TurboReport | null;
  auditGiven: { 8: boolean; 13: boolean; 21: boolean };
  // Profit locking & tier system
  profitLockState: ProfitLockState;
  profitLockConfig: ProfitLockConfig;
  currentTier: TierName;
  tierConfig: TierConfig;
  // Equity guard
  equityGuardState: EquityGuardState;
  equityGuardConfig: EquityGuardConfig;
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
  // Profit lock & tier
  applyProfitLock: (currentEquity: number) => void;
  getProfitLockStatus: (currentEquity: number) => ReturnType<typeof formatProfitLockStatus>;
  updateProfitLockConfig: (patch: Partial<ProfitLockConfig>) => void;
  // Tier
  updateTier: (equity: number) => void;
  getTierConfig: () => TierConfig;
  // Equity guard
  evaluateEquityGuard: (currentEquity: number) => GuardEvaluationResult;
  recordTradePnl: (pnl: number) => void;
  manualHalt: (reason: string, durationMinutes?: number) => void;
  manualResume: () => void;
  // Dynamic sizing
  calculatePositionSize: (
    entryPrice: number,
    atrPct: number,
    conviction: number,
    side?: "LONG" | "SHORT",
  ) => DynamicSizingResult;
  // Backfill
  backfillQualifyingTrades: () => Promise<void>;
  /**
   * Operator-approved purge of tainted learning: clears local closed-trade
   * history, adaptive memory, DB event cache and re-entry memory. Open
   * positions and cash are untouched. Pair with purgeTradeLearning (server)
   * so the database restarts clean too.
   */
  purgeLearningHistory: () => void;
  /**
   * Bot interoperability: which engines may open entries. Manual entries are
   * always allowed. The shared kill switch / equity guard still governs all.
   */
  entrySources: { avenues: boolean; tape: boolean; whale: boolean };
  setEntrySource: (key: "avenues" | "tape" | "whale", on: boolean) => void;
  /** Live-tunable capital protection (trailing stop, daily loss, halts). */
  updateEquityGuardConfig: (patch: Partial<EquityGuardConfig>) => void;
  /** Turbo run / cooldown lengths in minutes. */
  setTurboRunMinutes: (minutes: number) => void;
  setTurboCooldownMinutes: (minutes: number) => void;
  /** Background engine cycle (market + whale refresh, guard, profit lock). */
  engineCycle: { enabled: boolean; minutes: number };
  setEngineCycle: (patch: Partial<{ enabled: boolean; minutes: number }>) => void;
  /** Whale-copy master switch plus qualification floors. */
  whaleSettings: { enabled: boolean; minMoves: number; minWinRate: number; minConfidence: number };
  updateWhaleSettings: (
    patch: Partial<{ enabled: boolean; minMoves: number; minWinRate: number; minConfidence: number }>,
  ) => void;
  /** Paper-discipline targets (qualifying trades + win-rate floor). */
  readinessTargets: { trades: number; winRate: number };
  setReadinessTargets: (patch: Partial<{ trades: number; winRate: number }>) => void;
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

function venueFor(c: Pick<Candidate, "venue" | "chain">): ExecutionVenue {
  if (c.venue === "fx" || c.chain === "fx") return "FX Spot";
  if (c.venue === "hyperliquid") return "Hyperliquid Perps";
  if (c.venue === "binance") return "Binance Spot";
  // DEX fills never record which pool routed them, so venue display stays at
  // chain level instead of guessing a DEX name.
  if (c.chain === "solana") return "Solana DEX";
  if (c.chain === "bsc") return "PancakeSwap";
  return "Uniswap v3";
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/** Last skip-log timestamp per avenue id — throttles no-quote notices. */
const lastAnchorSkipLog = new Map<string, number>();

/**
 * Effective price-source identity for a position. New positions record it at
 * entry; legacy perp positions (opened before source tracking) derive it
 * from their `perp-{coin}-funding` token id so the same-venue rule covers
 * them too. Returns undefined for legacy non-perp positions (tape behavior).
 */
function positionPriceSource(p: { priceSource?: string; tokenId: string }): string | undefined {
  if (p.priceSource !== undefined) return p.priceSource;
  if (p.tokenId.startsWith("perp-") && p.tokenId.endsWith("-funding")) {
    return `hyperliquid:${p.tokenId.slice(5, -8).toUpperCase()}`;
  }
  return undefined;
}

/**
 * Final portfolio-stake guard shared by every entry path (bot avenue, bot
 * tape, manual, whale-via-manual). Caps the position so total staked across
 * ALL open positions never exceeds the tier budget, splitting the remaining
 * budget proportionally to this position's target.
 */
function clampToStakeBudget(
  tier: TierConfig,
  book: Book,
  riskNotional: number,
  targetPct: number,
): { notional: number; blocked: boolean; reason: string; budget: number; remaining: number } {
  const res = applyStakeBudget({
    equity: equity(book),
    tier,
    currentExposure: exposure(book),
    riskNotional,
    targetPct,
  });
  return {
    notional: res.notional,
    blocked: res.blocked,
    reason: res.reason,
    budget: res.budget,
    remaining: res.remaining,
  };
}

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
  sources?: Record<string, string>,
): { book: Book; memory: Memory; newTrades: typeof book.trades } {
  const priorIds = new Set(book.trades.map((trade) => trade.id));
  const next = markBook(book, prices, Date.now(), !monitorOnly, { staleIds, sources });
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
      stopStreak: {},
      lastStopAt: {},
      lastCloseAt: {},
      turboPhase: "off",
      turboStartedAt: null,
      turboEndsAt: null,
      turboCooldownUntil: null,
      turboPrevProfile: null,
      turboEntries: 0,
      turboReport: null,
      auditGiven: { 8: false, 13: false, 21: false },
      // Profit locking & tier system
      profitLockState: {
        baseEquity: DEMO_START,
        compoundingEquity: Math.min(DEMO_START * 0.1, 1000),
        lockedProfits: 0,
        peakEquity: DEMO_START,
        totalCompounded: 0,
      },
      profitLockConfig: DEFAULT_PROFIT_LOCK_CONFIG,
      currentTier: "micro",
      tierConfig: TIER_CONFIGS.micro,
      // Equity guard
      equityGuardState: {
        isHalted: false,
        haltReason: null,
        haltUntil: null,
        riskMultiplier: 1.0,
        consecutiveLosses: 0,
        consecutiveWins: 0,
        lastTradePnl: 0,
        lastTradeAt: null,
        startOfDayEquity: DEMO_START,
        startOfDayAt: Date.now(),
        dailyLossPct: 0,
        startOfWeekEquity: DEMO_START,
        startOfWeekAt: Date.now(),
        cooldownUntil: null,
        cooldownReason: null,
        dailyProfitTargetHit: false,
        weeklyProfitTargetHit: false,
        lastUpdated: Date.now(),
      },
      equityGuardConfig: DEFAULT_EQUITY_GUARD_CONFIG,
      // Bot interoperability — which engines may open entries.
      entrySources: { avenues: true, tape: true, whale: true },
      // Background engine cycle (market + whale refresh, guard, profit lock).
      engineCycle: { enabled: true, minutes: 5 },
      // Whale-copy master switch plus qualification floors.
      whaleSettings: { enabled: true, minMoves: 20, minWinRate: 65, minConfidence: 70 },
      // Paper-discipline targets (qualifying trades + win-rate floor).
      readinessTargets: { trades: 200, winRate: 65 },
      // Risk-model selection — persists across page visits via localStorage.
      selectedModel: MODELS["[paranoid]"],
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
        const runMinutes = Math.round(Math.min(120, Math.max(5, s.turboRunMinutes ?? 34)));
        set({
          turboPrevProfile: s.selectedModel.id,
          riskSettings: { ...s.riskSettings, sizingProfile: "[degen]" },
          turboPhase: "running",
          turboStartedAt: now,
          turboEndsAt: now + runMinutes * 60_000,
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
          note: `TURBO ARMED — ${runMinutes}-minute max-aggression run. Safety gates stay armed.`,
          log: pushLog(s.log, `TURBO run started (${runMinutes}:00)`),
        });
        try {
          useMascot.getState().react("turbo-start");
        } catch {
          // mascot is UI-only
        }
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
          if (!auditMinutes[8] && elapsed >= 8 * 60_000) {
            useDesk.setState({ auditGiven: { ...auditMinutes, 8: true } });
            // TODO: emit audit panel event — collect metrics and show debrief.
            // console.log("[Degen] 8-minute progress audit triggered");
          }
          if (!auditMinutes[13] && elapsed >= 13 * 60_000) {
            useDesk.setState({ auditGiven: { ...auditMinutes, 13: true } });
            // TODO: emit audit panel event.
            // console.log("[Degen] 13-minute progress audit triggered");
          }
          if (!auditMinutes[21] && elapsed >= 21 * 60_000) {
            useDesk.setState({ auditGiven: { ...auditMinutes, 21: true } });
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

      whaleEnter: async (c, sig, walletLabel) => {
        const s = get();
        if (s.mode !== "demo" || !s.power || s.turboPhase === "cooling") {
          return { ok: false, note: "Bot is not taking entries right now" };
        }
        if (!s.entrySources.whale || !s.whaleSettings.enabled) {
          return { ok: false, note: "Whale copy is paused in Settings → Bot interoperability." };
        }
        if (s.actedSigs.includes(sig)) {
          return { ok: false, note: "Already acted on this whale move" };
        }

        // Pre-copy gate: new whale (no history) falls back to legacy risk-gated path
        // so tracking starts immediately while the registry builds qualifying history.
        const whaleProfile: WhaleProfile = {
          wallet: c.address,
          label: walletLabel,
          chain: c.chain,
          minUsd: 25000,
          followMode: "auto-copy",
          createdAt: Date.now(),
          lastAnalyzed: Date.now(),
          totalMovesTracked: 0,
          qualifyingMoves: 0,
          strategyTag: "unknown",
          confidenceScore: 0,
          winRate: 0,
          avgHoldMinutes: 0,
          preferredVenues: [],
          preferredChains: [],
          astronomyCorrelation: 0,
          movesByStrategy: {} as WhaleProfile["movesByStrategy"],
          movesByVenue: {},
          movesByDirection: {} as WhaleProfile["movesByDirection"],
          avgMoveSizeUsd: 0,
          maxMoveSizeUsd: 0,
          timePatterns: [],
        };

        const currentEquity = equity(s[s.mode]);
        const currentPositions = s[s.mode].positions.length;
        const maxPositions = s.riskSettings.maxPositions;

        const riskEngineAdapter = (cand: Candidate) => {
          const overlays = mathOverlays(s[s.mode]);
          const isTurbo = s.selectedModel.id === "[degen]";
          const floor = isTurbo ? Math.max(45, s.memory.minScore - 15) : s.memory.minScore;
          const v = evaluateRiskAndSize(
            s[s.mode],
            cand,
            s.riskSettings,
            floor,
            Date.now(),
            overlays,
            s.selectedModel.id,
          );
          return {
            allowed: v.allowed,
            notional: v.notional,
            stopPrice: v.stopPrice,
            targetPrice: v.targetPrice,
            score: c.score,
          };
        };

        const preCopyResult = await evaluateWhaleMoveForCopy(
          {
            signature: sig,
            wallet: c.address,
            mint: c.address,
            symbol: c.symbol,
            direction: "IN",
            amount: 1,
            usdEstimate: c.priceUsd,
            priceUsd: c.priceUsd,
            venue: c.venue === "binance" ? "Binance" : c.chain,
            chain: c.chain,
            blockTime: Math.floor(Date.now() / 1000),
          },
          whaleProfile,
          riskEngineAdapter,
          currentEquity,
          currentPositions,
          maxPositions,
          {
            minMoves: s.whaleSettings.minMoves,
            minWinRate: s.whaleSettings.minWinRate,
            minConfidence: s.whaleSettings.minConfidence,
          },
        );

        // New wallet: log the gate outcome but still allow the legacy risk-gated
        // manualEnter so tracking/active learning is not blocked on day one.
        // Once the registry has 20+ qualifying moves + 65% WR + 70 confidence,
        // the gate will enforce PASS-only copies.
        const isNewWalletGate =
          !preCopyResult.allowed &&
          (preCopyResult.reason.includes("qualifying moves") ||
            preCopyResult.reason.includes("confidence") ||
            preCopyResult.reason.includes("win rate"));

        if (!preCopyResult.allowed && !isNewWalletGate) {
          return {
            ok: false,
            note: `Pre-copy gate: ${preCopyResult.reason}`,
          };
        }

        const res = get().manualEnter({
          ...c,
          rationale: [
            ...c.rationale,
            isNewWalletGate
              ? `Whale copy (learning): ${walletLabel} accumulated ${c.symbol} — registry building history`
              : `Whale copy: ${walletLabel} (${preCopyResult.whaleProfile.strategyTag}) — ${preCopyResult.reason}`,
          ],
        });
        if (!res.ok) return res;

        void markWhaleActed({ data: { signatures: [sig] } }).catch(() => undefined);
        useDesk.setState((prev) => ({
          actedSigs: [sig, ...prev.actedSigs].slice(0, 200),
          log: pushLog(
            prev.log,
            `Whale copy: ${c.symbol} behind ${walletLabel} [${preCopyResult.riskModelVerdict}] — ${res.note}`,
          ),
        }));
        return { ...res, whaleCheck: preCopyResult };
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

      setPower: (on) => {
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
        }));
        try {
          useMascot.getState().react(on ? "arm-bot" : "disarm-bot");
        } catch {
          // mascot is UI-only
        }
      },

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
          ...book.trades
            .filter((t) => teachable(t.pnl, t.simulated, t.reason))
            .map((t) => ({ pnl: t.pnl, reason: t.reason, simulated: t.simulated })),
          ...s.dbEvents
            .filter((e) => !seenIds.has(e.id))
            .map((e) => ({ pnl: e.pnl, reason: e.reason })),
        ];
        return calculatePaperReadiness(book, history, {
          trades: s.readinessTargets.trades,
          winRate: s.readinessTargets.winRate,
        });
      },

      tick: (prices, monitorOnly = false, staleIds: ReadonlySet<string> = EMPTY_SET) => {
        const s = get();
        // Live Hyperliquid marks keyed by avenue position id. Perp positions
        // are marked ONLY by these — never by tape spot quotes.
        const hyperMarks: Record<string, number> = {};
        for (const row of s.perpFunding) {
          if (row.markPx !== null && row.markPx > 0) {
            hyperMarks[`perp-${row.coin.toLowerCase()}-funding`] = row.markPx;
          }
        }
        // Enrich the feed map so every open position has a price. Positions
        // carrying a hyperliquid priceSource resolve ONLY via hyperMarks;
        // everything else resolves via tape, then anchor, then holds stale.
        // Sources are recorded so markBook rejects cross-source marking.
        const enriched: Record<string, number> = { ...prices };
        const sources: Record<string, string> = {};
        for (const id of Object.keys(prices)) sources[id] = `tape:${id}`;
        const openPositions = [...s.demo.positions, ...s.live.positions];
        if (openPositions.some((p) => !(enriched[p.tokenId] > 0))) {
          const anchors = avenueAnchors(s.demo, s.disciplineRules, Date.now(), {
            funding: s.perpFunding,
          });
          for (const p of openPositions) {
            if (enriched[p.tokenId] > 0) continue;
            const src = positionPriceSource(p);
            if (src?.startsWith("hyperliquid:")) {
              const px = hyperMarks[p.tokenId];
              if (px !== undefined && px > 0) {
                enriched[p.tokenId] = px;
                sources[p.tokenId] = src;
              }
              // Otherwise the perp position holds its last mark flagged stale:
              // no drift, no stop/target on invented prices, no learning.
              continue;
            }
            const anchor = anchors.get(p.tokenId);
            const px = anchor ? avenueAnchorPrice(anchor, s.tape) : null;
            if (px !== null) {
              enriched[p.tokenId] = px;
              sources[p.tokenId] = `anchor:${anchor}`;
            }
            // Otherwise the position holds its last mark flagged stale:
            // no drift, no stop/target on invented prices, no learning.
          }
        }
        // Positions already priced above keep the source of the feed row that
        // priced them (tape ids) so same-venue enforcement has context.
        // Perp positions always resolve to their hyperliquid identity so a
        // tape spot quote can never mark them, even when enriched above.
        for (const p of openPositions) {
          if (sources[p.tokenId] === undefined && enriched[p.tokenId] > 0) {
            sources[p.tokenId] = positionPriceSource(p) ?? `tape:${p.tokenId}`;
          }
        }
        const demoAbs = absorb(s.demo, enriched, s.memory, monitorOnly, staleIds, sources);
        const liveAbs = absorb(s.live, enriched, demoAbs.memory, monitorOnly, staleIds, sources);
        const closedTrades = [
          ...demoAbs.newTrades.map((trade) => ({ trade, mode: "demo" as const })),
          ...liveAbs.newTrades.map((trade) => ({ trade, mode: "live" as const })),
        ];
        let nextExecs = s.executions;
        let nextLog = s.log;
        const stopStreak = { ...s.stopStreak };
        const lastStopAt = { ...s.lastStopAt };
        const lastCloseAt = { ...s.lastCloseAt };

        for (const { trade, mode } of closedTrades) {
          // Any close sits the symbol out: TARGET loops re-firing every cycle
          // manufactured the phantom win streaks. 30 minutes, all modes.
          lastCloseAt[trade.symbol] = trade.closedAt;
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
            venue: venueFor({
              venue: trade.venue ?? (trade.symbol.includes("USDT") ? "binance" : "dex"),
              chain: trade.chain ?? "",
            }),
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
          lastCloseAt,
        });
        if (closedTrades.length > 0) {
          const lines = closedTrades.map(({ trade }) => {
            const isProfit = trade.pnl > 0;
            return `${trade.reason === "TARGET" ? "✅ TP" : trade.reason === "STOP" ? "🛑 SL" : "📕 Closed"} ${trade.symbol} ${isProfit ? "+" : ""}$${trade.pnl.toFixed(2)}`;
          });
          telegramAlert(`Monroe paper closes (${closedTrades.length}):\n${lines.slice(0, 8).join("\n")}`);
        }
        archiveClosedTrades(closedTrades);
        
        // Apply profit lock after trades close
        const finalEquity = equity(demoAbs.book);
        const lockResult = applyProfitLock(s.profitLockState, finalEquity, s.profitLockConfig);
        if (lockResult.applied) {
          set({
            profitLockState: lockResult.newState,
            currentTier: detectTier(lockResult.newState.baseEquity, s.currentTier),
            tierConfig: TIER_CONFIGS[detectTier(lockResult.newState.baseEquity, s.currentTier)],
            note: `Profit lock: +$${lockResult.lockAmount.toFixed(2)} locked, $${lockResult.compoundAmount.toFixed(2)} compounding`,
            log: pushLog(s.log, `🔒 Profit lock: $${lockResult.lockAmount.toFixed(2)} locked, $${lockResult.compoundAmount.toFixed(2)} compounding → Base: $${lockResult.newState.baseEquity.toFixed(2)}`),
          });
        }
      },

      autoStep: () => {
        get().tickTurbo();
        const s = get();
        if (!s.power || s.mode !== "demo") return;
        // Cooling halts entries only — open positions still ride to exits via tick().
        if (s.turboPhase === "cooling") return;
        
        // Equity guard evaluation - runs every cycle
        const targetKey = s.mode;
        const currentBook = s[targetKey];
        const currentEquity = equity(currentBook);
        const guardResult = evaluateGuard(s.equityGuardState, currentEquity, s.equityGuardConfig);
        if (guardResult.actions.length > 0) {
          set({ equityGuardState: guardResult.newState });
          if (!guardResult.allowed) {
            // Log the halt reason
            for (const action of guardResult.actions) {
              if (action.type === "HALT" || action.type === "COOLDOWN" || action.type === "REDUCE_RISK") {
                return; // Halt new entries
              }
            }
          }
        }
        if (currentBook.positions.length >= s.riskSettings.maxPositions) return;
        const isTurbo = s.selectedModel.id === "[degen]";
        // Model-profile score floor: [degen] drops 15 points, never below 45.
        const scoreFloor = isTurbo ? Math.max(45, s.memory.minScore - 15) : s.memory.minScore;
        const overlays = mathOverlays(currentBook);

        // Re-entry discipline, all modes: any symbol closed within the
        // configured cooldown sits out. TARGET loops re-firing every cycle is
        // exactly how phantom win streaks were manufactured — no legitimate
        // setup needs the same symbol twice in half an hour.
        // Fib-spaced re-entry stacks on top for turbo stops.
        const cooldownMs = Math.max(
          5,
          Math.min(120, s.disciplineRules.reentryCooldownMinutes ?? 30),
        ) * 60_000;
        const fibBlocked = (symbol: string): boolean => {
          const now = Date.now();
          const lastClose = s.lastCloseAt[symbol];
          if (lastClose && now - lastClose < cooldownMs) return true;
          if (!isTurbo) return false;
          const last = s.lastStopAt[symbol];
          if (!last) return false;
          const delayMin = fibReentryDelayMin(s.stopStreak[symbol] ?? 1);
          return now - last < delayMin * 60_000;
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

        // If a live-verified avenue setup is available, execute with disciplined
        // parameters. Volume/liquidity/volatility come from the live tape via
        // the avenue anchor — absent tape context means no entry (fail-closed).
        // Pausable from Settings → Bot interoperability.
        if (s.entrySources.avenues && unheldAvenue) {
          const tapeCtx = tapeContextFor(unheldAvenue.anchorSymbol, s.tape);
          if (!tapeCtx) {
            // Throttled: one skip line per avenue per 30 minutes, not per cycle.
            const lastSkip = lastAnchorSkipLog.get(unheldAvenue.id) ?? 0;
            if (Date.now() - lastSkip > 30 * 60_000) {
              lastAnchorSkipLog.set(unheldAvenue.id, Date.now());
              set({
                log: pushLog(
                  s.log,
                  `Avenue waiting on live quote: ${unheldAvenue.symbol} (anchor ${unheldAvenue.anchorSymbol ?? "?"} not on tape — resolving)`,
                ),
              });
            }
          } else {
          const aveCand: Candidate = {
            id: unheldAvenue.id,
            symbol: unheldAvenue.symbol,
            name: unheldAvenue.symbol,
            address: unheldAvenue.id,
            chain: "hyperliquid",
            venue: "hyperliquid",
            priceUsd: unheldAvenue.priceA,
            change24h: tapeCtx.change24h,
            volume24h: tapeCtx.volume24h,
            liquidityUsd: tapeCtx.liquidityUsd ?? 0,
            liquidityUnknown: tapeCtx.liquidityUnknown || undefined,
            score: unheldAvenue.confidenceScore,
            pairAgeHours: null,
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
            // Final stake guard: portfolio budget split by this position's target.
            const stake = clampToStakeBudget(
              s.tierConfig,
              currentBook,
              Math.min(verdict.notional, unheldAvenue.maxCapitalAllocationUsd),
              verdict.takeProfitPct,
            );
            if (stake.blocked) {
              set({
                log: pushLog(s.log, `Stake guard blocked ${unheldAvenue.symbol}: ${stake.reason}`),
              });
            }
            const notional = stake.blocked ? 0 : stake.notional;
            const result = stake.blocked
              ? { ok: false as const, note: stake.reason, book: currentBook }
              : enter(currentBook, aveCand, Date.now(), scoreFloor, {
                  notional,
                  stop: unheldAvenue.stopLossPrice,
                  target: unheldAvenue.targetPrice,
                  priceSource: `hyperliquid:${(unheldAvenue.anchorSymbol ?? unheldAvenue.symbol).toUpperCase()}`,
                });

            if (result.ok) {
              const hashStr = makeSolHash();
              const exec: TapeExecution = {
                id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                hash: hashStr,
                ts: Date.now(),
                symbol: unheldAvenue.symbol,
                venue: venueFor(aveCand),
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
        }

        // 2. Otherwise pick from market tape (pausable from Bot interoperability).
        if (s.entrySources.tape) {
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

          // Final stake guard: portfolio budget split by this position's target.
          const tapeStake = clampToStakeBudget(
            live.tierConfig,
            tapeBook,
            verdict.notional,
            verdict.takeProfitPct,
          );
          if (tapeStake.blocked) {
            useDesk.setState((prev) => ({
              log: pushLog(prev.log, `Stake guard blocked ${pick.symbol}: ${tapeStake.reason}`),
            }));
            return;
          }

          // Execute with risk-engine volatility-adjusted sizing and brackets
          const result = enter(tapeBook, pick, Date.now(), floorNow, {
            notional: tapeStake.notional,
            stop: verdict.stopPrice,
            target: verdict.targetPrice,
            priceSource: `tape:${pick.id}`,
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
          qty: pick.priceUsd > 0 ? tapeStake.notional / pick.priceUsd : verdict.qty,
          notional: tapeStake.notional,
          latencyMs: latency,
          slippageBps: 0.4,
          type: "BOT_ENTRY",
          avenue: "SPOT_MOMENTUM",
          note: `Sniper BUY ${pick.symbol} · Stake-sized $${tapeStake.notional.toFixed(2)} of $${tapeStake.budget.toFixed(2)} budget (ATR ${(verdict.atr * 100).toFixed(2)}%, R:R ${verdict.riskRewardRatio}R)`,
          atr: verdict.atr,
          riskReward: verdict.riskRewardRatio,
        };

        const edge = assessEdge(pick);
        const noteLine = `${edge.stance === "EARLY" ? "Early position" : "Risk-sized buy"}: ${pick.symbol} $${tapeStake.notional.toFixed(2)} on ${venueName}. ${edge.why}`;

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

        // Final stake guard (also covers the fallback path — a rejected
        // verdict never bypasses the portfolio budget with a fixed $20).
        const manualStake = clampToStakeBudget(
          s.tierConfig,
          currentBook,
          verdict.allowed ? verdict.notional : s.tierConfig.minNotional,
          verdict.takeProfitPct,
        );
        if (!verdict.allowed || manualStake.blocked) {
          return {
            ok: false,
            note: !verdict.allowed
              ? (verdict.reasons[0] ?? `Entry rejected by risk gates for ${c.symbol}.`)
              : `Stake guard blocked ${c.symbol}: ${manualStake.reason}`,
            verdict,
          };
        }
        const notional = manualStake.notional;
        const result = enter(currentBook, c, Date.now(), floor, {
          notional,
          stop: verdict.stopPrice,
          target: verdict.targetPrice,
          priceSource: `tape:${c.id}`,
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

      // Profit lock & tier
      applyProfitLock: (currentEquity: number) => {
        const s = get();
        const result = applyProfitLock(s.profitLockState, currentEquity, s.profitLockConfig);
        const newTier = detectTier(result.newState.baseEquity, s.currentTier);
        const tierChanged = newTier !== s.currentTier;
        set({
          profitLockState: result.newState,
          currentTier: newTier,
          tierConfig: TIER_CONFIGS[newTier],
          note: tierChanged
            ? `Tier changed: ${s.currentTier} → ${newTier} (Equity: $${result.newState.baseEquity.toFixed(2)})`
            : result.applied
              ? `Profit lock: +$${result.lockAmount.toFixed(2)} locked, $${result.compoundAmount.toFixed(2)} compounding (Tier: ${newTier})`
              : s.note,
          log: result.applied
            ? pushLog(
                s.log,
                `Profit lock: $${result.lockAmount.toFixed(2)} locked, $${result.compoundAmount.toFixed(2)} compounding → Base: $${result.newState.baseEquity.toFixed(2)}${tierChanged ? ` · Tier ${s.currentTier} → ${newTier}` : ""}`,
              )
            : s.log,
        });
        if (result.applied) {
          try {
            useMascot.getState().react(tierChanged ? "tier-upgrade" : "profit-lock");
          } catch {
            // mascot is UI-only
          }
        }
      },

      getProfitLockStatus: (currentEquity: number) => {
        const s = get();
        return formatProfitLockStatus(s.profitLockState, currentEquity);
      },

      updateProfitLockConfig: (patch: Partial<ProfitLockConfig>) =>
        set((s) => ({
          profitLockConfig: { ...s.profitLockConfig, ...patch },
          log: pushLog(s.log, `Profit lock config updated`),
        })),

      updateEquityGuardConfig: (patch) =>
        set((s) => ({
          equityGuardConfig: { ...s.equityGuardConfig, ...patch },
          log: pushLog(s.log, "Equity guard config updated"),
        })),

      updateTier: (equity: number) =>
        set((s) => {
          const newTier = detectTier(equity, s.currentTier);
          if (newTier !== s.currentTier) {
            return {
              currentTier: newTier,
              tierConfig: TIER_CONFIGS[newTier],
              log: pushLog(s.log, `📊 Tier updated: ${s.currentTier} → ${newTier} (Equity: $${equity.toFixed(2)})`),
            };
          }
          return {};
        }),

      getTierConfig: () => {
        const s = get();
        return s.tierConfig;
      },

      setEntrySource: (key, on) =>
        set((s) => ({
          entrySources: { ...s.entrySources, [key]: on },
          log: pushLog(
            s.log,
            `Entry source ${key} ${on ? "enabled" : "paused"} by operator`,
          ),
        })),

      setTurboRunMinutes: (minutes) =>
        set((s) => ({
          turboRunMinutes: Math.round(Math.min(120, Math.max(5, minutes))),
          log: pushLog(s.log, "Turbo run length updated"),
        })),

      setTurboCooldownMinutes: (minutes) =>
        set((s) => ({
          turboCooldownMinutes: Math.round(Math.min(60, Math.max(2, minutes))),
          log: pushLog(s.log, "Turbo cooldown updated"),
        })),

      setEngineCycle: (patch) =>
        set((s) => ({
          engineCycle: {
            enabled: patch.enabled ?? s.engineCycle.enabled,
            minutes: patch.minutes === undefined
              ? s.engineCycle.minutes
              : [5, 15, 30, 60].includes(patch.minutes)
                ? patch.minutes
                : s.engineCycle.minutes,
          },
          log: pushLog(s.log, "Background engine cycle updated"),
        })),

      updateWhaleSettings: (patch) =>
        set((s) => ({
          whaleSettings: {
            enabled: patch.enabled ?? s.whaleSettings.enabled,
            minMoves: patch.minMoves === undefined
              ? s.whaleSettings.minMoves
              : Math.round(Math.min(50, Math.max(5, patch.minMoves))),
            minWinRate: patch.minWinRate === undefined
              ? s.whaleSettings.minWinRate
              : Math.min(80, Math.max(50, patch.minWinRate)),
            minConfidence: patch.minConfidence === undefined
              ? s.whaleSettings.minConfidence
              : Math.round(Math.min(90, Math.max(50, patch.minConfidence))),
          },
          log: pushLog(s.log, "Whale-copy settings updated"),
        })),

      setReadinessTargets: (patch) =>
        set((s) => ({
          readinessTargets: {
            trades: patch.trades === undefined
              ? s.readinessTargets.trades
              : Math.round(Math.min(300, Math.max(50, patch.trades))),
            winRate: patch.winRate === undefined
              ? s.readinessTargets.winRate
              : Math.min(80, Math.max(50, patch.winRate)),
          },
          log: pushLog(s.log, "Paper-discipline targets updated"),
        })),

      // Equity guard
      stopTurbo: () => {
        const s = get();
        if (s.turboPhase !== "running") {
          return { ok: false, note: "No turbo run in progress." };
        }
        set({
          turboPhase: "off",
          turboStartedAt: null,
          turboEndsAt: null,
          turboCooldownUntil: null,
          turboPrevProfile: null,
          riskSettings: {
            ...s.riskSettings,
            sizingProfile: s.turboPrevProfile ?? "[paranoid]",
          },
          power: s.power,
          note: "Turbo stopped by kill switch — profile restored, bot remains armed.",
          log: pushLog(s.log, "Turbo STOPPED by kill switch"),
        });
        try {
          useMascot.getState().react("turbo-stop");
        } catch {
          // Mascot is UI-only
        }
        return { ok: true, note: "Turbo stopped." };
      },

      evaluateEquityGuard: (currentEquity: number) => {
        const s = get();
        const result = evaluateGuard(s.equityGuardState, currentEquity, s.equityGuardConfig);
        if (result.actions.length > 0) {
          set({ equityGuardState: result.newState });
          for (const action of result.actions) {
            if (action.type === "HALT") {
              get().manualHalt(
                action.reason,
                action.until ? Math.ceil((action.until - Date.now()) / 60000) : 60,
              );
            } else if (action.type === "COOLDOWN") {
              get().manualHalt(action.reason, action.minutes);
            } else if (action.type === "REDUCE_RISK") {
              // Risk multiplier already updated in state
            } else if (action.type === "PROFIT_TARGET_HIT") {
              // Logged automatically
            }
          }
        }
        return result;
      },

      recordTradePnl: (pnl: number) =>
        set((s) => {
          const newState = recordTradeOutcome(s.equityGuardState, pnl, s.equityGuardConfig);
          return { equityGuardState: newState };
        }),

      manualHalt: (reason: string, durationMinutes = 60) => {
        set((s) => ({
          equityGuardState: guardHalt(s.equityGuardState, reason, durationMinutes),
          log: pushLog(s.log, `Manual halt: ${reason} (${durationMinutes}min)`),
        }));
      },

      manualResume: () =>
        set((s) => ({
          equityGuardState: guardResume(s.equityGuardState),
          log: pushLog(s.log, "Manual resume"),
        })),

      // Dynamic sizing
      calculatePositionSize: (entryPrice: number, atrPct: number, conviction: number, side: "LONG" | "SHORT" = "LONG") => {
        const s = get();
        const activeBook = s.mode === "live" ? s.live : s.demo;
        const currentExposure = activeBook.positions.reduce((sum, p) => sum + p.notional, 0);
        const context: SizingContext = {
          equity: equity(activeBook),
          tier: s.tierConfig,
          atrPct,
          conviction,
          currentExposure,
          equityGuard: s.equityGuardState,
        };
        return calculateDynamicSize(context, entryPrice, side);
      },

      // Backfill qualifying trades
      backfillQualifyingTrades: async () => {
        const s = get();
        // This would call the migration logic
        // For now, log that it's a manual operation
        set((state) => ({
          log: pushLog(state.log, "🔄 Qualifying trades backfill - run migration 0008"),
        }));
      },

      purgeLearningHistory: () => {
        const stripTrades = (book: Book): Book => ({ ...book, trades: [] });
        set((s) => ({
          demo: stripTrades(s.demo),
          live: stripTrades(s.live),
          memory: emptyMemory(),
          dbEvents: [],
          dbGrossWin: 0,
          dbGrossLoss: 0,
          tradeLearningDbCount: 0,
          stopStreak: {},
          lastStopAt: {},
          lastCloseAt: {},
          note: "Learning history purged — readiness restarts at 0/200 TRAINING. Open positions and cash untouched.",
          log: pushLog(s.log, "Learning history purged by operator (tainted closes removed)"),
        }));
      },

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
        // Profit lock & tier
        profitLockState: s.profitLockState,
        profitLockConfig: s.profitLockConfig,
        currentTier: s.currentTier,
        // Equity guard
        equityGuardState: s.equityGuardState,
        equityGuardConfig: s.equityGuardConfig,
        // Bot interoperability + discipline targets
        entrySources: s.entrySources,
        engineCycle: s.engineCycle,
        whaleSettings: s.whaleSettings,
        readinessTargets: s.readinessTargets,
        turboRunMinutes: s.turboRunMinutes,
        turboCooldownMinutes: s.turboCooldownMinutes,
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
            useDesk.setState({ selectedModel: MODELS["[paranoid]"] });
          }
          if (state.modelHistory) {
            useDesk.setState({ modelHistory: state.modelHistory });
          }
          // Restore profit lock state
          if (state.profitLockState) {
            useDesk.setState({ profitLockState: state.profitLockState });
          }
          // Restore profit lock config
          if (state.profitLockConfig) {
            useDesk.setState({ profitLockConfig: state.profitLockConfig });
          }
          // Restore tier
          if (state.currentTier) {
            useDesk.setState({ 
              currentTier: state.currentTier,
              tierConfig: TIER_CONFIGS[state.currentTier],
            });
          }
          // Restore equity guard
          if (state.equityGuardState) {
            useDesk.setState({ equityGuardState: state.equityGuardState });
          }
          if (state.equityGuardConfig) {
            useDesk.setState({ equityGuardConfig: state.equityGuardConfig });
          }
          // Restore bot interoperability + discipline targets
          if (state.entrySources) {
            useDesk.setState({ entrySources: state.entrySources });
          }
          if (state.engineCycle) {
            useDesk.setState({ engineCycle: state.engineCycle });
          }
          if (state.whaleSettings) {
            useDesk.setState({ whaleSettings: state.whaleSettings });
          }
          if (state.readinessTargets) {
            useDesk.setState({ readinessTargets: state.readinessTargets });
          }
          if (typeof state.turboRunMinutes === "number") {
            useDesk.setState({ turboRunMinutes: state.turboRunMinutes });
          }
          if (typeof state.turboCooldownMinutes === "number") {
            useDesk.setState({ turboCooldownMinutes: state.turboCooldownMinutes });
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
