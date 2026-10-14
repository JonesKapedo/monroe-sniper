import { createServerFn } from "@tanstack/react-start";
import { dbSource, getSql } from "./db";

export type TradeLearningState = {
  seen: number;
  wins: number;
  losses: number;
  realized: number;
  minScore: number;
  dbSource: "neon" | "pglite";
};

export type TradeLearningInput = {
  id: string;
  symbol: string;
  chain: string;
  venue: string;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  score: number;
  change24h: number;
  liquidityUsd: number;
  volume24h: number;
  pairAgeHours: number | null;
  mode: "demo" | "live";
  reason: string;
  openedAt: number;
  closedAt: number;
};

function normalizeTrade(input: TradeLearningInput): TradeLearningInput {
  const strings = [input.id, input.symbol, input.chain, input.venue, input.reason];
  if (strings.some((value) => typeof value !== "string" || value.trim() === "")) {
    throw new Error("Trade learning records require non-empty identity fields.");
  }
  if (input.id.length > 128 || input.symbol.length > 32 || input.chain.length > 32 ||
      input.venue.length > 64 || input.reason.length > 32) {
    throw new Error("Trade learning record contains an overlong identity field.");
  }
  if (input.mode !== "demo" && input.mode !== "live") {
    throw new Error("Trade learning record mode is invalid.");
  }

  const finiteValues = [
    input.entryPrice,
    input.exitPrice,
    input.qty,
    input.pnl,
    input.score,
    input.change24h,
    input.liquidityUsd,
    input.volume24h,
    input.openedAt,
    input.closedAt,
  ];
  if (finiteValues.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error("Trade learning records require finite numeric values.");
  }
  if (input.pairAgeHours !== null &&
      (typeof input.pairAgeHours !== "number" || !Number.isFinite(input.pairAgeHours))) {
    throw new Error("Trade learning record pair age must be finite or null.");
  }
  if (input.entryPrice < 0 || input.exitPrice < 0 || input.qty < 0 ||
      input.liquidityUsd < 0 || input.volume24h < 0 || input.score < 0 || input.score > 100) {
    throw new Error("Trade learning record contains an out-of-range value.");
  }
  return {
    ...input,
    id: input.id.trim(),
    symbol: input.symbol.trim().slice(0, 32),
    chain: input.chain.trim().slice(0, 32),
    venue: input.venue.trim().slice(0, 64),
    reason: input.reason.trim().slice(0, 32),
  };
}

function learningState(row: {
  seen: number | string;
  wins: number | string;
  losses: number | string;
  realized: number | string;
  min_score: number | string;
}): TradeLearningState {
  return {
    seen: Number(row.seen),
    wins: Number(row.wins),
    losses: Number(row.losses),
    realized: Number(row.realized),
    minScore: Number(row.min_score),
    dbSource,
  };
}

export const saveTradeLearning = createServerFn({ method: "POST" })
  .validator(normalizeTrade)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{
      inserted: boolean;
      seen: number | string;
      wins: number | string;
      losses: number | string;
      realized: number | string;
      min_score: number | string;
    }>`
      WITH inserted AS (
        INSERT INTO trade_learning_events (
          id, symbol, chain, venue, entry_price, exit_price, qty, pnl, score,
          change_24h, liquidity_usd, volume_24h, pair_age_hours, mode, reason,
          opened_at, closed_at
        ) VALUES (
          ${data.id}, ${data.symbol}, ${data.chain}, ${data.venue},
          ${data.entryPrice}, ${data.exitPrice}, ${data.qty}, ${data.pnl},
          ${data.score}, ${data.change24h}, ${data.liquidityUsd},
          ${data.volume24h}, ${data.pairAgeHours}, ${data.mode}, ${data.reason},
          ${data.openedAt}, ${data.closedAt}
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING pnl
      ),
      updated AS (
        INSERT INTO trade_learning_state (
          singleton, seen, wins, losses, realized, min_score
        )
        SELECT
          TRUE, 1, (pnl > 0)::INTEGER, (pnl < 0)::INTEGER, pnl, 62
        FROM inserted
        ON CONFLICT (singleton) DO UPDATE SET
          seen = trade_learning_state.seen + 1,
          wins = trade_learning_state.wins + EXCLUDED.wins,
          losses = trade_learning_state.losses + EXCLUDED.losses,
          realized = trade_learning_state.realized + EXCLUDED.realized,
          min_score = CASE
            WHEN trade_learning_state.seen + 1 < 4 THEN trade_learning_state.min_score
            WHEN (trade_learning_state.wins + EXCLUDED.wins)::DOUBLE PRECISION /
              (trade_learning_state.seen + 1) < 0.4
              OR trade_learning_state.realized + EXCLUDED.realized < 0
              THEN LEAST(85, 62 + 2 * (trade_learning_state.seen + 1 - 3))
            WHEN (trade_learning_state.wins + EXCLUDED.wins)::DOUBLE PRECISION /
              (trade_learning_state.seen + 1) > 0.55
              AND trade_learning_state.realized + EXCLUDED.realized > 0
              THEN GREATEST(55, 62 - (trade_learning_state.seen + 1 - 3))
            ELSE 62
          END
        RETURNING seen, wins, losses, realized, min_score
      )
      SELECT TRUE AS inserted, seen, wins, losses, realized, min_score
      FROM updated
      UNION ALL
      SELECT FALSE AS inserted, seen, wins, losses, realized, min_score
      FROM trade_learning_state
      WHERE singleton = TRUE AND NOT EXISTS (SELECT 1 FROM inserted)
    `;
    const row = rows[0];
    if (!row) throw new Error("Trade learning write completed without a state result.");
    return { inserted: row.inserted, state: learningState(row) };
  });

export const getTradeLearningState = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  try {
    const rows = await sql<{
      seen: number | string;
      wins: number | string;
      losses: number | string;
      realized: number | string;
      min_score: number | string;
    }>`
      SELECT seen, wins, losses, realized, min_score
      FROM trade_learning_state
      WHERE singleton = TRUE
    `;
    const row = rows[0];
    if (!row)
      throw new Error(
        `Trade learning state row is missing on ${dbSource}. Apply migrations/*.sql to this database.`,
      );
    return learningState(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/relation .* does not exist|no such table/i.test(message)) {
      throw new Error(
        `Trade learning tables are missing on ${dbSource}. Apply migrations/*.sql (0002_trade_learning.sql) to this database.`,
      );
    }
    throw error;
  }
});

export type DbHealth = {
  source: "neon" | "pglite";
  ok: boolean;
  events: number;
  state: TradeLearningState | null;
  /** Gross sums across all persisted closes — the profit-factor inputs. */
  grossWin: number;
  grossLoss: number;
  error: string | null;
};

/** Single streamlined health probe the UI can poll: backend, reachability, counts. */
export const getDbHealth = createServerFn({ method: "GET" }).handler(async (): Promise<DbHealth> => {
  const fail = (error: unknown): DbHealth => ({
    source: dbSource,
    ok: false,
    events: 0,
    state: null,
    grossWin: 0,
    grossLoss: 0,
    error: error instanceof Error ? error.message : String(error),
  });
  try {
    const sql = await getSql();
    const counts = await sql<{ events: number | string; gross_win: number | string; gross_loss: number | string }>`
      SELECT COUNT(*)::INTEGER AS events,
        COALESCE(SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0) AS gross_win,
        COALESCE(SUM(CASE WHEN pnl < 0 THEN -pnl ELSE 0 END), 0) AS gross_loss
      FROM trade_learning_events
    `;
    const states = await sql<{
      seen: number | string;
      wins: number | string;
      losses: number | string;
      realized: number | string;
      min_score: number | string;
    }>`
      SELECT seen, wins, losses, realized, min_score
      FROM trade_learning_state
      WHERE singleton = TRUE
    `;
    const row = states[0];
    const agg = counts[0];
    if (!row) return fail("Trade learning state row is missing. Apply migrations/*.sql to this database.");
    return {
      source: dbSource,
      ok: true,
      events: Number(agg?.events ?? 0),
      state: learningState(row),
      grossWin: Number(agg?.gross_win ?? 0),
      grossLoss: Number(agg?.gross_loss ?? 0),
      error: null,
    };
  } catch (error) {
    return fail(error);
  }
});

export type TradeLearningEvent = {
  id: string;
  symbol: string;
  chain: string;
  venue: string;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  score: number;
  change24h: number;
  liquidityUsd: number;
  volume24h: number;
  mode: string;
  reason: string;
  openedAt: number;
  closedAt: number;
};

/** Most recent persisted closes, newest first — powers the Learn history + merged readiness. */
export const getTradeLearningEvents = createServerFn({ method: "POST" })
  .validator((input: { limit?: number; offset?: number }) => ({
    limit: Math.max(1, Math.min(200, Math.floor(Number(input?.limit) || 40))),
    offset: Math.max(0, Math.min(100_000, Math.floor(Number(input?.offset) || 0))),
  }))
  .handler(async ({ data }): Promise<{ events: TradeLearningEvent[]; total: number; source: "neon" | "pglite" }> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      symbol: string;
      chain: string;
      venue: string;
      entry_price: number | string;
      exit_price: number | string;
      qty: number | string;
      pnl: number | string;
      score: number | string;
      change_24h: number | string;
      liquidity_usd: number | string;
      volume_24h: number | string;
      mode: string;
      reason: string;
      opened_at: number | string;
      closed_at: number | string;
    }>`
      SELECT id, symbol, chain, venue, entry_price, exit_price, qty, pnl, score,
        change_24h, liquidity_usd, volume_24h, mode, reason, opened_at, closed_at
      FROM trade_learning_events
      ORDER BY closed_at DESC
      LIMIT ${data.limit} OFFSET ${data.offset}
    `;
    const totals = await sql<{ total: number | string }>`
      SELECT COUNT(*)::INTEGER AS total FROM trade_learning_events
    `;
    return {
      total: Number(totals[0]?.total ?? 0),
      source: dbSource,
      events: rows.map((r) => ({
        id: String(r.id),
        symbol: String(r.symbol),
        chain: String(r.chain),
        venue: String(r.venue),
        entryPrice: Number(r.entry_price),
        exitPrice: Number(r.exit_price),
        qty: Number(r.qty),
        pnl: Number(r.pnl),
        score: Number(r.score),
        change24h: Number(r.change_24h),
        liquidityUsd: Number(r.liquidity_usd),
        volume24h: Number(r.volume_24h),
        mode: String(r.mode),
        reason: String(r.reason),
        openedAt: Number(r.opened_at),
        closedAt: Number(r.closed_at),
      })),
    };
  });
