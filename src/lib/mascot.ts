/**
 * Mascot Expression System
 * Realistic skull with morph targets for facial expressions
 * Triggers: arm-bot, disarm-bot, turbo-start, turbo-stop, login-success, login-fail, major-event
 */

import { create } from "zustand";

export type SkullMood = 
  | "idle" 
  | "alert" 
  | "focus" 
  | "bright" 
  | "suspicious" 
  | "confused" 
  | "nod" 
  | "look-left" 
  | "look-right" 
  | "look-down" 
  | "shake" 
  | "pulse"
  | "turbo";

export type ReactionType = 
  | "arm-bot" 
  | "disarm-bot" 
  | "turbo-start" 
  | "turbo-stop" 
  | "login-success" 
  | "login-fail" 
  | "major-event"
  | "whale-copy"
  | "profit-lock"
  | "tier-upgrade"
  | "halt-triggered";

type MascotState = {
  mood: SkullMood | null;
  sequence: number;
  /** Current morph targets (0-1) for expression blending */
  morphTargets: Record<string, number>;
  /** Queue of pending reactions */
  reactionQueue: ReactionType[];
  ping: (mood: SkullMood) => void;
  react: (type: ReactionType) => void;
  reset: () => void;
  setMorph: (target: string, value: number) => void;
  clearMorphs: () => void;
};

type MorphStep = { target: string; value: number; delay: number; duration: number };

const MORPH_MAP: Record<ReactionType, MorphStep[]> = {
  "arm-bot": [
    { target: "focus", value: 1, delay: 0, duration: 2000 },
    { target: "nod", value: 1, delay: 200, duration: 600 },
  ],
  "disarm-bot": [
    { target: "look-down", value: 1, delay: 0, duration: 1500 },
    { target: "neutral", value: 1, delay: 500, duration: 2000 },
  ],
  "turbo-start": [
    { target: "alert", value: 1, delay: 0, duration: 1500 },
    { target: "pulse", value: 1, delay: 100, duration: 400 },
    { target: "pulse", value: 1, delay: 600, duration: 400 },
  ],
  "turbo-stop": [
    { target: "suspicious", value: 1, delay: 0, duration: 2000 },
    { target: "look-left", value: 1, delay: 300, duration: 800 },
    { target: "look-right", value: 1, delay: 1200, duration: 800 },
  ],
  "login-success": [
    { target: "nod", value: 1, delay: 0, duration: 500 },
    { target: "pulse", value: 1, delay: 200, duration: 400 },
    { target: "pulse", value: 1, delay: 800, duration: 400 },
  ],
  "login-fail": [
    { target: "shake", value: 1, delay: 0, duration: 600 },
    { target: "look-down", value: 1, delay: 300, duration: 1500 },
    { target: "confused", value: 1, delay: 800, duration: 2000 },
  ],
  "major-event": [
    { target: "pulse", value: 1, delay: 0, duration: 400 },
    { target: "pulse", value: 1, delay: 500, duration: 400 },
  ],
  "whale-copy": [
    { target: "alert", value: 1, delay: 0, duration: 1000 },
    { target: "look-left", value: 0.5, delay: 200, duration: 600 },
    { target: "look-right", value: 0.5, delay: 800, duration: 600 },
  ],
  "profit-lock": [
    { target: "bright", value: 1, delay: 0, duration: 2000 },
    { target: "nod", value: 1, delay: 500, duration: 600 },
  ],
  "tier-upgrade": [
    { target: "bright", value: 1, delay: 0, duration: 2000 },
    { target: "pulse", value: 1, delay: 300, duration: 400 },
    { target: "pulse", value: 1, delay: 800, duration: 400 },
  ],
  "halt-triggered": [
    { target: "suspicious", value: 1, delay: 0, duration: 2000 },
    { target: "look-down", value: 1, delay: 500, duration: 2000 },
    { target: "shake", value: 0.5, delay: 1000, duration: 800 },
  ],
};

export const useMascot = create<MascotState>((set) => ({
  mood: null,
  sequence: 0,
  morphTargets: {},
  reactionQueue: [],
  
  ping: (mood) => set((state) => ({ 
    mood, 
    sequence: state.sequence + 1 
  })),
  
  react: (type: ReactionType) => {
    const morphs = MORPH_MAP[type] || [];

    // Clear existing morphs
    set({ morphTargets: {} });

    // Apply new morphs with staggered timing
    morphs.forEach(({ target, value, delay, duration }) => {
      setTimeout(() => {
        set((state) => ({ 
          morphTargets: { ...state.morphTargets, [target]: value } 
        }));
        
        // Auto-reset morph
        setTimeout(() => {
          set((state) => {
            const newMorphs = { ...state.morphTargets };
            delete newMorphs[target];
            return { morphTargets: newMorphs };
          });
        }, duration);
      }, delay);
    });
    
    // Add to queue for potential chaining
    set((state) => ({ 
      reactionQueue: [...state.reactionQueue.slice(-9), type] 
    }));
  },
  
  reset: () => set({ mood: null }),
  
  setMorph: (target: string, value: number) => 
    set((state) => ({ 
      morphTargets: { ...state.morphTargets, [target]: Math.max(0, Math.min(1, value)) } 
    })),
  
  clearMorphs: () => set({ morphTargets: {} }),
}));

