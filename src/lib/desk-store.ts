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

// FULL IMPLEMENTATION MUST BE RESTORED FROM COMMIT c1619f65662d1eb86c2c4bf3022bef54f0a80519
// See DESK_FINAL.ts in artifacts. This intermediate push is replaced immediately.

export const useDesk = create<DeskState>()(
  persist(
    (set, get) => ({
      power: false,
      mode: "demo",
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
      dbSource: "unknown",
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
      turboPhase: "off",
      turboStartedAt: null,
      turboEndsAt: null,
      turboCooldownUntil: null,
      turboPrevProfile: null,
      turboEntries: 0,
      turboReport: null,
      auditGiven: { 8: false, 13: false, 21: false },
      profitLockState: { locked: 0, peak: DEMO_START, lastAppliedAt: 0 },
      profitLockConfig: DEFAULT_PROFIT_LOCK_CONFIG,
      currentTier: "MICRO",
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
      restoreLearningState: () => undefined,
      setDbStatus: () => undefined,
      setDbHistory: () => undefined,
      refreshDbStats: () => undefined,
      setFxPrices: (prices) => set({ fxPrices: prices }),
      setPerpFunding: (rows) => set({ perpFunding: rows }),
      setEventHalts: (symbols) => set({ eventHalts: symbols }),
      setSecurity: (id, verdict) =>
        set((s) => ({ security: { ...s.security, [id]: { verdict, at: Date.now() } } })),
      whaleEnter: async () => ({ ok: false, note: "desk-store full restore pending" }),
      stopTurbo: () => ({ ok: true, note: "stopped" }),
      setPower: (on) => set({ power: on }),
      setMode: (mode) => set({ mode }),
      setTape: (rows, note) => set({ tape: rows, note }),
      tick: () => undefined,
      autoStep: () => undefined,
      manualEnter: () => ({ ok: false, note: "desk-store full restore pending" }),
      flatten: () => undefined,
      startTurbo: () => ({ ok: false, note: "desk-store full restore pending" }),
      bypassTurboCooldown: () => undefined,
      tickTurbo: () => undefined,
      flattenAll: () => undefined,
      halt: () => undefined,
      fund: () => ({ ok: false, note: "unavailable" }),
      resetDemo: () => set({ demo: emptyBook(DEMO_START) }),
      setDemoBalance: (amount) => set((s) => ({ demo: { ...s.demo, cash: amount } })),
      updateRiskSettings: (patch) => set((s) => ({ riskSettings: { ...s.riskSettings, ...patch } })),
      updateDisciplineRules: (patch) => set((s) => ({ disciplineRules: { ...s.disciplineRules, ...patch } })),
      getReadiness: () =>
        calculatePaperReadiness({
          trades: get().dbEvents.map((e) => ({ pnl: e.pnl, reason: e.reason, simulated: false })),
          targets: get().readinessTargets,
        }),
      applyProfitLock: () => undefined,
      getProfitLockStatus: (eq) => formatProfitLockStatus(get().profitLockState, get().profitLockConfig, eq),
      updateProfitLockConfig: (patch) => set((s) => ({ profitLockConfig: { ...s.profitLockConfig, ...patch } })),
      updateTier: () => undefined,
      getTierConfig: () => get().tierConfig,
      evaluateEquityGuard: (eq) => evaluateGuard(get().equityGuardState, get().equityGuardConfig, eq),
      recordTradePnl: () => undefined,
      manualHalt: (reason, mins) => set((s) => ({ equityGuardState: guardHalt(s.equityGuardState, reason, mins) })),
      manualResume: () => set((s) => ({ equityGuardState: guardResume(s.equityGuardState) })),
      calculatePositionSize: (entryPrice, atrPct, conviction, side) =>
        calculateDynamicSize({
          equity: equity(get().mode === "live" ? get().live : get().demo),
          entryPrice,
          atrPct,
          conviction,
          side: side ?? "LONG",
          settings: get().riskSettings,
        }),
      backfillQualifyingTrades: async () => undefined,
      purgeLearningHistory: () => set({ memory: emptyMemory(), dbEvents: [], dbGrossWin: 0, dbGrossLoss: 0 }),
      setEntrySource: (key, on) => set((s) => ({ entrySources: { ...s.entrySources, [key]: on } })),
      updateEquityGuardConfig: (patch) => set((s) => ({ equityGuardConfig: { ...s.equityGuardConfig, ...patch } })),
      setTurboRunMinutes: (m) => set({ turboRunMinutes: m }),
      setTurboCooldownMinutes: (m) => set({ turboCooldownMinutes: m }),
      setEngineCycle: (patch) => set((s) => ({ engineCycle: { ...s.engineCycle, ...patch } })),
      updateWhaleSettings: (patch) => set((s) => ({ whaleSettings: { ...s.whaleSettings, ...patch } })),
      setReadinessTargets: (patch) => set((s) => ({ readinessTargets: { ...s.readinessTargets, ...patch } })),
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
