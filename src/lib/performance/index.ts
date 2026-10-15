/** Performance Monitoring module for the Monroe Sniper bot.
 *  Provides P&L tracking, trade attribution, strategy comparison,
 *  and real-time dashboard data.
 *
 *  All data is stored in localStorage for persistence across sessions.
 *  In production, this would feed into a time-series DB (InfluxDB,
 *  TimescaleDB) or analytics platform.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** A single closed trade with full attribution data. */
export type TradeRecord = {
  /** Unique trade ID */
  id: string;
  /** Symbol traded */
  symbol: string;
  /** Entry timestamp */
  entryAt: number;
  /** Exit timestamp */
  exitAt: number;
  /** Hold duration in milliseconds */
  holdMs: number;
  /** Side: LONG or SHORT */
  side: "LONG" | "SHORT";
  /** Entry price */
  entryPrice: number;
  /** Exit price */
  exitPrice: number;
  /** Position size in quote currency (e.g. USDT) */
  size: number;
  /** Realised P&L in quote currency */
  pnl: number;
  /** P&L as percentage of entry notional */
  pnlPct: number;
  /** Fees paid */
  fees: number;
  /** Strategy / model that generated the signal */
  strategy: string;
  /** Risk model profile active at entry */
  riskProfile: string;
  /** Exit reason */
  exitReason: "TARGET" | "STOP" | "TIME" | "SIGNAL" | "MANUAL" | "EXPIRY" | "CIRCUIT_BREAKER";
  /** Market regime at entry (trending, ranging, volatile) */
  marketRegime?: string;
  /** Confidence score at entry (0-100) */
  confidence?: number;
};

/** Aggregated P&L metrics for a time window. */
export type PnLMetrics = {
  /** Total realised P&L */
  totalPnl: number;
  /** Total P&L as percentage of starting equity */
  totalPnlPct: number;
  /** Number of winning trades */
  wins: number;
  /** Number of losing trades */
  losses: number;
  /** Win rate (0-100) */
  winRate: number;
  /** Average win size */
  avgWin: number;
  /** Average loss size */
  avgLoss: number;
  /** Profit factor (gross wins / gross losses) */
  profitFactor: number;
  /** Maximum drawdown in period */
  maxDrawdown: number;
  /** Maximum drawdown percentage */
  maxDrawdownPct: number;
  /** Sharpe ratio (simplified, daily returns) */
  sharpeRatio: number;
  /** Sortino ratio (downside deviation) */
  sortinoRatio: number;
  /** Total fees paid */
  totalFees: number;
  /** Number of trades */
  tradeCount: number;
};

/** Strategy comparison metrics. */
export type StrategyMetrics = {
  /** Strategy name */
  name: string;
  /** Total trades */
  trades: number;
  /** Win rate */
  winRate: number;
  /** Total P&L */
  totalPnl: number;
  /** Average P&L per trade */
  avgPnl: number;
  /** Profit factor */
  profitFactor: number;
  /** Max drawdown */
  maxDrawdown: number;
  /** Sharpe ratio */
  sharpeRatio: number;
};

/** Performance dashboard snapshot. */
export type DashboardSnapshot = {
  /** Current equity */
  equity: number;
  /** Starting equity for the period */
  startEquity: number;
  /** P&L metrics for current session */
  session: PnLMetrics;
  /** P&L metrics for all time */
  allTime: PnLMetrics;
  /** P&L metrics for last 24h */
  last24h: PnLMetrics;
  /** P&L metrics for last 7d */
  last7d: PnLMetrics;
  /** Strategy breakdown */
  byStrategy: StrategyMetrics[];
  /** Risk profile breakdown */
  byRiskProfile: StrategyMetrics[];
  /** Symbol breakdown */
  bySymbol: StrategyMetrics[];
  /** Equity curve (timestamp, equity) */
  equityCurve: [number, number][];
  /** Daily P&L (date, pnl) */
  dailyPnl: [string, number][];
  /** Monthly P&L (month, pnl) */
  monthlyPnl: [string, number][];
};

/** In-memory + localStorage performance store. */
interface PerfState {
  trades: TradeRecord[];
  equityCurve: [number, number][];
  startEquity: number;
  /** Add a completed trade to the history. */
  addTrade: (t: TradeRecord) => void;
  /** Set the starting equity (called on first load). */
  setStartEquity: (eq: number) => void;
  /** Recalculate equity curve from trades. */
  rebuildEquityCurve: () => void;
  /** Get P&L metrics for a time window. */
  getMetrics: (since: number) => PnLMetrics;
  /** Get full dashboard snapshot. */
  getDashboard: () => DashboardSnapshot;
  /** Export trades as CSV. */
  exportCsv: () => string;
  /** Clear all data (for testing / reset). */
  clear: () => void;
}

const STORAGE_KEY = "monroe-perf-v1";

function calcMetrics(trades: TradeRecord[], startEquity: number): PnLMetrics {
  if (trades.length === 0) {
    return {
      totalPnl: 0,
      totalPnlPct: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      totalFees: 0,
      tradeCount: 0,
    };
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const grossWins = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  const totalFees = trades.reduce((sum, t) => sum + t.fees, 0);

  // Equity curve for drawdown calculation
  let equity = startEquity;
  let peak = startEquity;
  let maxDD = 0;
  const equityPoints: number[] = [];
  for (const t of trades) {
    equity += t.pnl;
    equityPoints.push(equity);
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }

  // Daily returns for Sharpe/Sortino
  const dailyReturns: Record<string, number> = {};
  for (const t of trades) {
    const date = new Date(t.exitAt).toISOString().split("T")[0];
    dailyReturns[date] = (dailyReturns[date] ?? 0) + t.pnl;
  }
  const returns = Object.values(dailyReturns);
  const avgReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length
    ? Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length)
    : 0;
  const downsideDev = returns.length
    ? Math.sqrt(returns.filter((r) => r < 0).reduce((s, r) => s + r ** 2, 0) / returns.length)
    : 0;

  return {
    totalPnl,
    totalPnlPct: startEquity > 0 ? (totalPnl / startEquity) * 100 : 0,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    avgWin: wins.length ? grossWins / wins.length : 0,
    avgLoss: losses.length ? grossLosses / losses.length : 0,
    profitFactor: grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0,
    maxDrawdown: maxDD,
    maxDrawdownPct: peak > 0 ? (maxDD / peak) * 100 : 0,
    sharpeRatio: stdDev > 0 ? avgReturn / stdDev : 0,
    sortinoRatio: downsideDev > 0 ? avgReturn / downsideDev : 0,
    totalFees,
    tradeCount: trades.length,
  };
}

function calcStrategyMetrics(trades: TradeRecord[], groupBy: keyof TradeRecord): StrategyMetrics[] {
  const groups: Record<string, TradeRecord[]> = {};
  for (const t of trades) {
    const key = String(t[groupBy]);
    groups[key] = [...(groups[key] ?? []), t];
  }
  return Object.entries(groups).map(([name, ts]) => ({
    name,
    trades: ts.length,
    winRate: calcMetrics(ts, 0).winRate,
    totalPnl: ts.reduce((s, t) => s + t.pnl, 0),
    avgPnl: ts.reduce((s, t) => s + t.pnl, 0) / ts.length,
    profitFactor: calcMetrics(ts, 0).profitFactor,
    maxDrawdown: calcMetrics(ts, 0).maxDrawdown,
    sharpeRatio: calcMetrics(ts, 0).sharpeRatio,
  }));
}

export const usePerfStore = create<PerfState>()(
  persist(
    (set, get) => ({
      trades: [],
      equityCurve: [],
      startEquity: 10_000, // default $10k paper equity

      addTrade: (t) =>
        set((s) => {
          const trades = [t, ...s.trades].slice(0, 50_000);
          // Rebuild equity curve
          let equity = s.startEquity;
          const curve: [number, number][] = [[t.entryAt, equity]];
          for (const tr of trades) {
            equity += tr.pnl;
            curve.push([tr.exitAt, equity]);
          }
          return { trades, equityCurve: curve };
        }),

      setStartEquity: (eq) =>
        set((s) => {
          let equity = eq;
          const curve: [number, number][] = [[Date.now(), equity]];
          for (const t of s.trades) {
            equity += t.pnl;
            curve.push([t.exitAt, equity]);
          }
          return { startEquity: eq, equityCurve: curve };
        }),

      rebuildEquityCurve: () =>
        set((s) => {
          let equity = s.startEquity;
          const curve: [number, number][] = [[Date.now(), equity]];
          for (const t of s.trades) {
            equity += t.pnl;
            curve.push([t.exitAt, equity]);
          }
          return { equityCurve: curve };
        }),

      getMetrics: (since) => {
        const trades = get().trades.filter((t) => t.exitAt >= since);
        return calcMetrics(trades, get().startEquity);
      },

      getDashboard: () => {
        const { trades, equityCurve, startEquity } = get();
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;

        // Group by strategy, risk profile, symbol
        const byStrategy = calcStrategyMetrics(trades, "strategy");
        const byRiskProfile = calcStrategyMetrics(trades, "riskProfile");
        const bySymbol = calcStrategyMetrics(trades, "symbol");

        // Daily P&L
        const dailyMap: Record<string, number> = {};
        for (const t of trades) {
          const date = new Date(t.exitAt).toISOString().split("T")[0];
          dailyMap[date] = (dailyMap[date] ?? 0) + t.pnl;
        }
        const dailyPnl = Object.entries(dailyMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, pnl]) => [date, pnl] as [string, number]);

        // Monthly P&L
        const monthlyMap: Record<string, number> = {};
        for (const t of trades) {
          const month = new Date(t.exitAt).toISOString().slice(0, 7); // YYYY-MM
          monthlyMap[month] = (monthlyMap[month] ?? 0) + t.pnl;
        }
        const monthlyPnl = Object.entries(monthlyMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, pnl]) => [month, pnl] as [string, number]);

        return {
          equity: equityCurve[equityCurve.length - 1]?.[1] ?? startEquity,
          startEquity,
          session: calcMetrics(trades, startEquity),
          allTime: calcMetrics(trades, startEquity),
          last24h: calcMetrics(trades.filter((t) => t.exitAt >= now - dayMs), startEquity),
          last7d: calcMetrics(trades.filter((t) => t.exitAt >= now - 7 * dayMs), startEquity),
          byStrategy,
          byRiskProfile,
          bySymbol,
          equityCurve,
          dailyPnl,
          monthlyPnl,
        };
      },

      exportCsv: () => {
        const header =
          "id,symbol,entryAt,exitAt,holdMs,side,entryPrice,exitPrice,size,pnl,pnlPct,fees,strategy,riskProfile,exitReason,marketRegime,confidence";
        const rows = get().trades.map(
          (t) =>
            `${t.id},${t.symbol},${t.entryAt},${t.exitAt},${t.holdMs},${t.side},${t.entryPrice},${t.exitPrice},${t.size},${t.pnl},${t.pnlPct},${t.fees},${t.strategy},${t.riskProfile},${t.exitReason},${t.marketRegime ?? ""},${t.confidence ?? ""}`
        );
        return [header, ...rows].join("\n");
      },

      clear: () => set({ trades: [], equityCurve: [] }),
    }),
    { name: STORAGE_KEY, partialize: (s) => ({ trades: s.trades, equityCurve: s.equityCurve, startEquity: s.startEquity }) }
  )
);

/** Helper to record a closed trade from the desk's execution log. */
export function recordTrade(
  execution: {
    id: string;
    symbol: string;
    side: "BUY" | "SELL";
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    entryAt: number;
    exitAt: number;
    fees: number;
    exitReason: TradeRecord["exitReason"];
    strategy: string;
    riskProfile: string;
    marketRegime?: string;
    confidence?: number;
  }
): void {
  const side = execution.side === "BUY" ? "LONG" : "SHORT";
  const pnl = execution.side === "BUY"
    ? (execution.exitPrice - execution.entryPrice) * execution.quantity
    : (execution.entryPrice - execution.exitPrice) * execution.quantity;
  const pnlPct = execution.entryPrice > 0 ? (pnl / (execution.entryPrice * execution.quantity)) * 100 : 0;

  usePerfStore.getState().addTrade({
    id: execution.id,
    symbol: execution.symbol,
    entryAt: execution.entryAt,
    exitAt: execution.exitAt,
    holdMs: execution.exitAt - execution.entryAt,
    side,
    entryPrice: execution.entryPrice,
    exitPrice: execution.exitPrice,
    size: execution.entryPrice * execution.quantity,
    pnl,
    pnlPct,
    fees: execution.fees,
    strategy: execution.strategy,
    riskProfile: execution.riskProfile,
    exitReason: execution.exitReason,
    marketRegime: execution.marketRegime,
    confidence: execution.confidence,
  });
}

/** Get a quick summary string for the status bar. */
export function getPerfSummary(): string {
  const dash = usePerfStore.getState().getDashboard();
  return `Eq: $${dash.equity.toFixed(2)} | P&L: ${dash.session.totalPnlPct.toFixed(2)}% | WR: ${dash.session.winRate.toFixed(1)}% | PF: ${dash.session.profitFactor.toFixed(2)} | Trades: ${dash.session.tradeCount}`;
}

