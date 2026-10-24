import { create } from "zustand";

export type FeedHealth = {
  id: "binance" | "dex" | "gmgn" | "coingecko" | "coinmarketcap";
  label: string;
  state: "live" | "down" | "locked";
  detail: string;
};

type FeedState = {
  rows: FeedHealth[];
  setRows: (rows: FeedHealth[]) => void;
};

export const useFeedHealth = create<FeedState>((set) => ({
  rows: [],
  setRows: (rows) => set({ rows }),
}));
