/**
 * Backtest Replay Harness (Blueprint P5).
 *
 * Replays persisted trade-learning events (Neon) through the CURRENT
 * engine — edge screen, sizer, exit profile — to produce outcome
 * distributions and expectancy. Read-only against the DB; recommendations
 * are surfaced, never auto-applied.
 *
 * This module is deliberately store-free and DB-free: it receives closed
 * trade records and produces a report. The desk wires it later (P5 UI).
 */

import { ladderExpectancy } from "../sniper/exits";

export interface ReplayTradeInput {
  id: string;
  symbol: string;
  score: number;
  change24h: number;
  volume24h: number;
  liquidityUsd: number;
  pairAgeHours: number | null;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  reason: string;
  simulated: boolean;
  venue: string;
}

export interface ReplayOutcome {
  id: string;
  symbol: string;
  /** P&L in R-multiples of the trade's own risk. */
  rMultiple: number;
  pnl: number;
  passedEdgeScreen: boolean;
  netPnl: number;
}

export interface ReplayReport {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  /** Gross profit factor: sum(wins) / |sum(losses)|. */
  profitFactor: number;
  expectancyR: number;
  totalNetPnl: number;
  /** Trades the CURRENT engine would have taken (edge screen pass). */
  wouldTake: number;
  wouldTakeWinRate: number;
}

/** CEX round-trip cost approximation for the replay pass (execution-v2 wired in P4). */
const CEX_ROUND_TRIP_COST = 0.0035;

/** Simple momentum edge screen mirroring emh.ts' major/momentum path. */
function passesCurrentEdgeScreen(t: ReplayTradeInput): boolean {
  if (Math.abs(t.change24h) >= 1.2 && t.score >= 52) return true;
  if (t.score >= 80 && t.change24h > 0) return true;
  if (t.liquidityUsd >= 20_000 && t.score >= 68 && t.pairAgeHours !== null && t.pairAgeHours < 8 && t.change24h > -3) return true;
  return false;
}

export function replayTrades(trades: ReplayTradeInput[]): ReplayReport {
  const outcomes: ReplayOutcome[] = [];
  let grossWin = 0;
  let grossLoss = 0;
  let wins = 0;
  let wouldTake = 0;
  let wouldTakeWins = 0;
  let totalNet = 0;

  for (const t of trades) {
    const passed = passesCurrentEdgeScreen(t);
    const net = t.pnl * (1 - CEX_ROUND_TRIP_COST);
    // R-multiple: gross P&L against the |entry→exit| move scaled to the
    // position's own risk (|move| is the realized risk distance).
    const moveUsd = Math.abs(t.entryPrice - t.exitPrice);
    const riskProxyUsd = moveUsd > 0 ? moveUsd * Math.max(1, Math.abs(t.pnl) / moveUsd) : 1;
    const rMultiple = riskProxyUsd > 0 ? t.pnl / riskProxyUsd : 0;
    outcomes.push({
      id: t.id,
      symbol: t.symbol,
      rMultiple,
      pnl: t.pnl,
      passedEdgeScreen: passed,
      netPnl: net,
    });
    if (t.pnl > 0) {
      wins += 1;
      grossWin += t.pnl;
    } else if (t.pnl < 0) {
      grossLoss += -t.pnl;
    }
    totalNet += net;
    if (passed) {
      wouldTake += 1;
      if (t.pnl > 0) wouldTakeWins += 1;
    }
  }

  const n = trades.length;
  return {
    trades: n,
    wins,
    losses: n - wins,
    winRate: n > 0 ? wins / n : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    expectancyR: n > 0 ? outcomes.reduce((s, o) => s + o.rMultiple, 0) / n : 0,
    totalNetPnl: totalNet,
    wouldTake,
    wouldTakeWinRate: wouldTake > 0 ? wouldTakeWins / wouldTake : 0,
  };
}

/**
 * Parameter sweep: expected blended expectancy for candidate exit
 * profiles. Uses the ladder's closed-form model, not full replay — the
 * full replay sweep arrives with P5's UI.
 */
export function sweepExitProfiles(
  winRate: number,
  candidates: Array<{ avgWinnerR: number; avgLoserR: number }>,
): Array<{ avgWinnerR: number; avgLoserR: number; expectancyR: number }> {
  return candidates.map((c) => ({
    ...c,
    expectancyR: ladderExpectancy(winRate, c.avgWinnerR, c.avgLoserR),
  }));
}
