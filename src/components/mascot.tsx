import { create } from "zustand";

type MascotState = {
  ping: (mood: string) => void;
};

/** No-op mascot bus. Wallet actions ping this; the visual is optional. */
export const useMascot = create<MascotState>(() => ({
  ping: () => {},
}));
