import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  EngineStateRow,
  WatchedTokenRow,
  TradeLogRow,
  OtocoOrderRow,
  PredictionPositionRow,
  DcaScheduleRow,
  ExecutionLogRow,
  ApiMetricRow,
} from '../types/database.js';

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');

export function initializeDatabase(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  return db;
}

// ── Engine State ──

export function getEngineState(db: Database.Database): EngineStateRow | undefined {
  return db.prepare('SELECT * FROM engine_state WHERE id = 1').get() as EngineStateRow | undefined;
}

export function upsertEngineState(
  db: Database.Database,
  state: Omit<EngineStateRow, 'id'>
): void {
  db.prepare(`
    INSERT INTO engine_state (id, status, cycle_count, last_cycle_at, total_pnl_usd, loss_today_usd, loss_reset_at, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      cycle_count = excluded.cycle_count,
      last_cycle_at = excluded.last_cycle_at,
      total_pnl_usd = excluded.total_pnl_usd,
      loss_today_usd = excluded.loss_today_usd,
      loss_reset_at = excluded.loss_reset_at,
      updated_at = datetime('now')
  `).run(
    state.status,
    state.cycle_count,
    state.last_cycle_at,
    state.total_pnl_usd,
    state.loss_today_usd,
    state.loss_reset_at,
  );
}

// ── Watched Tokens ──

export function getWatchedTokens(db: Database.Database): WatchedTokenRow[] {
  return db.prepare('SELECT * FROM watched_tokens ORDER BY organic_score DESC').all() as WatchedTokenRow[];
}

export function upsertWatchedToken(db: Database.Database, token: WatchedTokenRow): void {
  db.prepare(`
    INSERT INTO watched_tokens (mint, symbol, name, icon_url, organic_score, is_sus, mint_authority_disabled, top_holder_concentration, current_price_usd, price_updated_at, volatility_flag, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(mint) DO UPDATE SET
      symbol = excluded.symbol,
      name = excluded.name,
      icon_url = excluded.icon_url,
      organic_score = excluded.organic_score,
      is_sus = excluded.is_sus,
      mint_authority_disabled = excluded.mint_authority_disabled,
      top_holder_concentration = excluded.top_holder_concentration,
      current_price_usd = excluded.current_price_usd,
      price_updated_at = excluded.price_updated_at,
      volatility_flag = excluded.volatility_flag,
      updated_at = datetime('now')
  `).run(
    token.mint,
    token.symbol,
    token.name,
    token.icon_url,
    token.organic_score,
    token.is_sus,
    token.mint_authority_disabled,
    token.top_holder_concentration,
    token.current_price_usd,
    token.price_updated_at,
    token.volatility_flag,
  );
}

export function deleteWatchedToken(db: Database.Database, mint: string): void {
  db.prepare('DELETE FROM watched_tokens WHERE mint = ?').run(mint);
}

// ── Trade Logs ──

export function getTradeLogs(db: Database.Database, limit = 50, offset = 0): TradeLogRow[] {
  return db.prepare('SELECT * FROM trade_logs ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset) as TradeLogRow[];
}

export function insertTradeLog(
  db: Database.Database,
  log: Omit<TradeLogRow, 'id' | 'created_at'>
): number {
  const result = db.prepare(`
    INSERT INTO trade_logs (type, status, input_mint, output_mint, input_amount, output_amount, profit_usd, tx_signature, compute_units, error_code, error_message, latency_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    log.type,
    log.status,
    log.input_mint,
    log.output_mint,
    log.input_amount,
    log.output_amount,
    log.profit_usd,
    log.tx_signature,
    log.compute_units,
    log.error_code,
    log.error_message,
    log.latency_ms,
  );
  return Number(result.lastInsertRowid);
}

// ── OTOCO Orders ──

export function getOtocoOrders(db: Database.Database, status?: string): OtocoOrderRow[] {
  if (status) {
    return db.prepare('SELECT * FROM otoco_orders WHERE status = ? ORDER BY created_at DESC').all(status) as OtocoOrderRow[];
  }
  return db.prepare('SELECT * FROM otoco_orders ORDER BY created_at DESC').all() as OtocoOrderRow[];
}

export function insertOtocoOrder(db: Database.Database, order: Omit<OtocoOrderRow, 'created_at'>): void {
  db.prepare(`
    INSERT INTO otoco_orders (id, input_mint, output_mint, trigger_price_usd, tp_price_usd, sl_price_usd, sl_slippage_bps, status, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order.id,
    order.input_mint,
    order.output_mint,
    order.trigger_price_usd,
    order.tp_price_usd,
    order.sl_price_usd,
    order.sl_slippage_bps,
    order.status,
    order.expires_at,
  );
}

export function updateOtocoOrderStatus(db: Database.Database, id: string, status: string): void {
  db.prepare('UPDATE otoco_orders SET status = ? WHERE id = ?').run(status, id);
}

// ── Prediction Positions ──

export function getPredictionPositions(db: Database.Database, status?: string): PredictionPositionRow[] {
  if (status) {
    return db.prepare('SELECT * FROM prediction_positions WHERE status = ? ORDER BY created_at DESC').all(status) as PredictionPositionRow[];
  }
  return db.prepare('SELECT * FROM prediction_positions ORDER BY created_at DESC').all() as PredictionPositionRow[];
}

export function insertPredictionPosition(
  db: Database.Database,
  position: Omit<PredictionPositionRow, 'id' | 'created_at'>
): number {
  const result = db.prepare(`
    INSERT INTO prediction_positions (market_id, event_title, is_yes, deposit_amount, deposit_mint, current_odds, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    position.market_id,
    position.event_title,
    position.is_yes,
    position.deposit_amount,
    position.deposit_mint,
    position.current_odds,
    position.status,
  );
  return Number(result.lastInsertRowid);
}

// ── DCA Schedules ──

export function getDcaSchedules(db: Database.Database, status?: string): DcaScheduleRow[] {
  if (status) {
    return db.prepare('SELECT * FROM dca_schedules WHERE status = ? ORDER BY created_at DESC').all(status) as DcaScheduleRow[];
  }
  return db.prepare('SELECT * FROM dca_schedules ORDER BY created_at DESC').all() as DcaScheduleRow[];
}

export function insertDcaSchedule(
  db: Database.Database,
  schedule: Omit<DcaScheduleRow, 'id' | 'created_at'>
): number {
  const result = db.prepare(`
    INSERT INTO dca_schedules (input_mint, output_mint, output_symbol, amount_per_cycle, interval, total_cycles, completed_cycles, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    schedule.input_mint,
    schedule.output_mint,
    schedule.output_symbol,
    schedule.amount_per_cycle,
    schedule.interval,
    schedule.total_cycles,
    schedule.completed_cycles,
    schedule.status,
  );
  return Number(result.lastInsertRowid);
}

// ── Execution Log ──

export function getExecutionLogs(db: Database.Database, limit = 100): ExecutionLogRow[] {
  return db.prepare('SELECT * FROM execution_log ORDER BY id DESC LIMIT ?').all(limit) as ExecutionLogRow[];
}

export function insertExecutionLog(
  db: Database.Database,
  entry: Omit<ExecutionLogRow, 'id' | 'created_at'>
): void {
  db.prepare(`
    INSERT INTO execution_log (level, module, message, data)
    VALUES (?, ?, ?, ?)
  `).run(entry.level, entry.module, entry.message, entry.data);
}

// ── API Metrics ──

export function getApiMetrics(db: Database.Database, limit = 100): ApiMetricRow[] {
  return db.prepare('SELECT * FROM api_metrics ORDER BY id DESC LIMIT ?').all(limit) as ApiMetricRow[];
}

export function insertApiMetric(
  db: Database.Database,
  metric: Omit<ApiMetricRow, 'id' | 'created_at'>
): void {
  db.prepare(`
    INSERT INTO api_metrics (endpoint, status_code, latency_ms, rate_limited)
    VALUES (?, ?, ?, ?)
  `).run(metric.endpoint, metric.status_code, metric.latency_ms, metric.rate_limited);
}
