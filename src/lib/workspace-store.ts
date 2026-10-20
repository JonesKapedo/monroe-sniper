import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop";
export type Tif = "GTC" | "IOC" | "FOK";

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
export const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440,
};

/** Notional presets (USD) for the order ticket — the last entry is "Max". */
export const SIZE_PRESETS = [25, 100, 250, 500] as const;
export const MAX_PRESET_INDEX = SIZE_PRESETS.length;

type WorkspaceState = {
  /** Selected symbol id (matches `Candidate.id`). */
  symbolId: string | null;
  timeframe: Timeframe;
  side: OrderSide;
  orderType: OrderType;
  /** Index into SIZE_PRESETS, or MAX_PRESET_INDEX for "Max". */
  sizePreset: number;
  limit: string;
  stop: string;
  target: string;
  tif: Tif;
  showDepth: boolean;
  showBlotter: boolean;
  setSymbol: (id: string | null) => void;
  setTimeframe: (tf: Timeframe) => void;
  setSide: (side: OrderSide) => void;
  setOrderType: (t: OrderType) => void;
  setSizePreset: (i: number) => void;
  setLimit: (v: string) => void;
  setStop: (v: string) => void;
  setTarget: (v: string) => void;
  setTif: (t: Tif) => void;
  toggleDepth: () => void;
  toggleBlotter: () => void;
  reset: () => void;
};

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set) => ({
      symbolId: null,
      timeframe: "15m",
      side: "buy",
      orderType: "market",
      sizePreset: 1,
      limit: "",
      stop: "",
      target: "",
      tif: "GTC",
      showDepth: true,
      showBlotter: true,
      setSymbol: (id) => set({ symbolId: id }),
      setTimeframe: (timeframe) => set({ timeframe }),
      setSide: (side) => set({ side }),
      setOrderType: (orderType) => set({ orderType }),
      setSizePreset: (sizePreset) => set({ sizePreset }),
      setLimit: (limit) => set({ limit }),
      setStop: (stop) => set({ stop }),
      setTarget: (target) => set({ target }),
      setTif: (tif) => set({ tif }),
      toggleDepth: () => set((s) => ({ showDepth: !s.showDepth })),
      toggleBlotter: () => set((s) => ({ showBlotter: !s.showBlotter })),
      reset: () => set({ limit: "", stop: "", target: "" }),
    }),
    {
      name: "monroe-workspace-v1",
      partialize: (s) => ({
        symbolId: s.symbolId,
        timeframe: s.timeframe,
        side: s.side,
        orderType: s.orderType,
        sizePreset: s.sizePreset,
        tif: s.tif,
        showDepth: s.showDepth,
        showBlotter: s.showBlotter,
      }),
    },
  ),
);
