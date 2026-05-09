export interface EngineStateRow {
  id: number;
  status: string;
  cycle_count: number;
  last_cycle_at: string | null;
  total_pnl_usd: number;
  loss_today_usd: number;
  loss_reset_at: string;
  updated_at: string;
}

export interface WatchedTokenRow {
  mint: string;
  symbol: string;
  name: string;
  icon_url: string | null;
  organic_score: number;
  is_sus: number;
  mint_authority_disabled: number;
  top_holder_concentration: number | null;
  current_price_usd: number | null;
  price_updated_at: string | null;
  volatility_flag: number;
  updated_at: string;
}

export interface TradeLogRow {
  id: number;
  type: string;
  status: string;
  input_mint: string | null;
  output_mint: string | null;
  input_amount: string | null;
  output_amount: string | null;
  profit_usd: number | null;
  tx_signature: string | null;
  compute_units: number | null;
  error_code: string | null;
  error_message: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface OtocoOrderRow {
  id: string;
  input_mint: string;
  output_mint: string;
  trigger_price_usd: number;
  tp_price_usd: number;
  sl_price_usd: number;
  sl_slippage_bps: number;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface PredictionPositionRow {
  id: number;
  market_id: string;
  event_title: string;
  is_yes: number;
  deposit_amount: number;
  deposit_mint: string;
  current_odds: number | null;
  status: string;
  created_at: string;
}

export interface DcaScheduleRow {
  id: number;
  input_mint: string;
  output_mint: string;
  output_symbol: string;
  amount_per_cycle: string;
  interval: string;
  total_cycles: number;
  completed_cycles: number;
  status: string;
  created_at: string;
}

export interface ExecutionLogRow {
  id: number;
  level: string;
  module: string;
  message: string;
  data: string | null;
  created_at: string;
}

export interface ApiMetricRow {
  id: number;
  endpoint: string;
  status_code: number;
  latency_ms: number;
  rate_limited: number;
  created_at: string;
}
