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
  if (!row) throw new Error("Trade learning state has not been initialized by the database migration.");
  return learningState(row);
});
