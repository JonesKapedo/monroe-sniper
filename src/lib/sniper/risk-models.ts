/** Risk-model profiles — four configurations that change the bot's edge, sizing, and exit behaviour. */
export type RiskModelProfile = {
  id: "[paranoid]" | "[elvis]" | "gradient" | "[degen]";
  name: string;
  description: string;
  minEdge: number; // Minimum gradient edge (clamped [-1,1]) to qualify
  minScore?: number; // Minimum score floor (optional per model)
  baseNotionalPct: number; // % of desk cash per entry (base, before conviction)
  maxNotionalPct: number; // Hard cap on notional (after conviction)
  convictionScale: number; // Multiplier base (0–1 range contribution)
  confidenceRamp: number; // seen / this = full confidence (e.g. 30 = full at 30 closes)
  trailPct?: number; // Trailing stop % (null = no trail, use takeProfitR only)
  takeProfitR: number; // R-multiple target
  exitAtRunBoundary: boolean; // true only for [degen] — close all at run end
  runMinutes?: number; // 34 for [degen]
  cooldownMinutes?: number; // 10 for [degen]
  auditMinutes?: number[]; // [8, 13, 21] for [degen] progress audits
};

/** All four risk-model profiles with renamed IDs and updated settings. */
export const MODELS: Record<RiskModelProfile["id"], RiskModelProfile> = {
  "[paranoid]": {
    id: "[paranoid]",
    name: "[Paranoid]",
    description:
      "Tightest Fibonacci (3%), 8% risk-engine halt, 1:3 min R:R, conservative conviction ramp",
    minEdge: 0.6,
    minScore: 75,
    baseNotionalPct: 1,
    maxNotionalPct: 2,
    convictionScale: 0.25,
    confidenceRamp: 30, // full conviction after 30 closes
    takeProfitR: 3,
    trailPct: 1,
    exitAtRunBoundary: false,
  },
  "[elvis]": {
    id: "[elvis]",
    name: "[Elvis]",
    description:
      "Wider Fibonacci (5%), 12% risk-engine halt, 1:1 min R:R, aggressive conviction ramp",
    minEdge: 0.3,
    minScore: 55,
    baseNotionalPct: 2,
    maxNotionalPct: 3,
    convictionScale: 0.25,
    confidenceRamp: 15, // full conviction after 15 closes
    takeProfitR: 1,
    trailPct: null,
  },
  gradient: {
    id: "gradient",
    name: "Gradient",
    description:
      "Gradient-brain edge + conviction sizing, 1:2 min R:R",
    minEdge: 0,
    minScore: 60,
    baseNotionalPct: 1,
    maxNotionalPct: 2,
    convictionScale: 0.25,
    confidenceRamp: 20, // full conviction after 20 closes (Phase B default)
    takeProfitR: 2,
    trailPct: 0.75,
  },
  "[degen]": {
    id: "[degen]",
    name: "[Degen]",
    description:
      "[Degen] turbo mode — 34-min run, audits at 8/13/21min, cooldown 10min, relentless hunting",
    minEdge: 0.1,
    minScore: 40,
    baseNotionalPct: 3,
    maxNotionalPct: 5,
    convictionScale: 0.25,
    confidenceRamp: 10, // full conviction after 10 closes — degen warms fast
    takeProfitR: 1,
    trailPct: null,
    exitAtRunBoundary: true,
    runMinutes: 34,
    cooldownMinutes: 10,
    auditMinutes: [8, 13, 21],
  },
};

/** Select a model profile by its ID. Returns the profile or undefined. */
export function selectModel(id: RiskModelProfile["id"]): RiskModelProfile | undefined {
  return MODELS[id];
}

/** Default model is [paranoid] — the bot's safe starting state. */
export const DEFAULT_MODEL_ID = "[paranoid]";

/** Read the currently selected model from localStorage; fall back to default. */
export function loadSelectedModel(): RiskModelProfile {
  if (typeof window === "undefined") return selectModel(DEFAULT_MODEL_ID)!;
  const stored = localStorage.getItem("selectedRiskModel");
  if (stored) {
    const parsed = JSON.parse(stored);
    const model = selectModel(parsed.id as RiskModelProfile["id"]);
    return model ?? selectModel(DEFAULT_MODEL_ID)!;
  }
  return selectModel(DEFAULT_MODEL_ID)!;
}

/** Persist the selected model to localStorage so it survives page visits. */
export function persistSelectedModel(model: RiskModelProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("selectedRiskModel", JSON.stringify({ id: model.id, name: model.name }));
}