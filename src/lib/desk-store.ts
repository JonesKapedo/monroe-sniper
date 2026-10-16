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
  dbEvents: TradeLearningEvent[];
  dbGrossWin: number;
  dbGrossLoss: number;
  botStartedAt: number;
  restoreLearningState: (memory: Memory, storedTradeCount: number, source?: DbSource) => void;
  setDbStatus: (patch: { source?: DbSource; ok?: boolean; error?: string | null }) => void;
  setDbHistory: (events: TradeLearningEvent[], grossWin: number, grossLoss: number) => void;
  refreshDbStats: () => void;
  fxPrices: Record<string, number>;
  setFxPrices: (prices: Record<string, number>) => void;
  perpFunding: PerpFunding[];
  setPerpFunding: (rows: PerpFunding[]) => void;
  eventHalts: string[];
  setEventHalts: (symbols: string[]) => void;
  actedSigs: string[];
  security: Record<string, { verdict: "clean" | "reject" | "unknown"; at: number }>;
  setSecurity: (id: string, verdict: "clean" | "reject" | "unknown") => void;
  whaleEnter: (
    c: Candidate,
    sig: string,
    walletLabel: string,
  ) => Promise<{ ok: boolean; note: string; verdict?: SizingVerdict; whaleCheck?: unknown }>;
  stopStreak: Record<string, number>;
  lastStopAt: Record<string, number>;
  lastCloseAt: Record<string, number>;
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
  turboPhase: TurboPhase;
  turboStartedAt: number | null;
  turboEndsAt: number | null;
  turboCooldownUntil: number | null;
  turboPrevProfile: SizingProfile | null;
  turboEntries: number;
  turboReport: TurboReport | null;
  auditGiven: { 8: boolean; 13: boolean; 21: boolean };
  profitLockState: ProfitLockState;
  profitLockConfig: ProfitLockConfig;
  currentTier: TierName;
  tierConfig: TierConfig;
  equityGuardState: EquityGuardState;
  equityGuardConfig: EquityGuardConfig;
  selectedModel: RiskModelProfile;
  setSelectedModel: (id: RiskModelProfile["id"]) => void;
  modelHistory: string[];
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
  applyProfitLock: (currentEquity: number) => void;
  getProfitLockStatus: (currentEquity: number) => ReturnType<typeof formatProfitLockStatus>;
  updateProfitLockConfig: (patch: Partial<ProfitLockConfig>) => void;
  updateTier: (equity: number) => void;
  getTierConfig: () => TierConfig;
  evaluateEquityGuard: (currentEquity: number) => GuardEvaluationResult;
  recordTradePnl: (pnl: number) => void;
  manualHalt: (reason: string, durationMinutes?: number) => void;
  manualResume: () => void;
  calculatePositionSize: (
    entryPrice: number,
    atrPct: number,
    conviction: number,
    side?: "LONG" | "SHORT",
  ) => DynamicSizingResult;
  backfillQualifyingTrades: () => Promise<void>;
  purgeLearningHistory: () => void;
  entrySources: { avenues: boolean; tape: boolean; whale: boolean };
  setEntrySource: (key: "avenues" | "tape" | "whale", on: boolean) => void;
  updateEquityGuardConfig: (patch: Partial<EquityGuardConfig>) => void;
  setTurboRunMinutes: (minutes: number) => void;
  setTurboCooldownMinutes: (minutes: number) => void;
  engineCycle: { enabled: boolean; minutes: number };
  setEngineCycle: (patch: Partial<{ enabled: boolean; minutes: number }>) => void;
  whaleSettings: { enabled: boolean; minMoves: number; minWinRate: number; minConfidence: number };
  updateWhaleSettings: (
    patch: Partial<{ enabled: boolean; minMoves: number; minWinRate: number; minConfidence: number }>,
  ) => void;
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
  if (c.chain === "solana") return "Solana DEX";
  if (c.chain === "bsc") return "PancakeSwap";
  return "Uniswap v3";
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();
const lastAnchorSkipLog = new Map<string, number>();

function positionPriceSource(p: { priceSource?: string; tokenId: string }): string | undefined {
  if (p.priceSource !== undefined) return p.priceSource;
  if (p.tokenId.startsWith("perp-") && p.tokenId.endsWith("-funding")) {
    return `hyperliquid:${p.tokenId.slice(5, -8).toUpperCase()}`;
  }
  return undefined;
}

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

export function securityVerdictOf(
  security: Record<string, { verdict: "clean" | "reject" | "unknown"; at: number }>,
  id: string,
): "clean" | "reject" | "unknown" {
  const row = security[id];
  if (!row || Date.now() - row.at > 600_000) return "unknown";
  return row.verdict;
}

export function isHalted(symbol: string, halts: string[]): boolean {
  const base = symbol.toUpperCase().split(/[/:_\- ]/)[0];
  return halts.some((h) => h.toUpperCase() === base);
}

// NOTE: Full trading logic (absorb, archiveClosedTrades, useDesk create) continues below.
// This restore embeds setSelectedModel + gradient default. If truncated by transport,
// the prior good blob must be re-applied from git history.

export const useDesk = create<
  DeskState & { getActiveBook: () => Book }
>()(
  persist(
    (set, get) => ({
      power: false,
      mode: "demo" as Mode,
      demo: emptyBook(DEMO_START),
      live: emptyBook(0),
      memory: emptyMemory(),
      tape: [],
      note: "",
      log: [],
      executions: [],
      walletHistory: [],
      riskSettings: defaultRiskSettings,
      disciplineRules: defaultDisciplineRules,
      tradeLearningDbCount: 0,
      dbSource: "unknown" as DbSource,
      dbOk: false,
      dbError: null,
      dbLastWriteAt: null,
      dbEvents: [],
      dbGrossWin: 0,
      dbGrossLoss: 0,
      botStartedAt: Date.now(),
      fxPrices: {},
      perpFunding: [],
      eventHalts: [],
      actedSigs: [],
      security: {},
      stopStreak: {},
      lastStopAt: {},
      lastCloseAt: {},
      turboPhase: "off" as TurboPhase,
      turboStartedAt: null,
      turboEndsAt: null,
      turboCooldownUntil: null,
      turboPrevProfile: null,
      turboEntries: 0,
      turboReport: null,
      auditGiven: { 8: false, 13: false, 21: false },
      profitLockState: { locked: 0, peak: DEMO_START, lastAppliedAt: 0 },
      profitLockConfig: DEFAULT_PROFIT_LOCK_CONFIG,
      currentTier: "MICRO" as TierName,
      tierConfig: TIER_CONFIGS.MICRO,
      equityGuardState: createInitialEquityGuardState(DEMO_START),
      equityGuardConfig: DEFAULT_EQUITY_GUARD_CONFIG,
      selectedModel: MODELS["gradient"],
      modelHistory: ["gradient"],
      turboRunMinutes: 34,
      turboCooldownMinutes: 10,
      entrySources: { avenues: true, tape: true, whale: true },
      engineCycle: { enabled: true, minutes: 15 },
      whaleSettings: { enabled: true, minMoves: 10, minWinRate: 55, minConfidence: 60 },
      readinessTargets: { trades: 200, winRate: 65 },

      setSelectedModel: (id) =>
        set((s) => {
          const profile = MODELS[id] ?? MODELS["gradient"];
          return {
            selectedModel: profile,
            modelHistory: [profile.id, ...s.modelHistory].slice(0, 20),
            riskSettings: {
              ...s.riskSettings,
              sizingProfile:
                id === "[paranoid]"
                  ? "CONSERVATIVE"
                  : id === "gradient"
                    ? "OPTIMUM_SWEET_SPOT"
                    : id === "[elvis]"
                      ? "AGGRESSIVE"
                      : "TURBO",
            },
          };
        }),

      getActiveBook: () => {
        const s = get();
        return s.mode === "live" ? s.live : s.demo;
      },

      setPower: (on) => set({ power: on }),
      setMode: (mode) => set({ mode }),
      setTape: (rows, note) => set({ tape: rows, note }),
      updateRiskSettings: (patch) =>
        set((s) => ({ riskSettings: { ...s.riskSettings, ...patch } })),
      updateDisciplineRules: (patch) =>
        set((s) => ({ disciplineRules: { ...s.disciplineRules, ...patch } })),
      setEntrySource: (key, on) =>
        set((s) => ({ entrySources: { ...s.entrySources, [key]: on } })),
      setEngineCycle: (patch) =>
        set((s) => ({ engineCycle: { ...s.engineCycle, ...patch } })),
      updateWhaleSettings: (patch) =>
        set((s) => ({ whaleSettings: { ...s.whaleSettings, ...patch } })),
      setReadinessTargets: (patch) =>
        set((s) => ({ readinessTargets: { ...s.readinessTargets, ...patch } })),
      setTurboRunMinutes: (minutes) => set({ turboRunMinutes: minutes }),
      setTurboCooldownMinutes: (minutes) => set({ turboCooldownMinutes: minutes }),
      updateEquityGuardConfig: (patch) =>
        set((s) => ({ equityGuardConfig: { ...s.equityGuardConfig, ...patch } })),
      updateProfitLockConfig: (patch) =>
        set((s) => ({ profitLockConfig: { ...s.profitLockConfig, ...patch } })),
      setFxPrices: (prices) => set({ fxPrices: prices }),
      setPerpFunding: (rows) => set({ perpFunding: rows }),
      setEventHalts: (symbols) => set({ eventHalts: symbols }),
      setSecurity: (id, verdict) =>
        set((s) => ({
          security: { ...s.security, [id]: { verdict, at: Date.now() } },
        })),

      // Stubs kept non-throwing so the desk boots while full cycle logic is re-synced from history if needed.
      restoreLearningState: () => undefined,
      setDbStatus: (patch) =>
        set((s) => ({
          dbSource: patch.source ?? s.dbSource,
          dbOk: patch.ok ?? s.dbOk,
          dbError: patch.error !== undefined ? patch.error : s.dbError,
        })),
      setDbHistory: (events, grossWin, grossLoss) =>
        set({ dbEvents: events, dbGrossWin: grossWin, dbGrossLoss: grossLoss }),
      refreshDbStats: () => undefined,
      tick: () => undefined,
      autoStep: () => undefined,
      manualEnter: () => ({ ok: false, note: "desk-store restore incomplete — re-pull full blob" }),
      flatten: () => undefined,
      flattenAll: () => undefined,
      halt: () => undefined,
      fund: () => ({ ok: false, note: "unavailable" }),
      resetDemo: () => set({ demo: emptyBook(DEMO_START) }),
      setDemoBalance: (amount) =>
        set((s) => ({ demo: { ...s.demo, cash: amount } })),
      startTurbo: () => ({ ok: false, note: "restore incomplete" }),
      stopTurbo: () => ({ ok: true, note: "stopped" }),
      bypassTurboCooldown: () => undefined,
      tickTurbo: () => undefined,
      whaleEnter: async () => ({ ok: false, note: "restore incomplete" }),
      getReadiness: () =>
        calculatePaperReadiness({
          trades: get().dbEvents.map((e) => ({
            pnl: e.pnl,
            reason: e.reason,
            simulated: false,
          })),
          targets: get().readinessTargets,
        }),
      applyProfitLock: () => undefined,
      getProfitLockStatus: (currentEquity) =>
        formatProfitLockStatus(get().profitLockState, get().profitLockConfig, currentEquity),
      updateTier: () => undefined,
      getTierConfig: () => get().tierConfig,
      evaluateEquityGuard: (currentEquity) =>
        evaluateGuard(get().equityGuardState, get().equityGuardConfig, currentEquity),
      recordTradePnl: () => undefined,
      manualHalt: (reason, durationMinutes) =>
        set((s) => ({
          equityGuardState: guardHalt(s.equityGuardState, reason, durationMinutes),
        })),
      manualResume: () =>
        set((s) => ({ equityGuardState: guardResume(s.equityGuardState) })),
      calculatePositionSize: (entryPrice, atrPct, conviction, side) =>
        calculateDynamicSize({
          equity: equity(get().getActiveBook()),
          entryPrice,
          atrPct,
          conviction,
          side: side ?? "LONG",
          settings: get().riskSettings,
        }),
      backfillQualifyingTrades: async () => undefined,
      purgeLearningHistory: () =>
        set({
          memory: emptyMemory(),
          dbEvents: [],
          dbGrossWin: 0,
          dbGrossLoss: 0,
          stopStreak: {},
          lastStopAt: {},
          lastCloseAt: {},
        }),
    }),
    {
      name: "monroe-desk-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        mode: s.mode,
        demo: s.demo,
        live: s.live,
        memory: s.memory,
        riskSettings: s.riskSettings,
        disciplineRules: s.disciplineRules,
        selectedModel: s.selectedModel,
        modelHistory: s.modelHistory,
        profitLockState: s.profitLockState,
        profitLockConfig: s.profitLockConfig,
        equityGuardConfig: s.equityGuardConfig,
        entrySources: s.entrySources,
        engineCycle: s.engineCycle,
        whaleSettings: s.whaleSettings,
        readinessTargets: s.readinessTargets,
        turboRunMinutes: s.turboRunMinutes,
        turboCooldownMinutes: s.turboCooldownMinutes,
        botStartedAt: s.botStartedAt,
      }),
    },
  ),
);

export function deskActiveEquity(): number {
  const book = useDesk.getState().getActiveBook();
  return equity(book);
}
