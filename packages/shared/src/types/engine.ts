export type EngineStatus = 'running' | 'paused' | 'stopped' | 'error';

export interface EngineState {
  id: 1;
  status: EngineStatus;
  cycleCount: number;
  lastCycleAt: string | null;
  totalPnlUsd: number;
  lossTodayUsd: number;
  lossResetAt: string;
  updatedAt: string;
}

export type TradeType = 'flashloan_arb' | 'otoco' | 'prediction' | 'dca';
export type TradeStatus = 'simulated' | 'broadcast' | 'confirmed' | 'failed' | 'reverted';

export interface TradeLog {
  id: number;
  type: TradeType;
  status: TradeStatus;
  inputMint: string | null;
  outputMint: string | null;
  inputAmount: string | null;
  outputAmount: string | null;
  profitUsd: number | null;
  txSignature: string | null;
  computeUnits: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Signal {
  mint: string;
  symbol: string;
  organicScore: number;
  currentPriceUsd: number;
  volatilityFlag: boolean;
  timestamp: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
}
