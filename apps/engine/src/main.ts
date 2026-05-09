import * as path from 'node:path';
import { Connection, Keypair } from '@solana/web3.js';
import { config as loadEnv } from 'dotenv';
import { initializeDatabase, upsertEngineState } from '@artomik/shared';
import { loadConfig } from './infra/config.js';
import { initLogger, logger } from './infra/logger.js';
import { JupiterClient } from './infra/jupiterClient.js';
import { TokenFilter } from './intelligence/tokenFilter.js';
import { PriceMonitor } from './intelligence/priceMonitor.js';
import { VolatilityDetector } from './intelligence/volatilityDetector.js';
import { VaultManager } from './hedging/vaultManager.js';
import { OtocoBuilder } from './hedging/otocoBuilder.js';
import { MarketScanner } from './hedging/marketScanner.js';
import { CorrelationEngine } from './hedging/correlationEngine.js';
import { PredictionOrderPlacer } from './hedging/predictionOrderPlacer.js';
import { DcaScheduler } from './hedging/dcaScheduler.js';
import { Orchestrator } from './orchestrator.js';
import { base58 } from './infra/base58.js';

loadEnv({ path: path.resolve(__dirname, '../../../.env') });

async function main(): Promise<void> {
  logger.info({ module: 'main', message: 'Artomik Engine starting...' });

  let config;
  try {
    const result = loadConfig();
    config = result.config;
    for (const warning of result.warnings) {
      logger.warn({ module: 'config', message: warning.message, data: { field: warning.field } });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ module: 'config', message: `Config validation failed: ${message}` });
    process.exit(1);
  }

  const dbPath = path.resolve(config.dbPath);
  const db = initializeDatabase(dbPath);
  initLogger(db, config.logLevel as 'debug' | 'info' | 'warn' | 'error');

  logger.info({ module: 'main', message: 'Database initialized', data: { path: dbPath } });

  upsertEngineState(db, {
    status: 'stopped',
    cycle_count: 0,
    last_cycle_at: null,
    total_pnl_usd: 0,
    loss_today_usd: 0,
    loss_reset_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const secretKey = base58.decode(config.privateKey);
  const wallet = Keypair.fromSecretKey(secretKey);
  logger.info({ module: 'main', message: 'Wallet loaded', data: { publicKey: wallet.publicKey.toBase58() } });

  const connection = new Connection(config.solanaRpcUrl);

  const client = new JupiterClient({
    baseUrl: config.jupiterApiBase,
    apiKey: config.jupiterApiKey,
    rps: config.rateLimitRps,
    db,
  });

  const tokenFilter = new TokenFilter({
    client,
    db,
    minOrganicScore: config.minOrganicScore,
    maxTopHoldersPercentage: 0.50,
  });

  const priceMonitor = new PriceMonitor({
    client,
    db,
    maxBatchSize: config.maxPriceBatchSize,
    rateLimitRps: config.rateLimitRps,
  });

  const volatilityDetector = new VolatilityDetector({
    db,
    thresholdStddev: config.volatilityThresholdStddev,
    windowSize: 20,
  });

  const vaultManager = new VaultManager(client, wallet);
  const otocoBuilder = new OtocoBuilder(client, vaultManager, config.slSlippageBps);
  const marketScanner = new MarketScanner(client);
  const correlationEngine = new CorrelationEngine();
  const predictionOrderPlacer = new PredictionOrderPlacer(client);
  const dcaScheduler = new DcaScheduler(client, db);

  const orchestrator = new Orchestrator({
    db,
    config,
    connection,
    wallet,
    client,
    tokenFilter,
    priceMonitor,
    volatilityDetector,
    otocoBuilder,
    vaultManager,
    marketScanner,
    correlationEngine,
    predictionOrderPlacer,
    dcaScheduler,
  });

  const shutdown = async () => {
    logger.info({ module: 'main', message: 'Shutdown signal received' });
    await orchestrator.stop();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });

  logger.info({ module: 'main', message: 'Artomik Engine ready — starting orchestrator' });
  await orchestrator.start();
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error({ module: 'main', message: `Fatal error: ${message}` });
  process.exit(1);
});
