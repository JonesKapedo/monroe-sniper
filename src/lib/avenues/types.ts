export type AvenueCategory =
  | "PERPS"
  | "ARBITRAGE"
  | "EARLY_IPO"
  | "YIELD_BASIS"
  | "SPOT_MOMENTUM";

export interface AvenueOpportunity {
  id: string;
  category: AvenueCategory;
  symbol: string;
  title: string;
  venueA: string;
  venueB?: string;
  chain: "solana" | "ethereum" | "bsc" | "arbitrum" | "base";
  priceA: number;
  priceB?: number;
  
  // Specific financial attributes
  grossSpreadPct?: number; // For arbitrage
  netProfitUsd?: number; // Estimated profit after gas/fees
  fundingRate8h?: number; // For perps (e.g. +0.025%)
  fundingApr?: number; // Annualized funding yield (e.g. 27.4%)
  perpSide?: "LONG" | "SHORT" | "DELTA_NEUTRAL";
  leverageMax?: number;
  launchStage?: "UPCOMING" | "FAIR_LAUNCH" | "BONDING_CURVE" | "LIVE_ID0";
  liquidityLockDays?: number;
  rugScore?: number; // 0 to 100 safety score
  expectedApy?: number; // For yield/basis
  
  // Disciplined risk parameters
  riskRewardRatio: number; // Must be >= 2.5:1
  stopLossPrice: number;
  targetPrice: number;
  stopLossPct: number;
  estimatedAtrPct: number;
  maxCapitalAllocationUsd: number;
  
  // Discipline gates
  disciplineApproved: boolean;
  disciplineNotes: string[];
  confidenceScore: number; // 0-100
  discoveredAt: number;
}

export interface DisciplineRules {
  maxDailyDrawdownPct: number; // e.g. 0.03 (3.0% max loss/day)
  minRiskRewardRatio: number; // e.g. 2.5:1 minimum required
  maxPortfolioRiskPerTradePct: number; // e.g. 0.015 (1.5% max capital risk)
  maxAvenueExposurePct: number; // e.g. 0.25 (25% max exposure per avenue)
  requireLiquidityLockDays: number; // e.g. min 30 days for early IPOs
  autoBreakEvenAtMultiple: number; // e.g. trail to B/E when profit reaches 1.5R
  haltOnConsecutiveLosses: number; // e.g. halt after 3 back-to-back losses
  blacklistedTokenCheck: boolean;
}

export interface PaperReadiness {
  readinessScore: number; // 0 to 100%
  status: "TRAINING" | "QUALIFYING" | "PAPER_PROVEN";
  statusMessage: string;
  completedDemoTrades: number;
  targetDemoTrades: number; // e.g. 30
  currentWinRatePct: number;
  targetWinRatePct: number; // e.g. 55%
  profitFactor: number;
  targetProfitFactor: number; // e.g. 1.6
  maxObservedDrawdownPct: number;
  maxAllowedDrawdownPct: number; // e.g. 4.5%
  disciplineAdherenceScore: number; // 100%
  consecutiveWinsCurrent: number;
  totalDemoProfitUsd: number;
  recommendation: string;
  checklist: Array<{
    id: string;
    label: string;
    met: boolean;
    currentValue: string;
    requiredValue: string;
  }>;
}
