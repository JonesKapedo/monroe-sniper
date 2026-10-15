-- Purge tainted learning history (operator-approved).
-- A cross-venue marking defect manufactured phantom wins (entries priced on
-- one feed, exits marked on another asset's quote). Every persisted close,
-- readiness aggregate and adaptive threshold derived from that period is
-- untrustworthy, so learning restarts from zero. Open positions and cash are
-- untouched — only history and learned state are cleared. Idempotent.
TRUNCATE trade_learning_events;
TRUNCATE qualifying_trades;

INSERT INTO trade_learning_state (singleton, seen, wins, losses, realized, min_score)
VALUES (TRUE, 0, 0, 0, 0, 62)
ON CONFLICT (singleton) DO UPDATE SET
  seen = 0,
  wins = 0,
  losses = 0,
  realized = 0,
  min_score = 62;

INSERT INTO readiness_state (
  singleton, qualifying_trades_count, target_hits, stop_hits, win_rate,
  profit_factor, readiness_score, status
)
VALUES (TRUE, 0, 0, 0, 0, 1.0, 0, 'TRAINING')
ON CONFLICT (singleton) DO UPDATE SET
  qualifying_trades_count = 0,
  target_hits = 0,
  stop_hits = 0,
  win_rate = 0,
  profit_factor = 1.0,
  readiness_score = 0,
  status = 'TRAINING',
  last_computed_at = now();

DELETE FROM trade_discipline_checklist;
