/** Risk-model profiles — four configurations that change the bot's edge, sizing, and exit behaviour.
 * Ordered from most conservative to most aggressive:
 *   Conservative ([paranoid]) → Sweet Spot (gradient) → Aggressive Growth ([elvis]) → Turbo Gambler ([degen])
 */
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
  trailPct?: number | null; // Trailing stop % (null = no trail, use takeProfitR only)
  takeProfitR: number; // R-multiple target
  exitAtRunBoundary?: boolean; // true only for [degen] — close all at run end
  runMinutes?: number; // 34 for [degen]
  cooldownMinutes?: number; // 10 for [degen]
  auditMinutes?: number[]; // [8, 13, 21] for [degen] progress audits
};

/** All four risk-model profiles. Thresholds tuned so Sweet Spot actually produces trades
 * while still respecting the hard stake-budget and portfolio-risk gates. */
export const MODELS: Record<RiskModelProfile["id"], RiskModelProfile> = {
  "[paranoid]": {
    id: "[paranoid]",
    name: "Conservative",
    description:
      "Tightest risk: high score floor, strong edge required, 1:3 R:R, slow conviction ramp. Capital preservation first.",
    minEdge: 0.45,
    minScore: 70,
    baseNotionalPct: 1,
    maxNotionalPct: 2,
    convictionScale: 0.25,
    confidenceRamp: 30,
    takeProfitR: 3,
    trailPct: 1,
    exitAtRunBoundary: false,
  },
  gradient: {
    id: "gradient",
    name: "Sweet Spot",
    description:
      "Balanced daily driver: moderate score floor, edge-aware conviction sizing, 1:2 R:R. Designed to generate real learning volume without reckless exposure.",
    minEdge: -0.05,
    minScore: 55,
    baseNotionalPct: 1.5,
    maxNotionalPct: 3,
    convictionScale: 0.3,
    confidenceRamp: 15,
    takeProfitR: 2,
    trailPct: 0.75,
  },
  "[elvis]": {
    id: "[elvis]",
    name: "Aggressive Growth",
    description:
      "Higher throughput: lower score floor, faster conviction, 1:1.5 R:R. Accepts more noise in exchange for more closed outcomes.",
    minEdge: 0.1,
    minScore: 48,
    baseNotionalPct: 2,
    maxNotionalPct: 4,
    convictionScale: 0.3,
    confidenceRamp: 12,
    takeProfitR: 1.5,
    trailPct: null,
  },
  "[degen]": {
    id: "[degen]",
    name: "Turbo Gambler",
    description:
      "Timed turbo runs (34 min), aggressive hunting, audits at 8/13/21 min, short cooldown. Highest throughput, highest variance.",
    minEdge: 0,
    minScore: 38,
    baseNotionalPct: 3,
    maxNotionalPct: 5,
    convictionScale: 0.3,
    confidenceRamp: 8,
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

/** Default model is Sweet Spot (gradient) — balanced enough to produce real trades and learning. */
export const DEFAULT_MODEL_ID = "gradient";
