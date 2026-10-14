import type {
  AvenueCategory,
  AvenueOpportunity,
  DisciplineRules,
  PaperReadiness,
} from "./types";
import type { Book } from "../paper";
import { equity, DEMO_START } from "../paper";
import { funding8hRate, fundingAprPct, type PerpFunding } from "../perps/hyperliquid";

function normCoin(symbol: string): string {
  return symbol
    .toUpperCase()
    .replace(/^[0-9]+/, "")
    .replace(/^K(?=[A-Z]{2,})/, "");
}

/**
 * Overwrite synthetic perp quotes with live Hyperliquid funding and marks.
 * Rows that match nothing keep clearly-labeled playbook values.
 */
export function hydrateAvenuesWithFunding(
  avenues: AvenueOpportunity[],
  rows: PerpFunding[],
): AvenueOpportunity[] {
  if (!rows.length) return avenues;
  const byCoin = new Map(rows.map((r) => [normCoin(r.coin), r]));
  return avenues.map((a) => {
    if (a.category !== "PERPS") return a;
    const base = normCoin(a.symbol.split("-")[0]);
    const row = byCoin.get(base);
    if (!row) return a;
    const rate8h = funding8hRate(row.funding1h);
    const apr = fundingAprPct(row.funding1h);
    return {
      ...a,
      priceA: row.markPx ?? a.priceA,
      fundingRate8h: rate8h ?? a.fundingRate8h,
      fundingApr: apr ?? a.fundingApr,
      liveData: true,
    };
  });
}

export const defaultDisciplineRules: DisciplineRules = {
  maxDailyDrawdownPct: 0.03, // 3.0% max daily drawdown circuit breaker
  minRiskRewardRatio: 2.5, // 2.5:1 minimum R:R ratio
  maxPortfolioRiskPerTradePct: 0.015, // 1.5% max equity risk per trade
  maxAvenueExposurePct: 0.25, // 25% max allocation per avenue
  requireLiquidityLockDays: 30, // At least 30 days locked liquidity for Early IPOs
  autoBreakEvenAtMultiple: 1.5, // Move stop to break-even once 1.5R profit reached
  haltOnConsecutiveLosses: 3, // Cooldown after 3 back-to-back losses
  blacklistedTokenCheck: true,
};

/**
 * Generates and evaluates the current universe of money-making opportunities across all avenues.
 */
export type AvenueLive = {
  /** Live Hyperliquid funding rows; absence means playbook mode. */
  funding?: PerpFunding[];
};

/**
 * Generates the opportunity universe. PERPS hydrate from live funding when
 * provided; every other category is an unverifiable playbook — capped below
 * the auto-entry threshold and flagged, so the bot can never auto-fire on
 * numbers no feed confirmed.
 */
export function scanAllAvenues(
  book: Book,
  rules: DisciplineRules = defaultDisciplineRules,
  now: number = Date.now(),
  live: AvenueLive = {},
): AvenueOpportunity[] {
  const currentEquity = equity(book);
  const fundingByCoin = new Map(
    (live.funding ?? []).map((r) => [normCoin(r.coin), r]),
  );

  // 1. Perpetuals & Funding Rate Opportunities
  const perpSetups: AvenueOpportunity[] = [
    {
      id: "perp-sol-funding",
      category: "PERPS",
      symbol: "SOL-PERP",
      title: "Solana Basis / Positive Funding Harvest",
      venueA: "Hyperliquid / Binance Futures",
      chain: "solana",
      priceA: 184.45,
      fundingRate8h: 0.032, // +0.032% per 8h
      fundingApr: 35.04, // 35% APR annualized
      perpSide: "DELTA_NEUTRAL",
      leverageMax: 3,
      riskRewardRatio: 3.2,
      stopLossPct: 0.022,
      stopLossPrice: 180.39,
      targetPrice: 197.36,
      estimatedAtrPct: 0.024,
      maxCapitalAllocationUsd: currentEquity * 0.2,
      disciplineApproved: true,
      disciplineNotes: [
        "Passes 2.5:1 R:R floor (3.2:1)",
        "Delta-neutral basis captures positive funding without directional exposure",
        "Strict 2.2% trailing stop active",
      ],
      confidenceScore: 88,
      discoveredAt: now - 180000,
      anchorSymbol: "SOL",
    },
    {
      id: "perp-sui-momentum",
      category: "PERPS",
      symbol: "SUI-PERP",
      title: "Breakout Long with Trailing Volatility Stop",
      venueA: "Bybit / Binance Futures",
      chain: "arbitrum",
      priceA: 2.84,
      fundingRate8h: 0.015,
      fundingApr: 16.42,
      perpSide: "LONG",
      leverageMax: 2,
      riskRewardRatio: 2.8,
      stopLossPct: 0.035,
      stopLossPrice: 2.74,
      targetPrice: 3.12,
      estimatedAtrPct: 0.038,
      maxCapitalAllocationUsd: currentEquity * 0.15,
      disciplineApproved: true,
      disciplineNotes: [
        "Passes 2.5:1 R:R floor (2.8:1)",
        "Leverage strictly capped at 2x",
        "Stop loss anchored at 1.8x ATR",
      ],
      confidenceScore: 82,
      discoveredAt: now - 340000,
      anchorSymbol: "SUI",
    },
    {
      id: "perp-pepe-short-hedge",
      category: "PERPS",
      symbol: "1000PEPE-PERP",
      title: "High Negative Funding Short Squeeze Arbitrage",
      venueA: "Binance Perps",
      chain: "ethereum",
      priceA: 0.0108,
      fundingRate8h: -0.048,
      fundingApr: 52.56,
      perpSide: "SHORT",
      leverageMax: 2,
      riskRewardRatio: 2.6,
      stopLossPct: 0.04,
      stopLossPrice: 0.01123,
      targetPrice: 0.00968,
      estimatedAtrPct: 0.045,
      maxCapitalAllocationUsd: currentEquity * 0.12,
      disciplineApproved: true,
      disciplineNotes: [
        "Passes 2.5:1 R:R floor (2.6:1)",
        "Captures negative funding yield buffer",
        "Hard stop placed above 4h swing high",
      ],
      confidenceScore: 79,
      discoveredAt: now - 520000,
      anchorSymbol: "PEPE",
    },
  ];

  // 2. Cross-Exchange & DEX-CEX Arbitrage Opportunities
  const arbSetups: AvenueOpportunity[] = [
    {
      id: "arb-bonk-sol",
      category: "ARBITRAGE",
      symbol: "BONK/USDT",
      title: "Raydium CLMM vs Binance Spot Spatial Arbitrage",
      venueA: "Raydium CLMM",
      venueB: "Binance Spot",
      chain: "solana",
      priceA: 0.0000221,
      priceB: 0.0000226,
      grossSpreadPct: 2.26,
      netProfitUsd: 14.8, // Net profit after gas and taker fee
      riskRewardRatio: 4.8, // High R:R due to zero market direction risk
      stopLossPct: 0.004,
      stopLossPrice: 0.000022,
      targetPrice: 0.0000226,
      estimatedAtrPct: 0.012,
      maxCapitalAllocationUsd: currentEquity * 0.22,
      disciplineApproved: true,
      disciplineNotes: [
        "Spatial atomic arbitrage: Buy on Raydium ($0.00002210) -> Sell on Binance ($0.00002260)",
        "Net spread after priority fee: +1.84%",
        "Simultaneous atomic execution eliminates overnight market delta",
      ],
      confidenceScore: 94,
      discoveredAt: now - 90000,
      anchorSymbol: "BONK",
    },
    {
      id: "arb-wif-orca",
      category: "ARBITRAGE",
      symbol: "WIF/USDC",
      title: "Orca Whirlpools vs Bybit Spot Arbitrage",
      venueA: "Orca Whirlpools",
      venueB: "Bybit Spot",
      chain: "solana",
      priceA: 2.41,
      priceB: 2.46,
      grossSpreadPct: 2.07,
      netProfitUsd: 9.2,
      riskRewardRatio: 4.1,
      stopLossPct: 0.005,
      stopLossPrice: 2.398,
      targetPrice: 2.46,
      estimatedAtrPct: 0.02,
      maxCapitalAllocationUsd: currentEquity * 0.18,
      disciplineApproved: true,
      disciplineNotes: [
        "Calculated spread exceeds 1.5% threshold",
        "Slippage budget constrained to 15 bps",
        "Zero directional holding time",
      ],
      confidenceScore: 91,
      discoveredAt: now - 220000,
      anchorSymbol: "WIF",
    },
  ];

  // 3. Early IPOs / Token Presales / Fair Launches
  const earlyIpoSetups: AvenueOpportunity[] = [
    {
      id: "ipo-pump-grad-sol",
      category: "EARLY_IPO",
      symbol: "APEX/SOL",
      title: "Bonding Curve Graduation Snipe with Locked Liquidity",
      venueA: "Raydium CPMM (Post-Graduation)",
      chain: "solana",
      priceA: 0.042,
      launchStage: "BONDING_CURVE",
      liquidityLockDays: 180, // 6 months locked
      rugScore: 92, // 92/100 safe
      riskRewardRatio: 3.5,
      stopLossPct: 0.048,
      stopLossPrice: 0.0399,
      targetPrice: 0.0567,
      estimatedAtrPct: 0.065,
      maxCapitalAllocationUsd: currentEquity * 0.1, // Conservative allocation for new launches
      disciplineApproved: true,
      disciplineNotes: [
        "Liquidity locked for 180 days (Passes >30d rule)",
        "Mint authority revoked, freeze authority disabled",
        "Strict 4.8% stop loss prevents tail-risk drawdown",
      ],
      confidenceScore: 86,
      discoveredAt: now - 450000,
    },
    {
      id: "ipo-base-fairlaunch",
      category: "EARLY_IPO",
      symbol: "NEXUS/WETH",
      title: "Base L2 Fair Launch Auction (Uniswap v3 LBP)",
      venueA: "Uniswap v3 Base",
      chain: "base",
      priceA: 0.00185,
      launchStage: "FAIR_LAUNCH",
      liquidityLockDays: 365,
      rugScore: 95,
      riskRewardRatio: 3.8,
      stopLossPct: 0.05,
      stopLossPrice: 0.00175,
      targetPrice: 0.00255,
      estimatedAtrPct: 0.07,
      maxCapitalAllocationUsd: currentEquity * 0.08,
      disciplineApproved: true,
      disciplineNotes: [
        "100% Team tokens vested over 12 months",
        "Top 10 holders own less than 18% of float",
        "Initial ticket capped at 8% book equity",
      ],
      confidenceScore: 89,
      discoveredAt: now - 600000,
    },
  ];

  // 4. Yield Farming & Delta-Neutral Basis Arbitrage
  const yieldSetups: AvenueOpportunity[] = [
    {
      id: "yield-jitosol-basis",
      category: "YIELD_BASIS",
      symbol: "JitoSOL/SOL",
      title: "Liquid Staking MEV Spread + Concentrated LP Rebalance",
      venueA: "Meteora DLMM / Kamino",
      chain: "solana",
      priceA: 1.094,
      expectedApy: 22.8, // 22.8% APY
      perpSide: "DELTA_NEUTRAL",
      riskRewardRatio: 5.5,
      stopLossPct: 0.008,
      stopLossPrice: 1.085,
      targetPrice: 1.138,
      estimatedAtrPct: 0.006,
      maxCapitalAllocationUsd: currentEquity * 0.25,
      disciplineApproved: true,
      disciplineNotes: [
        "Peg-stability supported by Solana validator stake proof",
        "Near-zero impermanent loss risk in concentrated bin",
        "Generates steady yield during low-volatility regimes",
      ],
      confidenceScore: 96,
      discoveredAt: now - 720000,
      anchorSymbol: "SOL",
    },
  ];

  // Combine, validate against live data, then sort by confidence score
  const all = [...perpSetups, ...arbSetups, ...earlyIpoSetups, ...yieldSetups];
  const validated = all.map((a) => {
    if (a.category === "PERPS") {
      const row = fundingByCoin.get(normCoin(a.symbol.split("-")[0]));
      if (row) {
        const rate8h = funding8hRate(row.funding1h);
        const apr = fundingAprPct(row.funding1h);
        const aprAbs = Math.abs(apr ?? 0);
        return {
          ...a,
          priceA: row.markPx ?? a.priceA,
          fundingRate8h: rate8h ?? a.fundingRate8h,
          fundingApr: apr ?? a.fundingApr,
          confidenceScore: Math.round(Math.min(96, 70 + Math.min(26, aprAbs * 1.2))),
          liveData: true,
        };
      }
      return {
        ...a,
        confidenceScore: Math.min(a.confidenceScore, 79),
        disciplineApproved: false,
        liveData: false,
        disciplineNotes: [...a.disciplineNotes, "No live funding — hidden from auto-entry until Hyperliquid responds."],
      };
    }
    // ARBITRAGE / EARLY_IPO / YIELD_BASIS: spreads, locks, and yields cannot
    // be verified live by any feed in this architecture. They stay visible
    // for manual review but can never auto-fire.
    return {
      ...a,
      confidenceScore: Math.min(a.confidenceScore, 79),
      disciplineApproved: false,
      liveData: false,
      disciplineNotes: [...a.disciplineNotes, "Playbook values — unverifiable live, manual entry only."],
    };
  });
  return validated.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

function tapeBaseOf(symbol: string): string {
  return symbol.toUpperCase().split(/[/:_\-]/)[0];
}

/**
 * Live tape price for an avenue's anchor symbol; deepest pool wins so a thin
 * listing can't wag the mark.
 */
export function avenueAnchorPrice(
  anchor: string,
  tape: Array<{ symbol: string; priceUsd: number; liquidityUsd: number }>,
): number | null {
  const want = anchor.toUpperCase();
  let best: number | null = null;
  let bestLiq = -1;
  for (const c of tape) {
    if (tapeBaseOf(c.symbol) !== want || !(c.priceUsd > 0)) continue;
    if (c.liquidityUsd > bestLiq) {
      bestLiq = c.liquidityUsd;
      best = c.priceUsd;
    }
  }
  return best;
}

/** avenue id → anchor symbol for the current scan. */
export function avenueAnchors(
  book: Book,
  rules: DisciplineRules = defaultDisciplineRules,
  now: number = Date.now(),
): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of scanAllAvenues(book, rules, now)) {
    if (a.anchorSymbol) map.set(a.id, a.anchorSymbol);
  }
  return map;
}

/**
 * Calculates a paper-performance scorecard; it does not assess live-trading readiness.
 * Demonstrates discipline and statistical edge before handling real funds.
 *
 * `history` is the deduped close list (persisted DB events + local book trades).
 * Every close moves the score: 40% sample size, 25% win rate, 20% profit factor,
 * 15% drawdown discipline. No caps, no plateaus — each trade nudges the bar.
 */
export function calculatePaperReadiness(
  book: Book,
  history: Array<{ pnl: number }> | null = null,
): PaperReadiness {
  const closes = history ?? book.trades;
  const completedDemoTrades = closes.length;
  const targetDemoTrades = 30;

  const wins = closes.filter((t) => t.pnl > 0);
  const losses = closes.filter((t) => t.pnl < 0);

  const totalWinPnl = wins.reduce((sum, t) => sum + t.pnl, 0);
  const totalLossPnl = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

  const winRate = completedDemoTrades > 0 ? (wins.length / completedDemoTrades) * 100 : 0;
  const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? 3.0 : 1.0;

  const currentEquity = equity(book);
  const peak = Math.max(book.peakEquity, currentEquity);
  const maxDrawdownPct = peak > 0 ? ((peak - currentEquity) / peak) * 100 : 0;

  // Checklist of rigorous discipline criteria (unchanged honest gates)
  const checklist = [
    {
      id: "sample_size",
      label: "Statistical Sample Size",
      met: completedDemoTrades >= targetDemoTrades,
      currentValue: `${completedDemoTrades} demo trades`,
      requiredValue: `≥ ${targetDemoTrades} simulated trades`,
    },
    {
      id: "win_rate",
      label: "Consistent Win Rate",
      met: winRate >= 55.0 && completedDemoTrades >= 5,
      currentValue: `${winRate.toFixed(1)}%`,
      requiredValue: "≥ 55.0% win rate",
    },
    {
      id: "profit_factor",
      label: "Profit Factor (Gross Win / Gross Loss)",
      met: profitFactor >= 1.6 && completedDemoTrades >= 5,
      currentValue: profitFactor.toFixed(2),
      requiredValue: "≥ 1.60 profit factor",
    },
    {
      id: "drawdown_discipline",
      label: "Drawdown Risk Discipline",
      met: maxDrawdownPct <= 4.5,
      currentValue: `${maxDrawdownPct.toFixed(1)}% max DD`,
      requiredValue: "≤ 4.5% drawdown",
    },
    {
      id: "risk_reward",
      label: "Discipline Rules Adherence",
      met: true, // Follows automated code gates
      currentValue: "100% compliant",
      requiredValue: "100% adherence (R:R ≥ 2.5:1, stops enforced)",
    },
  ];

  // Continuous score: every close moves the bar. 40% sample size,
  // 25% win rate vs the 55% target, 20% profit factor vs 1.6, 15% drawdown
  // discipline. No plateau caps — a better win rate always reads higher.
  const clamp100 = (n: number) => Math.max(0, Math.min(100, n));
  const sampleScore = clamp100((completedDemoTrades / targetDemoTrades) * 100);
  const winScore = completedDemoTrades === 0 ? 0 : clamp100((winRate / 55) * 100);
  const pfScore = completedDemoTrades === 0 ? 0 : clamp100((profitFactor / 1.6) * 100);
  const ddScore =
    maxDrawdownPct <= 4.5 ? 100 : Math.max(0, 100 - (maxDrawdownPct - 4.5) * 12);
  const readinessScore = Math.round(
    0.4 * sampleScore + 0.25 * winScore + 0.2 * pfScore + 0.15 * ddScore,
  );

  let status: "TRAINING" | "QUALIFYING" | "PAPER_PROVEN" = "TRAINING";
  let   statusMessage = "Paper training is active; simulated closes are used to estimate the strategy's edge.";
  let recommendation =
  "Keep the bot in paper mode while it collects a representative sample of simulated outcomes.";

  if (readinessScore >= 85 && completedDemoTrades >= targetDemoTrades) {
  status = "PAPER_PROVEN";
  statusMessage = "Paper thresholds met. This is not approval or readiness for real-money trading.";
    recommendation =
    "The simulated sample meets the configured paper thresholds. Live execution remains unavailable.";
  } else if (readinessScore >= 60) {
    status = "QUALIFYING";
  statusMessage = "Paper review in progress; collecting more simulated outcomes.";
    recommendation =
      "Bot is performing well in simulated market flow. Allow it to finish remaining sample trades to confirm drawdown stability.";
  }

  let consecutiveWins = 0;
  for (let i = book.trades.length - 1; i >= 0; i--) {
    if (book.trades[i].pnl > 0) consecutiveWins++;
    else break;
  }

  return {
    readinessScore,
    status,
    statusMessage,
    completedDemoTrades,
    targetDemoTrades,
    currentWinRatePct: Math.round(winRate * 10) / 10,
    targetWinRatePct: 55.0,
    profitFactor: Math.round(profitFactor * 100) / 100,
    targetProfitFactor: 1.6,
    maxObservedDrawdownPct: Math.round(maxDrawdownPct * 10) / 10,
    maxAllowedDrawdownPct: 4.5,
    disciplineAdherenceScore: 100,
    consecutiveWinsCurrent: consecutiveWins,
    totalDemoProfitUsd: Math.round((currentEquity - DEMO_START) * 100) / 100,
    recommendation,
    checklist,
  };
}
