import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";

export type StoredWinningTrade = {
  id: string;
  symbol: string;
  chain: string;
  venue: string;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  roiPct: number;
  volatility: number;
  atr: number;
  score: number;
  features: number[];
  mode: string;
  reason: string;
  closedAt: number;
};

let tableInitialized = false;
async function ensureTable(sql: Awaited<ReturnType<typeof getSql>>) {
  if (tableInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS winning_trades (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      chain TEXT NOT NULL,
      venue TEXT NOT NULL,
      entry_price NUMERIC NOT NULL,
      exit_price NUMERIC NOT NULL,
      qty NUMERIC NOT NULL,
      pnl NUMERIC NOT NULL,
      roi_pct NUMERIC NOT NULL,
      volatility NUMERIC NOT NULL,
      atr NUMERIC NOT NULL,
      score NUMERIC NOT NULL,
      features JSONB NOT NULL DEFAULT '[]'::jsonb,
      mode TEXT NOT NULL DEFAULT 'demo',
      reason TEXT NOT NULL,
      closed_at BIGINT NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_winning_trades_symbol ON winning_trades(symbol);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_winning_trades_pnl ON winning_trades(pnl);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_winning_trades_closed_at ON winning_trades(closed_at DESC);`;
  tableInitialized = true;
}

export const saveWinningTrade = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: string;
      symbol: string;
      chain?: string;
      venue?: string;
      entryPrice: number;
      exitPrice: number;
      qty: number;
      pnl: number;
      volatility?: number;
      atr?: number;
      score?: number;
      features?: number[];
      mode?: string;
      reason?: string;
      closedAt?: number;
    }) => ({
      id: String(input.id || `tr-${Date.now()}`),
      symbol: String(input.symbol || "UNKNOWN").slice(0, 32),
      chain: String(input.chain || "solana").slice(0, 32),
      venue: String(input.venue || "Raydium CLMM").slice(0, 32),
      entryPrice: Number(input.entryPrice) || 0,
      exitPrice: Number(input.exitPrice) || 0,
      qty: Number(input.qty) || 0,
      pnl: Number(input.pnl) || 0,
      volatility: Number(input.volatility) || 0.02,
      atr: Number(input.atr) || 0,
      score: Number(input.score) || 75,
      features: Array.isArray(input.features) ? input.features.map(Number) : [],
      mode: String(input.mode || "demo"),
      reason: String(input.reason || "TARGET"),
      closedAt: Number(input.closedAt) || Date.now(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const sql = await getSql();
      await ensureTable(sql);
      const roiPct =
        data.entryPrice > 0
          ? ((data.exitPrice - data.entryPrice) / data.entryPrice) * 100
          : 0;

      await sql`
        INSERT INTO winning_trades (
          id, symbol, chain, venue, entry_price, exit_price, qty,
          pnl, roi_pct, volatility, atr, score, features, mode, reason, closed_at
        ) VALUES (
          ${data.id}, ${data.symbol}, ${data.chain}, ${data.venue},
          ${data.entryPrice}, ${data.exitPrice}, ${data.qty},
          ${data.pnl}, ${roiPct}, ${data.volatility}, ${data.atr},
          ${data.score}, ${JSON.stringify(data.features)}, ${data.mode},
          ${data.reason}, ${data.closedAt}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      return { ok: true, id: data.id };
    } catch (err) {
      console.error("[trade-memory] Failed to store winning trade:", err);
      return { ok: false, error: err instanceof Error ? err.message : "DB error" };
    }
  });

export const getWinningTradeMemories = createServerFn({ method: "POST" })
  .validator((input: { limit?: number }) => ({
    limit: Math.max(1, Math.min(100, Number(input?.limit || 20))),
  }))
  .handler(async ({ data }): Promise<{ memories: StoredWinningTrade[]; totalStored: number }> => {
    try {
      const sql = await getSql();
      await ensureTable(sql);
      const rows = await sql<{
        id: string;
        symbol: string;
        chain: string;
        venue: string;
        entry_price: string | number;
        exit_price: string | number;
        qty: string | number;
        pnl: string | number;
        roi_pct: string | number;
        volatility: string | number;
        atr: string | number;
        score: string | number;
        features: number[] | string;
        mode: string;
        reason: string;
        closed_at: string | number;
      }>`
        SELECT * FROM winning_trades
        ORDER BY closed_at DESC
        LIMIT ${data.limit}
      `;

      const countResult = await sql<{ count: string | number }>`
        SELECT COUNT(*) as count FROM winning_trades
      `;
      const totalStored = Number(countResult[0]?.count ?? 0);

      const memories: StoredWinningTrade[] = rows.map((r) => ({
        id: String(r.id),
        symbol: String(r.symbol),
        chain: String(r.chain),
        venue: String(r.venue),
        entryPrice: Number(r.entry_price),
        exitPrice: Number(r.exit_price),
        qty: Number(r.qty),
        pnl: Number(r.pnl),
        roiPct: Number(r.roi_pct),
        volatility: Number(r.volatility),
        atr: Number(r.atr),
        score: Number(r.score),
        features: typeof r.features === "string" ? JSON.parse(r.features) : (r.features ?? []),
        mode: String(r.mode),
        reason: String(r.reason),
        closedAt: Number(r.closed_at),
      }));

      return { memories, totalStored };
    } catch (err) {
      console.error("[trade-memory] Failed to load winning memories:", err);
      return { memories: [], totalStored: 0 };
    }
  });

export const getTradeAnalytics = createServerFn({ method: "POST" })
  .handler(async (): Promise<{
    totalWins: number;
    totalProfit: number;
    avgWin: number;
    highestRoi: number;
    topSymbols: Array<{ symbol: string; count: number; totalPnl: number }>;
  }> => {
    try {
      const sql = await getSql();
      await ensureTable(sql);
      const summary = await sql<{
        total_wins: string | number;
        total_profit: string | number;
        avg_win: string | number;
        highest_roi: string | number;
      }>`
        SELECT
          COUNT(*) as total_wins,
          COALESCE(SUM(pnl), 0) as total_profit,
          COALESCE(AVG(pnl), 0) as avg_win,
          COALESCE(MAX(roi_pct), 0) as highest_roi
        FROM winning_trades
        WHERE pnl > 0
      `;

      const topSyms = await sql<{
        symbol: string;
        count: string | number;
        total_pnl: string | number;
      }>`
        SELECT
          symbol,
          COUNT(*) as count,
          SUM(pnl) as total_pnl
        FROM winning_trades
        GROUP BY symbol
        ORDER BY total_pnl DESC
        LIMIT 5
      `;

      const row = summary[0];
      return {
        totalWins: Number(row?.total_wins ?? 0),
        totalProfit: Number(row?.total_profit ?? 0),
        avgWin: Number(row?.avg_win ?? 0),
        highestRoi: Number(row?.highest_roi ?? 0),
        topSymbols: topSyms.map((s) => ({
          symbol: String(s.symbol),
          count: Number(s.count),
          totalPnl: Number(s.total_pnl),
        })),
      };
    } catch (err) {
      console.error("[trade-memory] Analytics query failed:", err);
      return {
        totalWins: 0,
        totalProfit: 0,
        avgWin: 0,
        highestRoi: 0,
        topSymbols: [],
      };
    }
  });
