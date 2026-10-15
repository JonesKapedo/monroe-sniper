-- Qualifying Trades Only
-- Separate table for trades that meet strict criteria for learning/readiness
-- Both TP (successful) and SL (disciplined) hits count as qualifying

CREATE TABLE IF NOT EXISTS qualifying_trades (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL,
  exit_price DOUBLE PRECISION NOT NULL,
  stop_price DOUBLE PRECISION NOT NULL,
  target_price DOUBLE PRECISION NOT NULL,
  qty DOUBLE PRECISION NOT NULL,
  notional DOUBLE PRECISION NOT NULL,
  pnl DOUBLE PRECISION NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('TARGET', 'STOP')),
  hold_minutes INTEGER NOT NULL,
  risk_reward_planned DOUBLE PRECISION,
  risk_reward_actual DOUBLE PRECISION,
  discipline_score DOUBLE PRECISION DEFAULT 1.0 CHECK (discipline_score >= 0 AND discipline_score <= 1),
  market_regime TEXT,
  strategy_tag TEXT,
  confidence_at_entry DOUBLE PRECISION,
  mode TEXT NOT NULL CHECK (mode IN ('demo', 'live')),
  closed_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qualifying_trades_closed_at_idx
  ON qualifying_trades (closed_at DESC);

CREATE INDEX IF NOT EXISTS qualifying_trades_symbol_idx
  ON qualifying_trades (symbol);

CREATE INDEX IF NOT EXISTS qualifying_trades_reason_idx
  ON qualifying_trades (reason);

CREATE INDEX IF NOT EXISTS qualifying_trades_mode_idx
  ON qualifying_trades (mode);

-- Readiness state (computed from qualifying trades only)
CREATE TABLE IF NOT EXISTS readiness_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  qualifying_trades_count INTEGER DEFAULT 0,
  target_hits INTEGER DEFAULT 0,
  stop_hits INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  profit_factor NUMERIC DEFAULT 1.0,
  max_drawdown_pct NUMERIC DEFAULT 0,
  readiness_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'TRAINING' CHECK (status IN ('TRAINING', 'QUALIFYING', 'PAPER_PROVEN')),
  consecutive_wins INTEGER DEFAULT 0,
  last_computed_at TIMESTAMPTZ DEFAULT now()
);

-- Trade discipline checklist (persisted for transparency)
CREATE TABLE IF NOT EXISTS trade_discipline_checklist (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  met BOOLEAN NOT NULL,
  current_value TEXT,
  required_value TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill migration: populate qualifying_trades from existing trade_learning_events
-- Run once after schema creation. Idempotent: safe to re-run.
DO $$
DECLARE
  rec RECORD;
  total_qualifying INTEGER := 0;
  target_hits INTEGER := 0;
  stop_hits INTEGER := 0;
  rr_planned DOUBLE PRECISION;
  rr_actual DOUBLE PRECISION;
  disc_score DOUBLE PRECISION;
  gross_win DOUBLE PRECISION;
  gross_loss DOUBLE PRECISION;
  computed_pf DOUBLE PRECISION;
  computed_wr DOUBLE PRECISION;
  computed_score INTEGER;
  computed_status TEXT;
BEGIN
  -- Clear existing (idempotent)
  TRUNCATE qualifying_trades;

  -- Migrate from trade_learning_events (schema per 0002: no simulated column)
  FOR rec IN
    SELECT
      id, symbol, entry_price, exit_price, qty, pnl, reason,
      closed_at, opened_at, mode, score
    FROM trade_learning_events
    WHERE reason IN ('TARGET', 'STOP')
      AND entry_price > 0
      AND exit_price > 0
      AND qty > 0
      AND ABS(pnl) >= entry_price * qty * 0.005  -- min 0.5% move
  LOOP
    rr_planned := 2.5;
    disc_score := 1.0;
    IF rec.pnl > 0 THEN
      -- Winner: assume target was hit
      target_hits := target_hits + 1;
      rr_actual := rec.pnl / NULLIF(rec.entry_price * rec.qty, 0);
    ELSE
      -- Stop hit: disciplined exit
      stop_hits := stop_hits + 1;
      rr_actual := ABS(rec.pnl) / NULLIF(rec.entry_price * rec.qty, 0);
    END IF;

    INSERT INTO qualifying_trades (
      id, symbol, entry_price, exit_price, stop_price, target_price,
      qty, notional, pnl, reason, hold_minutes,
      risk_reward_planned, risk_reward_actual, discipline_score,
      market_regime, strategy_tag, confidence_at_entry, mode, closed_at
    ) VALUES (
      rec.id, rec.symbol, rec.entry_price, rec.exit_price,
      rec.entry_price * 0.97,  -- estimated stop
      rec.entry_price * 1.07,  -- estimated target
      rec.qty, rec.entry_price * rec.qty, rec.pnl, rec.reason,
      GREATEST(1, (rec.closed_at - rec.opened_at) / 60000),
      rr_planned, rr_actual, disc_score,
      'unknown', 'migrated', rec.score, rec.mode, rec.closed_at
    ) ON CONFLICT (id) DO NOTHING;

    total_qualifying := total_qualifying + 1;
  END LOOP;

  -- Aggregate from the freshly backfilled rows (valid subqueries)
  SELECT COALESCE(SUM(pnl), 0) INTO gross_win FROM qualifying_trades WHERE pnl > 0;
  SELECT COALESCE(SUM(pnl), 0) INTO gross_loss FROM qualifying_trades WHERE pnl < 0;

  IF total_qualifying > 0 THEN
    computed_wr := (target_hits::NUMERIC / total_qualifying) * 100;
  ELSE
    computed_wr := 0;
  END IF;

  IF gross_loss < 0 THEN
    computed_pf := gross_win / ABS(gross_loss);
  ELSIF gross_win > 0 THEN
    computed_pf := 3.0;
  ELSE
    computed_pf := 1.0;
  END IF;

  IF total_qualifying >= 200 AND (target_hits::NUMERIC / NULLIF(total_qualifying, 0)) >= 0.65 THEN
    computed_score := 85;
    computed_status := 'PAPER_PROVEN';
  ELSIF total_qualifying >= 50 THEN
    computed_score := 60;
    computed_status := 'QUALIFYING';
  ELSE
    computed_score := 30;
    computed_status := 'TRAINING';
  END IF;

  -- Update readiness_state
  INSERT INTO readiness_state (singleton, qualifying_trades_count, target_hits, stop_hits, win_rate, profit_factor, readiness_score, status)
  VALUES (
    TRUE,
    total_qualifying,
    target_hits,
    stop_hits,
    computed_wr,
    computed_pf,
    computed_score,
    computed_status
  )
  ON CONFLICT (singleton) DO UPDATE SET
    qualifying_trades_count = EXCLUDED.qualifying_trades_count,
    target_hits = EXCLUDED.target_hits,
    stop_hits = EXCLUDED.stop_hits,
    win_rate = EXCLUDED.win_rate,
    profit_factor = EXCLUDED.profit_factor,
    readiness_score = EXCLUDED.readiness_score,
    status = EXCLUDED.status,
    last_computed_at = now();

  RAISE NOTICE 'Migrated % qualifying trades: % target hits, % stop hits', total_qualifying, target_hits, stop_hits;
END $$;