import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createBook, flatSession, flattenAll, manualClose, resetLearning, step } from "./engine";
import { clip } from "./format";
import { SOURCE_ORDER, SOURCE_SPECS, emptySourceSettings } from "./mesh-types";
import type { MeshSourceId, MeshSourceSetting } from "./mesh-types";
import { defaultSettings, type Book, type OrderType, type Settings, type SourceId, type TimeInForce } from "./types";
import type { ThemeId } from "./types";
import { applyDeposit, applyWithdraw } from "./wallet";

type Patch = Partial<Omit<Settings, "sources">>;

type SniperStore = {
  book: Book;
  unlocked: boolean;
  runTicks: (n: number) => void;
  deposit: (amount: number) => void;
  withdraw: (amount: number) => void;
  updateSettings: (patch: Patch) => void;
  setSource: (id: SourceId, patch: Partial<Settings["sources"][SourceId]>) => void;
  closePosition: (id: string) => void;
  flatten: () => void;
  setPinHash: (hash: string | null) => void;
  unlock: () => void;
  lock: () => void;
  resetLearning: () => void;
  newSession: () => void;
  restoreOpeningBalance: () => void;
};

const memoryStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const ORDER_TYPES: OrderType[] = ["MARKET", "LIMIT", "STOP", "STOP_LIMIT", "BRACKET"];
const TIFS: TimeInForce[] = ["DAY", "GTC", "IOC", "FOK"];
const THEMES: ThemeId[] = ["MONROE", "PAPER", "MIDNIGHT"];

/** Clamp every knob a persisted book could have been saved with. */
export function sanitizeSettings(input: Settings): Settings {
  const n = (v: number, a: number, b: number) => clip(v, a, b);
  const source = (id: SourceId) => ({
    enabled: Boolean(input.sources[id]?.enabled),
    weight: n(input.sources[id]?.weight ?? 1, 0, 3),
  });
  const incoming = input.mesh ?? emptySourceSettings();
  const mesh = {} as Record<MeshSourceId, MeshSourceSetting>;
  for (const id of SOURCE_ORDER) {
    const row = incoming[id];
    const mode = row?.mode === "PINNED" ? "PINNED" : "AUTO";
    mesh[id] = {
      enabled: row ? Boolean(row.enabled) : SOURCE_SPECS[id] && Boolean(SOURCE_SPECS[id]),
      weight: n(row?.weight ?? SOURCE_SPECS[id].weight, 0, 3),
      mode,
      symbol: mode === "PINNED" && typeof row?.symbol === "string" ? row.symbol : null,
    };
  }
  const orders = input.orders ?? defaultSettings.orders;
  const v = input.v ?? defaultSettings.v;
  const appearance = input.appearance ?? defaultSettings.appearance;
  return {
    autoTrade: Boolean(input.autoTrade),
    riskPerTrade: n(input.riskPerTrade, 0.005, 0.05),
    maxPositions: Math.round(n(input.maxPositions, 1, 8)),
    minConfidence: n(input.minConfidence, 0.35, 0.9),
    stopPct: n(input.stopPct, 0.005, 0.05),
    rewardMultiple: n(input.rewardMultiple, 1, 4),
    useKelly: Boolean(input.useKelly),
    kellyCap: n(input.kellyCap, 0.02, 0.2),
    timeStop: Math.round(n(input.timeStop, 8, 120)),
    scanSeconds: Math.round(n(input.scanSeconds, 1, 20)),
    dailyWithdrawCap: Math.round(n(input.dailyWithdrawCap, 100, 100000)),
    appearance: {
      theme: THEMES.includes(appearance.theme) ? appearance.theme : defaultSettings.appearance.theme,
      showMascot:
        appearance.showMascot === undefined
          ? defaultSettings.appearance.showMascot
          : Boolean(appearance.showMascot),
    },
    sources: {
      INVO: source("INVO"),
      FINVIZ: source("FINVIZ"),
      SIMUL8OR: source("SIMUL8OR"),
    },
    mesh,
    v: {
      vetoNarrative: Boolean(v.vetoNarrative),
      vetoNews: Boolean(v.vetoNews),
      vetoThin: Boolean(v.vetoThin),
      halfAgainst: Boolean(v.halfAgainst),
    },
    orders: {
      type: ORDER_TYPES.includes(orders.type) ? orders.type : "MARKET",
      tif: TIFS.includes(orders.tif) ? orders.tif : "DAY",
      feeBps: n(orders.feeBps, 0, 12),
      halfSpreadBps: n(orders.halfSpreadBps, 0, 20),
      slipGuardBps: n(orders.slipGuardBps, 5, 120),
      limitExpire: Math.round(n(orders.limitExpire, 2, 60)),
      maxSlippagePct: n(orders.maxSlippagePct, 0.0005, 0.02),
    },
  };
}

export const useSniper = create<SniperStore>()(
  persist(
    (set) => ({
      book: createBook(),
      unlocked: false,
      runTicks: (n) =>
        set((state) => {
          let book = state.book;
          const count = Math.max(0, Math.min(240, Math.floor(n)));
          for (let i = 0; i < count; i++) book = step(book);
          return { book: { ...book, lastWall: Date.now() } };
        }),
      deposit: (amount) => set((state) => ({ book: applyDeposit(state.book, amount) })),
      withdraw: (amount) => set((state) => ({ book: applyWithdraw(state.book, amount) })),
      updateSettings: (patch) =>
        set((state) => ({
          book: { ...state.book, settings: sanitizeSettings({ ...state.book.settings, ...patch }) },
        })),
      setSource: (id, patch) =>
        set((state) => ({
          book: {
            ...state.book,
            settings: sanitizeSettings({
              ...state.book.settings,
              sources: {
                ...state.book.settings.sources,
                [id]: { ...state.book.settings.sources[id], ...patch },
              },
            }),
          },
        })),
      closePosition: (id) => set((state) => ({ book: manualClose(state.book, id) })),
      flatten: () => set((state) => ({ book: flattenAll(state.book) })),
      setPinHash: (hash) =>
        set((state) => ({
          book: { ...state.book, pinHash: hash },
          unlocked: hash ? state.unlocked : true,
        })),
      unlock: () => set({ unlocked: true }),
      lock: () => set({ unlocked: false }),
      resetLearning: () => set((state) => ({ book: resetLearning(state.book) })),
      newSession: () => set((state) => ({ book: flatSession(state.book) })),
      restoreOpeningBalance: () =>
        set((state) => {
          const fresh = createBook();
          return {
            book: {
              ...fresh,
              pinHash: state.book.pinHash,
              settings: state.book.settings,
              lastWall: Date.now(),
            },
            unlocked: true,
          };
        }),
    }),
    {
      name: "monroe-sniper-v1",
      skipHydration: true,
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { book?: Book } | undefined;
        // v1 shipped the greenish "MONROE" theme as the default. Pitch black
        // ("MIDNIGHT") is the house default now — migrate the stored default
        // once. A deliberate switch to PAPER is left untouched.
        if (state?.book?.settings?.appearance?.theme === "MONROE") {
          state.book.settings.appearance = {
            ...state.book.settings.appearance,
            theme: "MIDNIGHT",
          };
        }
        return state as never;
      },
      partialize: (state) => ({ book: state.book }),
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage : localStorage)),
    },
  ),
);
