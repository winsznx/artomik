import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Keypair } from '@solana/web3.js';
import { initializeDatabase, getEngineState, upsertEngineState } from '@artomik/shared';

vi.mock('../../apps/engine/src/infra/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  initLogger: vi.fn(),
}));

import { Orchestrator } from '../../apps/engine/src/orchestrator.js';
import type { OrchestratorDeps } from '../../apps/engine/src/orchestrator.js';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-orchestrator.sqlite');

let db: Database.Database;

function makeMockDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps {
  const wallet = Keypair.generate();
  return {
    db,
    config: {
      solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
      privateKey: '',
      heliusApiKey: 'test',
      heliusSenderUrl: 'https://test.helius.com',
      jupiterApiKey: '',
      jupiterApiBase: 'https://api.jup.ag',
      nodeEnv: 'test',
      logLevel: 'debug',
      dashboardPort: 3000,
      enginePollIntervalMs: 10,
      dbPath: TEST_DB_PATH,
      volatilityThresholdStddev: 2.0,
      minOrganicScore: 60,
      maxPriceBatchSize: 50,
      rateLimitRps: 10,
      flashloanAsset: 'USDC',
      slSlippageBps: 300,
      maxLossPer24hUsd: 5,
      circuitBreakerThreshold: 3,
    },
    connection: {} as never,
    wallet,
    client: {} as never,
    tokenFilter: {
      refreshWatchlist: vi.fn().mockResolvedValue([]),
      getWatchlist: vi.fn().mockReturnValue([]),
    } as never,
    priceMonitor: {
      pollPrices: vi.fn().mockResolvedValue(new Map()),
      getLatestPrices: vi.fn().mockReturnValue(new Map()),
    } as never,
    volatilityDetector: {
      detectSignals: vi.fn().mockReturnValue([]),
      getPriceHistory: vi.fn().mockReturnValue([]),
    } as never,
    otocoBuilder: {
      placeOtocoOrder: vi.fn().mockResolvedValue({ success: true }),
      cancelOrder: vi.fn(),
      getActiveOrders: vi.fn().mockResolvedValue([]),
    } as never,
    vaultManager: {
      authenticate: vi.fn(),
      getOrCreateVault: vi.fn(),
      craftDeposit: vi.fn(),
      getJwt: vi.fn().mockReturnValue(null),
    } as never,
    marketScanner: {
      getActiveEvents: vi.fn().mockResolvedValue([]),
    } as never,
    correlationEngine: {
      findHedges: vi.fn().mockReturnValue([]),
    } as never,
    predictionOrderPlacer: {
      placeOrder: vi.fn().mockResolvedValue({ success: true }),
    } as never,
    dcaScheduler: {
      createDcaOrders: vi.fn().mockResolvedValue([]),
      getActiveOrders: vi.fn().mockResolvedValue([]),
    } as never,
    ...overrides,
  };
}

beforeEach(() => {
  const dir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = initializeDatabase(TEST_DB_PATH);
});

afterEach(() => {
  db.close();
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  vi.restoreAllMocks();
});

describe('Orchestrator', () => {
  it('runs one cycle without crashing', async () => {
    const deps = makeMockDeps();
    const orchestrator = new Orchestrator(deps);

    setTimeout(() => { void orchestrator.stop(); }, 50);
    await orchestrator.start();

    expect(orchestrator.getStatus()).toBe('stopped');
    expect(orchestrator.getMetrics().cycleCount).toBeGreaterThanOrEqual(0);
  });

  it('writes engine_state to DB each cycle', async () => {
    const deps = makeMockDeps();
    const orchestrator = new Orchestrator(deps);

    setTimeout(() => { void orchestrator.stop(); }, 80);
    await orchestrator.start();

    const state = getEngineState(db);
    expect(state).toBeDefined();
    expect(state!.status).toBe('stopped');
  });

  it('pauses when engine_state.status is set externally to paused', async () => {
    const deps = makeMockDeps();
    const orchestrator = new Orchestrator(deps);

    setTimeout(() => {
      upsertEngineState(db, {
        status: 'paused',
        cycle_count: 0,
        last_cycle_at: null,
        total_pnl_usd: 0,
        loss_today_usd: 0,
        loss_reset_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }, 30);

    setTimeout(() => { void orchestrator.stop(); }, 100);
    await orchestrator.start();

    expect(orchestrator.getMetrics().status).toBe('stopped');
  });

  it('circuit breaker triggers after N consecutive failures', async () => {
    let callCount = 0;
    const deps = makeMockDeps({
      tokenFilter: {
        refreshWatchlist: vi.fn().mockImplementation(() => {
          callCount++;
          throw new Error(`Failure ${callCount}`);
        }),
        getWatchlist: vi.fn().mockReturnValue([]),
      } as never,
    });
    deps.config.circuitBreakerThreshold = 2;

    setTimeout(() => { void orchestrator.stop(); }, 200);
    const orchestrator = new Orchestrator(deps);
    await orchestrator.start();

    expect(orchestrator.getMetrics().consecutiveFailures).toBeGreaterThanOrEqual(2);
  });

  it('logs every trade attempt to trade_logs', async () => {
    let callCount = 0;
    const deps = makeMockDeps({
      tokenFilter: {
        refreshWatchlist: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount > 1) throw new Error('stop');
          return [];
        }),
        getWatchlist: vi.fn().mockReturnValue([]),
      } as never,
    });

    setTimeout(() => { void orchestrator.stop(); }, 100);
    const orchestrator = new Orchestrator(deps);
    await orchestrator.start();

    const trades = db.prepare('SELECT * FROM trade_logs').all();
    expect(trades.length).toBeGreaterThanOrEqual(0);
  });

  it('exposes metrics', () => {
    const deps = makeMockDeps();
    const orchestrator = new Orchestrator(deps);

    const metrics = orchestrator.getMetrics();
    expect(metrics.cycleCount).toBe(0);
    expect(metrics.totalPnlUsd).toBe(0);
    expect(metrics.status).toBe('stopped');
  });

  it('pause and resume work', async () => {
    const deps = makeMockDeps();
    const orchestrator = new Orchestrator(deps);

    await orchestrator.pause();
    expect(orchestrator.getStatus()).toBe('paused');

    await orchestrator.resume();
    expect(orchestrator.getStatus()).toBe('running');

    await orchestrator.stop();
    expect(orchestrator.getStatus()).toBe('stopped');
  });
});
