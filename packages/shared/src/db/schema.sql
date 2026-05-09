-- Engine state snapshot (single row, updated every cycle)
CREATE TABLE IF NOT EXISTS engine_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'stopped',
  cycle_count INTEGER NOT NULL DEFAULT 0,
  last_cycle_at TEXT,
  total_pnl_usd REAL NOT NULL DEFAULT 0.0,
  loss_today_usd REAL NOT NULL DEFAULT 0.0,
  loss_reset_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Filtered tokens currently in the watchlist
CREATE TABLE IF NOT EXISTS watched_tokens (
  mint TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  icon_url TEXT,
  organic_score INTEGER NOT NULL,
  is_sus INTEGER NOT NULL DEFAULT 0,
  mint_authority_disabled INTEGER NOT NULL DEFAULT 1,
  top_holder_concentration REAL,
  current_price_usd REAL,
  price_updated_at TEXT,
  volatility_flag INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every trade attempt (success or failure)
CREATE TABLE IF NOT EXISTS trade_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  input_mint TEXT,
  output_mint TEXT,
  input_amount TEXT,
  output_amount TEXT,
  profit_usd REAL,
  tx_signature TEXT,
  compute_units INTEGER,
  error_code TEXT,
  error_message TEXT,
  latency_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Active OTOCO orders
CREATE TABLE IF NOT EXISTS otoco_orders (
  id TEXT PRIMARY KEY,
  input_mint TEXT NOT NULL,
  output_mint TEXT NOT NULL,
  trigger_price_usd REAL NOT NULL,
  tp_price_usd REAL NOT NULL,
  sl_price_usd REAL NOT NULL,
  sl_slippage_bps INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Prediction market positions
CREATE TABLE IF NOT EXISTS prediction_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id TEXT NOT NULL,
  event_title TEXT NOT NULL,
  is_yes INTEGER NOT NULL,
  deposit_amount INTEGER NOT NULL,
  deposit_mint TEXT NOT NULL,
  current_odds REAL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DCA schedules
CREATE TABLE IF NOT EXISTS dca_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  input_mint TEXT NOT NULL,
  output_mint TEXT NOT NULL,
  output_symbol TEXT NOT NULL,
  amount_per_cycle TEXT NOT NULL,
  interval TEXT NOT NULL,
  total_cycles INTEGER NOT NULL,
  completed_cycles INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Real-time execution log stream (ringbuffer — keep last 1000)
CREATE TABLE IF NOT EXISTS execution_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  module TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Trigger to keep execution_log at max 1000 rows
CREATE TRIGGER IF NOT EXISTS trim_execution_log
AFTER INSERT ON execution_log
BEGIN
  DELETE FROM execution_log WHERE id <= (
    SELECT id FROM execution_log ORDER BY id DESC LIMIT 1 OFFSET 1000
  );
END;

-- API metrics
CREATE TABLE IF NOT EXISTS api_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  rate_limited INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
