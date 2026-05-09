import * as fs from 'node:fs';
import * as path from 'node:path';
import { base58 } from './base58.js';

export interface EngineConfig {
  solanaRpcUrl: string;
  privateKey: string;
  heliusApiKey: string;
  heliusSenderUrl: string;
  jupiterApiKey: string;
  jupiterApiBase: string;
  nodeEnv: string;
  logLevel: string;
  dashboardPort: number;
  enginePollIntervalMs: number;
  dbPath: string;
  volatilityThresholdStddev: number;
  minOrganicScore: number;
  maxPriceBatchSize: number;
  rateLimitRps: number;
  flashloanAsset: string;
  slSlippageBps: number;
  maxLossPer24hUsd: number;
  circuitBreakerThreshold: number;
}

interface ValidationWarning {
  field: string;
  message: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return fallback;
  }
  return value;
}

function validatePrivateKey(key: string): void {
  let decoded: Uint8Array;
  try {
    decoded = base58.decode(key);
  } catch {
    throw new Error('PRIVATE_KEY is not valid base58');
  }
  if (decoded.length !== 64) {
    throw new Error(`PRIVATE_KEY must decode to exactly 64 bytes, got ${decoded.length}`);
  }
}

function validateUrl(value: string, name: string): void {
  if (!value.startsWith('https://')) {
    throw new Error(`${name} must start with https://, got: ${value}`);
  }
}

function validatePositiveFloat(value: string, name: string): number {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) {
    throw new Error(`${name} must be a positive number, got: ${value}`);
  }
  return num;
}

function validateIntRange(value: string, name: string, min: number, max: number): number {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < min || num > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}, got: ${value}`);
  }
  return num;
}

function validatePositiveInt(value: string, name: string): number {
  const num = parseInt(value, 10);
  if (isNaN(num) || num <= 0) {
    throw new Error(`${name} must be a positive integer, got: ${value}`);
  }
  return num;
}

export function loadConfig(): { config: EngineConfig; warnings: ValidationWarning[] } {
  const warnings: ValidationWarning[] = [];

  const privateKey = requireEnv('PRIVATE_KEY');
  validatePrivateKey(privateKey);

  const solanaRpcUrl = requireEnv('SOLANA_RPC_URL');
  validateUrl(solanaRpcUrl, 'SOLANA_RPC_URL');

  const heliusApiKey = requireEnv('HELIUS_API_KEY');
  const heliusSenderUrl = requireEnv('HELIUS_SENDER_URL');

  const jupiterApiKey = optionalEnv('JUPITER_API_KEY', '');
  if (jupiterApiKey === '') {
    warnings.push({
      field: 'JUPITER_API_KEY',
      message: 'JUPITER_API_KEY is empty — falling back to keyless mode (0.5 RPS)',
    });
  }

  const jupiterApiBase = optionalEnv('JUPITER_API_BASE', 'https://api.jup.ag');

  const dbPath = optionalEnv('DB_PATH', './data/engine.sqlite');
  const dbDir = path.dirname(path.resolve(dbPath));
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const volatilityThresholdStddev = validatePositiveFloat(
    optionalEnv('VOLATILITY_THRESHOLD_STDDEV', '2.0'),
    'VOLATILITY_THRESHOLD_STDDEV',
  );

  const minOrganicScore = validateIntRange(
    optionalEnv('MIN_ORGANIC_SCORE', '60'),
    'MIN_ORGANIC_SCORE',
    0,
    100,
  );

  const maxPriceBatchSize = validatePositiveInt(
    optionalEnv('MAX_PRICE_BATCH_SIZE', '50'),
    'MAX_PRICE_BATCH_SIZE',
  );

  const rateLimitRps = validatePositiveFloat(
    optionalEnv('RATE_LIMIT_RPS', '1'),
    'RATE_LIMIT_RPS',
  );

  const slSlippageBps = validatePositiveInt(
    optionalEnv('SL_SLIPPAGE_BPS', '300'),
    'SL_SLIPPAGE_BPS',
  );

  if (slSlippageBps > 500) {
    warnings.push({
      field: 'SL_SLIPPAGE_BPS',
      message: `SL_SLIPPAGE_BPS is ${slSlippageBps} (> 500). High slippage increases stop-loss execution risk.`,
    });
  }

  const maxLossPer24hUsd = validatePositiveFloat(
    optionalEnv('MAX_LOSS_PER_24H_USD', '5'),
    'MAX_LOSS_PER_24H_USD',
  );

  const circuitBreakerThreshold = validatePositiveInt(
    optionalEnv('CIRCUIT_BREAKER_THRESHOLD', '3'),
    'CIRCUIT_BREAKER_THRESHOLD',
  );

  const config: EngineConfig = {
    solanaRpcUrl,
    privateKey,
    heliusApiKey,
    heliusSenderUrl,
    jupiterApiKey,
    jupiterApiBase,
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    logLevel: optionalEnv('LOG_LEVEL', 'debug'),
    dashboardPort: parseInt(optionalEnv('DASHBOARD_PORT', '3000'), 10),
    enginePollIntervalMs: parseInt(optionalEnv('ENGINE_POLL_INTERVAL_MS', '5000'), 10),
    dbPath,
    volatilityThresholdStddev,
    minOrganicScore,
    maxPriceBatchSize,
    rateLimitRps,
    flashloanAsset: optionalEnv('FLASHLOAN_ASSET', 'USDC'),
    slSlippageBps,
    maxLossPer24hUsd,
    circuitBreakerThreshold,
  };

  return { config, warnings };
}
