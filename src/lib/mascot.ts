import { create } from "zustand";

export type SkullMood = "alert" | "focus" | "bright";

type MascotState = {
  mood: SkullMood | null;
  sequence: number;
  ping: (mood: SkullMood) => void;
  reset: () => void;
};

export const useMascot = create<MascotState>((set) => ({
  mood: null,
  sequence: 0,
  ping: (mood) => set((state) => ({ mood, sequence: state.sequence + 1 })),
  reset: () => set({ mood: null }),
}));
