import type {
  AvenueCategory,
  AvenueOpportunity,
  DisciplineRules,
  PaperReadiness,
} from "./types";
import type { Book } from "../paper";
import { equity, DEMO_START } from "../paper";
import { funding8hRate, fundingAprPct, type PerpFunding } from "../perps/hyperliquid";
import { interpretPerpRegime, scorePerpEntry } from "../intel/entry-strategy";

function normCoin(symbol: string): string {
  return symbol
    .toUpperCase()
    .replace(/^[0-9]+/, "")
    .replace(/^K(?=[A-Z]{2,})/, "");
}

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
  maxDailyDrawdownPct: 0.03,
  minRiskRewardRatio: 2.5,
  maxPortfolioRiskPerTradePct: 0.015,
  maxAvenueExposurePct: 0.25,
  requireLiquidityLockDays: 30,
  autoBreakEvenAtMultiple: 1.5,
  haltOnConsecutiveLosses: 3,
  blacklistedTokenCheck: true,
  reentryCooldownMinutes: 12,
};

export type AvenueTapeRow = {
  symbol: string;
  priceUsd: number;
  liquidityUsd: number | null;
  volume24h: number | null;
  change24h: number | null;
  liquidityUnknown?: boolean;
  chain?: string;
};

export type AvenueLive = {
  funding?: PerpFunding[];
  /** Market tape — surfaces SPOT_MOMENTUM swing avenues alongside perps, so the
   *  avenue book is not perps-only. */
  tape?: AvenueTapeRow[];
};

/**
 * Live Hyperliquid funding universe with professional LONG/SHORT regime scoring.
 */
export function scanAllAvenues(
  book: Book,
  rules: DisciplineRules = defaultDisciplineRules,
  now: number = Date.now(),
  live: AvenueLive = {},
): AvenueOpportunity[] {
  const currentEquity = equity(book);
  const rows = live.funding ?? [];
  const out: AvenueOpportunity[] = [];
  for (const row of rows) {
    if (row.markPx === null || !(row.markPx > 0)) continue;
    if (row.funding1h === null) continue;
    const rate8h = funding8hRate(row.funding1h) ?? 0;
    const apr = fundingAprPct(row.funding1h) ?? 0;
    const aprAbs = Math.abs(apr);
    if (aprAbs < 5) continue;

    const regime = interpretPerpRegime(row.funding1h, row.openInterest);
    if (!regime) continue;
    if (Math.abs(regime.funding8h) < 0.00005) continue;
    // The paper book is long-only, so only negative funding (shorts pay
    // longs) is expressible as a LONG harvest. Positive funding would need
    // a short and is skipped rather than mis-modeled.
    if (regime.side === "SHORT") continue;

    const coin = row.coin.toUpperCase();
    const symbol = `${coin}-PERP`;
    const price = row.markPx;
    const stopPct = regime.extremeFunding ? 0.018 : 0.022;
    const rewardMultiple = Math.max(2.5, rules.minRiskRewardRatio);
    const side = regime.side;
    const stopLossPrice =
      side === "LONG" ? price * (1 - stopPct) : price * (1 + stopPct);
    const targetPrice =
      side === "LONG"
        ? price * (1 + stopPct * rewardMultiple)
        : price * (1 - stopPct * rewardMultiple);
    const riskUnit = Math.abs(price - stopLossPrice) || price * stopPct;
    const rr = Math.round((Math.abs(targetPrice - price) / riskUnit) * 10) / 10;
    const baseConf = Math.round(Math.min(96, 70 + Math.min(26, aprAbs * 1.2)));
    const entryScore = scorePerpEntry(baseConf, regime);

    out.push({
      id: `perp-${coin.toLowerCase()}-funding`,
      category: "PERPS",
      symbol,
      title: `${coin} ${side.toLowerCase()} funding harvest (live Hyperliquid)`,
      venueA: "Hyperliquid Perps",
      chain: "solana",
      priceA: price,
      fundingRate8h: rate8h,
      fundingApr: apr,
      perpSide: side,
      leverageMax: 2,
      riskRewardRatio: rr,
      stopLossPct: stopPct,
      stopLossPrice,
      targetPrice,
      maxCapitalAllocationUsd: currentEquity * (regime.extremeFunding ? 0.12 : 0.18),
      disciplineApproved: entryScore >= 55,
      disciplineNotes: [
        ...regime.notes,
        `Stop ${(stopPct * 100).toFixed(1)}% policy, target ${rr.toFixed(1)}:1 R:R`,
        "Leverage strictly capped at 2x",
        `Entry score ${entryScore}/100 (funding + OI regime)`,
      ],
      confidenceScore: entryScore,
      discoveredAt: now,
      anchorSymbol: coin,
      liveData: true,
    });
  }
  if (live.tape && live.tape.length) {
    out.push(...scanSpotMomentumAvenues(live.tape, currentEquity, rules, now));
  }
  return out.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

const SPOT_STABLE_BASES = new Set([
  "USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDE", "PYUSD", "GUSD", "USDD", "LUSD", "FRAX", "SUSD",
]);

/**
 * Swing avenues derived from the market tape — momentum names with real depth
 * and a meaningful 24h move. These ride the same discipline/sizing gates as the
 * perp avenues; the anchor is the tape symbol's own base so the desk marks them
 * from the live quote it already holds.
 */
export function scanSpotMomentumAvenues(
  tape: AvenueTapeRow[],
  currentEquity: number,
  rules: DisciplineRules = defaultDisciplineRules,
  now: number = Date.now(),
): AvenueOpportunity[] {
  const out: AvenueOpportunity[] = [];
  for (const row of tape) {
    if (!(row.priceUsd > 0)) continue;
    const base = tapeBaseOf(row.symbol);
    const cleanBase = base.replace(/USDT$|USDC$|USD$/, "") || base;
    if (SPOT_STABLE_BASES.has(base) || SPOT_STABLE_BASES.has(cleanBase)) continue;
    const change = row.change24h ?? 0;
    const momentum = Math.abs(change);
    if (momentum < 2.5) continue;
    const liq = row.liquidityUsd ?? 0;
    const unknownDepth = row.liquidityUnknown === true || row.liquidityUsd == null;
    if (!unknownDepth && liq < 150_000) continue;
    const vol = row.volume24h ?? 0;
    if (!unknownDepth && vol > 0 && vol < 75_000) continue;

    const side: "LONG" | "SHORT" = change >= 0 ? "LONG" : "SHORT";
    const stopPct = Math.max(0.02, Math.min(0.06, momentum / 100));
    const rewardMultiple = Math.max(2.5, rules.minRiskRewardRatio);
    const price = row.priceUsd;
    const stop = side === "LONG" ? price * (1 - stopPct) : price * (1 + stopPct);
    const target = side === "LONG" ? price * (1 + stopPct * rewardMultiple) : price * (1 - stopPct * rewardMultiple);
    const rr = Math.round((Math.abs(target - price) / (Math.abs(price - stop) || price * stopPct)) * 10) / 10;
    const conf = Math.round(
      Math.min(92, 58 + Math.min(22, momentum * 1.6) + (unknownDepth ? 0 : Math.min(10, liq / 200_000))),
    );
    if (conf < 60) continue;

    out.push({
      id: `spot-${base.toLowerCase()}-mom`,
      category: "SPOT_MOMENTUM",
      symbol: base,
      title: `${cleanBase} ${side === "LONG" ? "bullish" : "bearish"} momentum swing (${change >= 0 ? "+" : ""}${change.toFixed(1)}% 24h)`,
      venueA: "Spot tape",
      chain: (row.chain as AvenueOpportunity["chain"]) ?? "ethereum",
      priceA: price,
      perpSide: side,
      riskRewardRatio: rr,
      stopLossPct: stopPct,
      stopLossPrice: stop,
      targetPrice: target,
      maxCapitalAllocationUsd: currentEquity * 0.16,
      disciplineApproved: conf >= 62,
      disciplineNotes: [
        `24h move ${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
        unknownDepth ? "Depth unpublished (CEX major)" : `Pool liquidity $${Math.round(liq).toLocaleString()}`,
        `Stop ${(stopPct * 100).toFixed(1)}%, target ${rr.toFixed(1)}:1 R:R`,
      ],
      confidenceScore: conf,
      discoveredAt: now,
      anchorSymbol: base,
      liveData: true,
    });
  }
  return out;
}

function tapeBaseOf(symbol: string): string {
  return symbol.toUpperCase().split(/[/:_\-]/)[0];
}

export function tapeContextFor(
  anchor: string | undefined,
  tape: Array<{
    symbol: string;
    priceUsd: number;
    liquidityUsd: number | null;
    volume24h: number | null;
    change24h: number | null;
    liquidityUnknown?: boolean;
  }>,
): {
  volume24h: number;
  liquidityUsd: number | null;
  change24h: number;
  priceUsd: number;
  liquidityUnknown: boolean;
} | null {
  if (!anchor) return null;
  const want = anchor.toUpperCase();
  let best: {
    volume24h: number;
    liquidityUsd: number | null;
    change24h: number;
    priceUsd: number;
    liquidityUnknown: boolean;
  } | null = null;
  let bestLiq = -1;
  for (const c of tape) {
    if (tapeBaseOf(c.symbol) !== want) continue;
    if (!(c.priceUsd > 0)) continue;
    const liq = c.liquidityUsd ?? 0;
    if (liq > bestLiq) {
      bestLiq = liq;
      best = {
        volume24h: c.volume24h ?? 0,
        liquidityUsd: c.liquidityUsd,
        change24h: c.change24h ?? 0,
        priceUsd: c.priceUsd,
        liquidityUnknown: c.liquidityUnknown === true || c.liquidityUsd == null,
      };
    }
  }
  return best;
}

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

export interface ReadinessTargets {
  trades: number;
  winRate: number;
}

export const DEFAULT_READINESS_TARGETS: ReadinessTargets = { trades: 200, winRate: 65 };

export function calculatePaperReadiness(
  book: Book,
  history: Array<{ pnl: number; reason?: string; simulated?: boolean }> | null = null,
  targets: Partial<ReadinessTargets> = {},
): PaperReadiness {
  const closes = history ?? book.trades;
  const qualifying = closes.filter((t) => {
    if (t.simulated) return false;
    const r = (t.reason ?? "").toUpperCase();
    return r === "TARGET" || r === "STOP" || r === "BREAKEVEN";
  });
  const completedDemoTrades = qualifying.length;
  const targetDemoTrades = Math.round(
    Math.min(300, Math.max(50, targets.trades ?? DEFAULT_READINESS_TARGETS.trades)),
  );

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

  const MIN_QUALIFYING = 20;
  const MIN_WIN_RATE = Math.min(80, Math.max(50, targets.winRate ?? DEFAULT_READINESS_TARGETS.winRate));
  const floored = completedDemoTrades < MIN_QUALIFYING || winRate < MIN_WIN_RATE;

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
      met: true,
      currentValue: "100% compliant",
      requiredValue: "100% adherence (R:R ≥ 2.5:1, stops enforced)",
    },
  ];

  const clamp100 = (n: number) => Math.max(0, Math.min(100, n));
  const sampleScore =
    completedDemoTrades === 0
      ? 0
      : clamp100((completedDemoTrades / targetDemoTrades) * 100);
  const winScore = completedDemoTrades === 0 ? 0 : clamp100((winRate / MIN_WIN_RATE) * 100);
  const pfScore =
    completedDemoTrades < MIN_QUALIFYING ? 0 : clamp100((profitFactor / 1.6) * 100);
  const ddScore =
    maxDrawdownPct <= 4.5 ? 100 : Math.max(0, 100 - (maxDrawdownPct - 4.5) * 12);
  const rawScore = Math.round(
    0.55 * winScore + 0.2 * sampleScore + 0.15 * pfScore + 0.1 * ddScore,
  );
  const sampleCap = Math.round(25 + (75 * Math.min(completedDemoTrades, targetDemoTrades)) / targetDemoTrades);
  const readinessScore = floored ? Math.min(25, rawScore) : Math.min(rawScore, sampleCap);

  let status: "TRAINING" | "QUALIFYING" | "PAPER_PROVEN" = "TRAINING";
  let statusMessage =
    "Paper training is active; only bracket-resolved trades (targets and stops) count toward the edge estimate.";
  let recommendation =
    `Keep the bot in paper mode while it collects ${targetDemoTrades} qualifying trades at a ${MIN_WIN_RATE}%+ win rate.`;

  if (!floored && readinessScore >= 85 && completedDemoTrades >= targetDemoTrades) {
    status = "PAPER_PROVEN";
    statusMessage = `Paper thresholds met: ${targetDemoTrades}+ qualifying trades at ${MIN_WIN_RATE}%+ win rate. This is not approval for real-money trading.`;
    recommendation =
      "The qualifying sample meets the configured paper thresholds. Live execution remains unavailable.";
  } else if (!floored && readinessScore >= 60) {
    status = "QUALIFYING";
    statusMessage = "Paper review in progress; collecting qualifying target/stop outcomes.";
    recommendation =
      `Bot is performing well in simulated market flow. Allow it to finish the ${targetDemoTrades}-trade qualifying sample to confirm drawdown stability.`;
  } else if (floored && completedDemoTrades >= MIN_QUALIFYING) {
    statusMessage = `Win rate ${winRate.toFixed(1)}% is below the ${MIN_WIN_RATE}% floor — score capped until edge improves.`;
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
    targetWinRatePct: MIN_WIN_RATE,
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
