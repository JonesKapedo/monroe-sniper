import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type Book,
  type Candidate,
  closeOne,
  emptyBook,
  enter,
  markBook,
  setKill,
} from "./paper";

type DeskState = {
  book: Book;
  tape: Candidate[];
  note: string;
  hydrated: boolean;
  enterName: (c: Candidate) => void;
  flatten: (id: string) => void;
  halt: (on: boolean) => void;
  applyMarks: (prices: Record<string, number>) => void;
  setTape: (rows: Candidate[], note: string) => void;
  reset: () => void;
  markHydrated: () => void;
};

export const useDesk = create<DeskState>()(
  persist(
    (set) => ({
      book: emptyBook(),
      tape: [],
      note: "Scan the public tape, or load the sample book.",
      hydrated: false,
      enterName: (c) =>
        set((s) => {
          const r = enter(s.book, c);
          return { book: r.book, note: r.note };
        }),
      flatten: (id) => set((s) => ({ book: closeOne(s.book, id), note: "Closed on the paper book" })),
      halt: (on) => set((s) => ({ book: setKill(s.book, on), note: on ? "Kill switch on" : "Kill switch cleared" })),
      applyMarks: (prices) => set((s) => ({ book: markBook(s.book, prices) })),
      setTape: (rows, note) => set({ tape: rows, note }),
      reset: () => set({ book: emptyBook(), note: "Paper book reset to $25,000" }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "monroe-paper-v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
          : localStorage,
      ),
      partialize: (s) => ({ book: s.book }),
      skipHydration: true,
    },
  ),
);
