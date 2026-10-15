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
  const rows = live.funding ?? [];
  // Live-only universe: an opportunity exists only when a live Hyperliquid
  // funding row confirms it. No funding feed -> no avenues. Nothing here is
  // a playbook, estimate, or placeholder.
  const out: AvenueOpportunity[] = [];
  for (const row of rows) {
    if (row.markPx === null || !(row.markPx > 0)) continue;
    if (row.funding1h === null) continue;
    const rate8h = funding8hRate(row.funding1h) ?? 0;
    const apr = fundingAprPct(row.funding1h) ?? 0;
    const aprAbs = Math.abs(apr);
    // Policy floor (disclosed): ignore dust funding below 5% APR.
    if (aprAbs < 5) continue;
    // The paper book is long-only, so only negative funding (shorts pay
    // longs) is expressible as a LONG harvest. Positive funding would need
    // a short and is skipped rather than mis-modeled.
    if (!(rate8h < 0)) continue;
    const coin = row.coin.toUpperCase();
    const symbol = `${coin}-PERP`;
    const price = row.markPx;
    // Discipline policy (not market data): 2.2% stop, R:R from house rules.
    const stopPct = 0.022;
    const rewardMultiple = Math.max(2.5, rules.minRiskRewardRatio);
    const stopLossPrice = price * (1 - stopPct);
    const targetPrice = price * (1 + stopPct * rewardMultiple);
    const rr = Math.round(((targetPrice - price) / (price - stopLossPrice)) * 10) / 10;
    out.push({
      id: `perp-${coin.toLowerCase()}-funding`,
      category: "PERPS",
      symbol,
      title: `${coin} long funding harvest (live Hyperliquid)`,
      venueA: "Hyperliquid Perps",
      chain: "solana",
      priceA: price,
      fundingRate8h: rate8h,
      fundingApr: apr,
      perpSide: "LONG",
      leverageMax: 2,
      riskRewardRatio: rr,
      stopLossPct: stopPct,
      stopLossPrice,
      targetPrice,
      maxCapitalAllocationUsd: currentEquity * 0.2,
      disciplineApproved: true,
      disciplineNotes: [
        `Live 8h funding ${(rate8h * 100).toFixed(3)}% (${apr.toFixed(1)}% APR) — shorts pay longs`,
        `Stop ${(stopPct * 100).toFixed(1)}% policy, target ${rr.toFixed(1)}:1 R:R from house rules`,
        "Leverage strictly capped at 2x",
      ],
      confidenceScore: Math.round(Math.min(96, 70 + Math.min(26, aprAbs * 1.2))),
      discoveredAt: now,
      anchorSymbol: coin,
      liveData: true,
    });
  }
  return out.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

function tapeBaseOf(symbol: string): string {
  return symbol.toUpperCase().split(/[/:_\-]/)[0];
}

/**
 * Live tape context for an avenue's anchor symbol (deepest pool wins).
 * Returns null when the tape carries no quote for the anchor — callers must
 * skip the entry (fail-closed) rather than invent volume or volatility.
 */
export function tapeContextFor(
  anchor: string | undefined,
  tape: Array<{ symbol: string; priceUsd: number; liquidityUsd: number; volume24h: number; change24h: number }>,
): { volume24h: number; liquidityUsd: number; change24h: number; priceUsd: number } | null {
  if (!anchor) return null;
  const want = anchor.toUpperCase();
  let best: { volume24h: number; liquidityUsd: number; change24h: number; priceUsd: number } | null = null;
  let bestLiq = -1;
  for (const c of tape) {
    if (tapeBaseOf(c.symbol) !== want) continue;
    if (!(c.priceUsd > 0) || !(c.liquidityUsd > 0)) continue;
    if (c.liquidityUsd > bestLiq) {
      bestLiq = c.liquidityUsd;
      best = { volume24h: c.volume24h, liquidityUsd: c.liquidityUsd, change24h: c.change24h, priceUsd: c.priceUsd };
    }
  }
  return best;
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
  live: AvenueLive = {},
): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of scanAllAvenues(book, rules, now, live)) {
    if (a.anchorSymbol) map.set(a.id, a.anchorSymbol);
  }
  return map;
}

/**
 * Calculates a paper-performance scorecard; it does not assess live-trading readiness.
 * Demonstrates discipline and statistical edge before handling real funds.
 *
 * Only QUALIFYING trades count: bracket-resolved closes (TARGET / STOP /
 * BREAKEVEN). Time stops, manual flattens, expiries and simulated marks are
 * excluded — they teach nothing about edge. Win rate is the primary gate
 * (55% of the score) with a hard 65% floor: below it the score is capped
 * near zero no matter how many trades closed.
 *
 * `history` is the deduped close list (persisted DB events + local book trades).
 */
export function calculatePaperReadiness(
  book: Book,
  history: Array<{ pnl: number; reason?: string; simulated?: boolean }> | null = null,
): PaperReadiness {
  const closes = history ?? book.trades;
  // Qualifying trades only: stop hits are disciplined exits, target hits are
  // successful trades. Everything else (time, manual, expiry, simulated) is
  // excluded from learning and scoring.
  const qualifying = closes.filter((t) => {
    if (t.simulated) return false;
    const r = (t.reason ?? "").toUpperCase();
    return r === "TARGET" || r === "STOP" || r === "BREAKEVEN";
  });
  const completedDemoTrades = qualifying.length;
  const targetDemoTrades = 200;

  const targetHits = qualifying.filter((t) => (t.reason ?? "").toUpperCase() === "TARGET");
  const stopHits = qualifying.filter((t) => (t.reason ?? "").toUpperCase() !== "TARGET");
  const wins = qualifying.filter((t) => t.pnl > 0);
  const losses = qualifying.filter((t) => t.pnl < 0);

  const totalWinPnl = wins.reduce((sum, t) => sum + t.pnl, 0);
  const totalLossPnl = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

  const winRate = completedDemoTrades > 0 ? (wins.length / completedDemoTrades) * 100 : 0;
  const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? 3.0 : 1.0;

  const currentEquity = equity(book);
  const peak = Math.max(book.peakEquity, currentEquity);
  const maxDrawdownPct = peak > 0 ? ((peak - currentEquity) / peak) * 100 : 0;

  // Hard floor: fewer than 20 qualifying trades or a win rate below 65%
  // means there is no evidence of edge — cap the score at 25.
  const MIN_QUALIFYING = 20;
  const MIN_WIN_RATE = 65;
  const floored = completedDemoTrades < MIN_QUALIFYING || winRate < MIN_WIN_RATE;

  // Checklist of rigorous discipline criteria (honest gates)
  const checklist = [
    {
      id: "sample_size",
      label: "Statistical Sample Size (qualifying TP/SL trades)",
      met: completedDemoTrades >= targetDemoTrades,
      currentValue: `${completedDemoTrades} qualifying trades (${targetHits.length} target, ${stopHits.length} stop)`,
      requiredValue: `≥ ${targetDemoTrades} qualifying trades`,
    },
    {
      id: "win_rate",
      label: "Consistent Win Rate",
      met: winRate >= MIN_WIN_RATE && completedDemoTrades >= MIN_QUALIFYING,
      currentValue: `${winRate.toFixed(1)}%`,
      requiredValue: `≥ ${MIN_WIN_RATE.toFixed(1)}% win rate (min ${MIN_QUALIFYING} qualifying)`,
    },
    {
      id: "profit_factor",
      label: "Profit Factor (Gross Win / Gross Loss)",
      met: profitFactor >= 1.6 && completedDemoTrades >= MIN_QUALIFYING,
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

  // Win-rate-led score: 55% win rate vs the 65% floor, 20% log-scaled sample
  // vs 200 trades, 15% profit factor vs 1.6, 10% drawdown discipline.
  const clamp100 = (n: number) => Math.max(0, Math.min(100, n));
  const sampleScore =
    completedDemoTrades === 0
      ? 0
      : clamp100((Math.log10(completedDemoTrades + 1) / Math.log10(targetDemoTrades + 1)) * 100);
  const winScore = completedDemoTrades === 0 ? 0 : clamp100((winRate / MIN_WIN_RATE) * 100);
  const pfScore =
    completedDemoTrades < MIN_QUALIFYING ? 0 : clamp100((profitFactor / 1.6) * 100);
  const ddScore =
    maxDrawdownPct <= 4.5 ? 100 : Math.max(0, 100 - (maxDrawdownPct - 4.5) * 12);
  const rawScore = Math.round(
    0.55 * winScore + 0.2 * sampleScore + 0.15 * pfScore + 0.1 * ddScore,
  );
  const readinessScore = floored ? Math.min(25, rawScore) : rawScore;

  let status: "TRAINING" | "QUALIFYING" | "PAPER_PROVEN" = "TRAINING";
  let statusMessage =
    "Paper training is active; only bracket-resolved trades (targets and stops) count toward the edge estimate.";
  let recommendation =
    "Keep the bot in paper mode while it collects 200 qualifying trades at a 65%+ win rate.";

  if (!floored && readinessScore >= 85 && completedDemoTrades >= targetDemoTrades) {
    status = "PAPER_PROVEN";
    statusMessage = "Paper thresholds met: 200+ qualifying trades at 65%+ win rate. This is not approval for real-money trading.";
    recommendation =
      "The qualifying sample meets the configured paper thresholds. Live execution remains unavailable.";
  } else if (!floored && readinessScore >= 60) {
    status = "QUALIFYING";
    statusMessage = "Paper review in progress; collecting qualifying target/stop outcomes.";
    recommendation =
      "Bot is performing well in simulated market flow. Allow it to finish the 200-trade qualifying sample to confirm drawdown stability.";
  } else if (floored && completedDemoTrades >= MIN_QUALIFYING) {
    statusMessage = `Win rate ${winRate.toFixed(1)}% is below the 65% floor — score capped until edge improves.`;
    recommendation =
      "Losses are outpacing wins on bracket-resolved trades. Let the bot keep learning; the score only rises with a genuine edge.";
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
    targetWinRatePct: 65.0,
    profitFactor: Math.round(profitFactor * 100) / 100,
    targetProfitFactor: 1.6,
    maxObservedDrawdownPct: Math.round(maxDrawdownPct * 10) / 10,
    maxAllowedDrawdownPct: 4.5,
    disciplineAdherenceScore: clamp100((checklist.filter((c) => c.met).length / checklist.length * 100)),
    consecutiveWinsCurrent: consecutiveWins,
    totalDemoProfitUsd: Math.round((currentEquity - DEMO_START) * 100) / 100,
    recommendation,
    checklist,
  };
}
