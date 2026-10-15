/**
 * Whale Intelligence Engine
 * Registry, strategy classification, and pre-copy risk gate
 * Tracks ALL moves, analyzes patterns, gates copies through our risk model
 */

import type { Candidate } from "../paper";

export type WhaleStrategy = 
  | "accumulation"
  | "distribution"
  | "arb"
  | "yield"
  | "ipo-sniper"
  | "rotation"
  | "unknown";

export type WhaleMoveDirection = "IN" | "OUT" | "SWAP" | "STAKE" | "UNSTAKE" | "TRANSFER" | "UNKNOWN";

export interface WhaleMoveRaw {
  signature: string;
  wallet: string;
  mint: string;
  symbol: string;
  direction: WhaleMoveDirection;
  amount: number;
  usdEstimate: number;
  priceUsd: number;
  venue: string;
  chain: string;
  blockTime: number;
}

export interface WhaleMoveAnalyzed extends WhaleMoveRaw {
  // Analysis fields
  strategyInference: WhaleStrategy;
  confidence: number;              // 0-100
  riskModelScore: number;
  riskModelVerdict: "PASS" | "FAIL" | "PENDING";
  astronomyPhase: string;
  astronomyCorrelation: number;
  predictedOutcome: "HIGH_PROB_PROFIT" | "HIGH_PROB_LOSS" | "UNCERTAIN";
  actualOutcome: "PROFIT" | "LOSS" | "UNCERTAIN" | "PENDING";
  pnlIfCopied: number;
}

export interface WhaleProfile {
  wallet: string;
  label: string;
  chain: string;
  minUsd: number;
  followMode: "analyze" | "auto-copy" | "paused";
  createdAt: number;
  lastAnalyzed: number;
  totalMovesTracked: number;
  qualifyingMoves: number;
  strategyTag: WhaleStrategy;
  confidenceScore: number;         // 0-100
  winRate: number;                 // % of copied moves that would profit
  avgHoldMinutes: number;
  preferredVenues: string[];
  preferredChains: string[];
  astronomyCorrelation: number;
  
  // Detailed stats
  movesByStrategy: Record<WhaleStrategy, number>;
  movesByVenue: Record<string, number>;
  movesByDirection: Record<WhaleMoveDirection, number>;
  avgMoveSizeUsd: number;
  maxMoveSizeUsd: number;
  timePatterns: { hour: number; count: number }[];
}

export interface WhaleRegistryEntry {
  wallet: string;
  label: string;
  chain: string;
  minUsd: number;
  followMode: "analyze" | "auto-copy" | "paused";
  createdAt: number;
  lastAnalyzed: number;
  totalMovesTracked: number;
  qualifyingMoves: number;
  strategyTag: WhaleStrategy;
  confidenceScore: number;
  winRate: number;
  avgHoldMinutes: number;
  preferredVenues: string[];
  preferredChains: string[];
  astronomyCorrelation: number;
}

// Strategy classification rules
const STRATEGY_RULES: Array<{ strategy: WhaleStrategy; match: (move: WhaleMoveRaw, history: WhaleMoveRaw[]) => boolean }> = [
  {
    strategy: "accumulation",
    match: (move, history) => {
      if (move.direction !== "IN") return false;
      const recentIn = history.filter(m => m.direction === "IN" && m.wallet === move.wallet).slice(-10);
      return recentIn.length >= 5; // 5+ IN moves in last 10
    }
  },
  {
    strategy: "distribution",
    match: (move, history) => {
      if (move.direction !== "OUT") return false;
      const recentOut = history.filter(m => m.direction === "OUT" && m.wallet === move.wallet).slice(-10);
      return recentOut.length >= 5;
    }
  },
  {
    strategy: "arb",
    match: (move, history) => {
      // Look for rapid IN/OUT on same symbol across venues
      const recent = history.filter(m => m.symbol === move.symbol && m.wallet === move.wallet).slice(-20);
      const inMoves = recent.filter(m => m.direction === "IN").length;
      const outMoves = recent.filter(m => m.direction === "OUT").length;
      return inMoves >= 3 && outMoves >= 3 && Math.abs(inMoves - outMoves) <= 2;
    }
  },
  {
    strategy: "yield",
    match: (move, history) => {
      // STAKE/UNSTAKE or moves to known yield protocols
      return move.direction === "STAKE" || move.direction === "UNSTAKE" ||
        move.venue.toLowerCase().includes("yield") ||
        move.venue.toLowerCase().includes("stake");
    }
  },
  {
    strategy: "ipo-sniper",
    match: (move, history) => {
      // Small mints, new tokens, early entry
      return move.amount < 10000 && move.priceUsd < 0.01 && move.direction === "IN";
    }
  },
  {
    strategy: "rotation",
    match: (move, history) => {
      // Sequential IN on different symbols
      const recent = history.filter(m => m.direction === "IN" && m.wallet === move.wallet).slice(-5);
      const uniqueSymbols = new Set(recent.map(m => m.symbol));
      return uniqueSymbols.size >= 3 && recent.length >= 3;
    }
  },
];

/**
 * Classify a whale move into a strategy
 */
export function classifyWhaleStrategy(
  move: WhaleMoveRaw,
  history: WhaleMoveRaw[]
): WhaleStrategy {
  for (const rule of STRATEGY_RULES) {
    if (rule.match(move, history)) {
      return rule.strategy;
    }
  }
  return "unknown";
}

/**
 * Analyze whale wallet and build profile
 */
export function analyzeWhaleWallet(
  wallet: string,
  moves: WhaleMoveRaw[],
  minUsd: number = 25000
): WhaleProfile {
  const qualifyingMoves = moves.filter(m => m.usdEstimate >= minUsd && m.direction === "IN");
  
  // Strategy distribution
  const movesByStrategy: Record<string, number> = {};
  const movesByVenue: Record<string, number> = {};
  const movesByDirection: Record<string, number> = {};
  
  let totalConfidence = 0;
  let totalHoldTime = 0;
  let profitableMoves = 0;
  let totalMovesWithOutcome = 0;
  
  // Simulate copy outcomes for moves with known subsequent price action
  for (let i = 0; i < qualifyingMoves.length; i++) {
    const move = qualifyingMoves[i];
    const strategy = classifyWhaleStrategy(move, qualifyingMoves.slice(0, i));
    
    movesByStrategy[strategy] = (movesByStrategy[strategy] || 0) + 1;
    movesByVenue[move.venue] = (movesByVenue[move.venue] || 0) + 1;
    movesByDirection[move.direction] = (movesByDirection[move.direction] || 0) + 1;
    
    // Simulate outcome: look at price movement after move
    // In production, this would check actual subsequent price data
    const simulatedOutcome = simulateCopyOutcome(move, qualifyingMoves.slice(i + 1));
    if (simulatedOutcome > 0) profitableMoves++;
    totalMovesWithOutcome++;
    totalConfidence += 70; // Base confidence
  }
  
  // Time pattern analysis
  const timePatterns: { hour: number; count: number }[] = [];
  for (let h = 0; h < 24; h++) {
    const count = qualifyingMoves.filter(m => new Date(m.blockTime * 1000).getUTCHours() === h).length;
    if (count > 0) timePatterns.push({ hour: h, count });
  }
  
  const preferredVenues = Object.entries(movesByVenue)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([v]) => v);
    
  const preferredChains = [...new Set(qualifyingMoves.map(m => m.chain))];
  
  const strategyTag = Object.entries(movesByStrategy)
    .sort(([,a], [,b]) => b - a)[0]?.[0] as WhaleStrategy || "unknown";
  
  return {
    wallet,
    label: "",
    chain: qualifyingMoves[0]?.chain || "solana",
    minUsd,
    followMode: "analyze",
    createdAt: Date.now(),
    lastAnalyzed: Date.now(),
    totalMovesTracked: moves.length,
    qualifyingMoves: qualifyingMoves.length,
    strategyTag,
    confidenceScore: totalMovesWithOutcome > 0 ? Math.round(totalConfidence / totalMovesWithOutcome) : 0,
    winRate: totalMovesWithOutcome > 0 ? Math.round((profitableMoves / totalMovesWithOutcome) * 100) : 0,
    avgHoldMinutes: totalMovesWithOutcome > 0 ? Math.round(totalHoldTime / totalMovesWithOutcome) : 0,
    preferredVenues,
    preferredChains,
    astronomyCorrelation: 0,
    movesByStrategy: movesByStrategy as Record<WhaleStrategy, number>,
    movesByVenue,
    movesByDirection: movesByDirection as Record<WhaleMoveDirection, number>,
    avgMoveSizeUsd: qualifyingMoves.length > 0 
      ? Math.round(qualifyingMoves.reduce((s, m) => s + m.usdEstimate, 0) / qualifyingMoves.length)
      : 0,
    maxMoveSizeUsd: qualifyingMoves.length > 0 
      ? Math.max(...qualifyingMoves.map(m => m.usdEstimate))
      : 0,
    timePatterns,
  };
}

/**
 * Simulate copy outcome (placeholder - in production uses actual price data)
 */
function simulateCopyOutcome(move: WhaleMoveRaw, subsequentMoves: WhaleMoveRaw[]): number {
  // Find subsequent move on same symbol in opposite direction
  const exitMove = subsequentMoves.find(m => 
    m.symbol === move.symbol && 
    m.direction === (move.direction === "IN" ? "OUT" : "IN")
  );
  
  if (!exitMove) return 0; // No exit found
  
  // Simple P&L simulation
  if (move.direction === "IN") {
    return (exitMove.priceUsd - move.priceUsd) / move.priceUsd * 100;
  } else {
    return (move.priceUsd - exitMove.priceUsd) / move.priceUsd * 100;
  }
}

/**
 * Pre-copy risk gate
 * Evaluates whale move through OUR risk model before allowing copy
 */
export interface PreCopyCheckResult {
  allowed: boolean;
  reason: string;
  whaleProfile: WhaleProfile;
  riskModelVerdict: "PASS" | "FAIL" | "PENDING";
  riskScore: number;
  suggestedNotional: number;
  stopPrice: number;
  targetPrice: number;
  correlation: number;
}

export async function evaluateWhaleMoveForCopy(
  move: WhaleMoveRaw,
  whaleProfile: WhaleProfile,
  riskEngine: (candidate: any) => { allowed: boolean; notional: number; stopPrice: number; targetPrice: number; score: number },
  currentEquity: number,
  currentPositions: number,
  maxPositions: number
): Promise<PreCopyCheckResult> {
  // 1. Whale qualification checks
  if (whaleProfile.confidenceScore < 70) {
    return {
      allowed: false,
      reason: `Whale confidence ${whaleProfile.confidenceScore} < 70`,
      whaleProfile,
      riskModelVerdict: "FAIL",
      riskScore: 0,
      suggestedNotional: 0,
      stopPrice: 0,
      targetPrice: 0,
      correlation: 0,
    };
  }
  
  if (whaleProfile.winRate < 65) {
    return {
      allowed: false,
      reason: `Whale win rate ${whaleProfile.winRate}% < 65%`,
      whaleProfile,
      riskModelVerdict: "FAIL",
      riskScore: 0,
      suggestedNotional: 0,
      stopPrice: 0,
      targetPrice: 0,
      correlation: 0,
    };
  }
  
  if (whaleProfile.qualifyingMoves < 20) {
    return {
      allowed: false,
      reason: `Whale qualifying moves ${whaleProfile.qualifyingMoves} < 20`,
      whaleProfile,
      riskModelVerdict: "FAIL",
      riskScore: 0,
      suggestedNotional: 0,
      stopPrice: 0,
      targetPrice: 0,
      correlation: 0,
    };
  }
  
  // 2. Position limits
  if (currentPositions >= maxPositions) {
    return {
      allowed: false,
      reason: `Max positions (${maxPositions}) reached`,
      whaleProfile,
      riskModelVerdict: "FAIL",
      riskScore: 0,
      suggestedNotional: 0,
      stopPrice: 0,
      targetPrice: 0,
      correlation: 0,
    };
  }
  
  // 3. Create candidate for risk engine
  const candidate = {
    id: move.mint,
    symbol: move.symbol,
    name: move.symbol,
    address: move.mint,
    chain: move.chain,
    venue: move.venue.toLowerCase().includes("binance") ? "binance" : "dex",
    priceUsd: move.priceUsd,
    change24h: 0,
    volume24h: move.usdEstimate * 10, // Estimate
    liquidityUsd: 500000, // Default
    score: 75, // Base score for whale moves
    pairAgeHours: 24,
    url: null,
    flags: [],
    rationale: [`🐋 Whale copy: ${whaleProfile.label} (${whaleProfile.strategyTag})`],
  };
  
  // 4. Run through risk engine
  const riskResult = riskEngine(candidate);
  
  if (!riskResult.allowed || riskResult.notional <= 0) {
    return {
      allowed: false,
      reason: `Risk model rejected: ${riskResult.score}`,
      whaleProfile,
      riskModelVerdict: "FAIL",
      riskScore: riskResult.score,
      suggestedNotional: 0,
      stopPrice: 0,
      targetPrice: 0,
      correlation: 0,
    };
  }
  
  // 5. Astronomy correlation (placeholder)
  const correlation = whaleProfile.astronomyCorrelation || 0;
  
  return {
    allowed: true,
    reason: "Whale qualified, risk model passed",
    whaleProfile,
    riskModelVerdict: "PASS",
    riskScore: riskResult.score,
    suggestedNotional: riskResult.notional,
    stopPrice: riskResult.stopPrice,
    targetPrice: riskResult.targetPrice,
    correlation,
  };
}

/**
 * Get whale registry stats for UI
 */
export function getWhaleRegistryStats(whales: WhaleRegistryEntry[]): {
  total: number;
  analyzing: number;
  autoCopy: number;
  paused: number;
  avgWinRate: number;
  totalQualifyingMoves: number;
} {
  return {
    total: whales.length,
    analyzing: whales.filter(w => w.followMode === "analyze").length,
    autoCopy: whales.filter(w => w.followMode === "auto-copy").length,
    paused: whales.filter(w => w.followMode === "paused").length,
    avgWinRate: whales.length > 0 
      ? Math.round(whales.reduce((s, w) => s + w.winRate, 0) / whales.length)
      : 0,
    totalQualifyingMoves: whales.reduce((s, w) => s + w.qualifyingMoves, 0),
  };
}

