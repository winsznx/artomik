import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { initializeDatabase, upsertWatchedToken } from '@artomik/shared';
import type { WatchedTokenRow } from '@artomik/shared';

vi.mock('../../apps/engine/src/infra/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { PriceMonitor } from '../../apps/engine/src/intelligence/priceMonitor.js';
import { logger } from '../../apps/engine/src/infra/logger.js';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-price-monitor.sqlite');

let db: Database.Database;
let monitor: PriceMonitor;
const mockClient = { get: vi.fn(), post: vi.fn() } as never;

function insertToken(mint: string, symbol: string): void {
  const row: WatchedTokenRow = {
    mint, symbol, name: symbol, organic_score: 80, is_sus: 0,
    mint_authority_disabled: 1, top_holder_concentration: 0.1,
    current_price_usd: null, price_updated_at: null,
    volatility_flag: 0, updated_at: new Date().toISOString(),
  };
  upsertWatchedToken(db, row);
}

beforeEach(() => {
  const dir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = initializeDatabase(TEST_DB_PATH);
  monitor = new PriceMonitor({ client: mockClient, db, maxBatchSize: 50, rateLimitRps: 1 });
});

afterEach(() => {
  db.close();
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  vi.restoreAllMocks();
});

describe('PriceMonitor', () => {
  it('returns prices for all requested mints', async () => {
    (mockClient as { get: ReturnType<typeof vi.fn> }).get = vi.fn().mockResolvedValueOnce({
      mint1: { usdPrice: 100, createdAt: '', liquidity: 0, blockId: 0, decimals: 9, priceChange24h: 0 },
      mint2: { usdPrice: 200, createdAt: '', liquidity: 0, blockId: 0, decimals: 9, priceChange24h: 0 },
    });

    insertToken('mint1', 'T1');
    insertToken('mint2', 'T2');

    const prices = await monitor.pollPrices(['mint1', 'mint2']);
    expect(prices.size).toBe(2);
    expect(prices.get('mint1')).toBe(100);
    expect(prices.get('mint2')).toBe(200);
  });

  it('handles 43-of-50 price response without crash (silent drops)', async () => {
    const mints = Array.from({ length: 50 }, (_, i) => `mint_${i}`);
    const response: Record<string, unknown> = {};
    for (let i = 0; i < 43; i++) {
      response[`mint_${i}`] = { usdPrice: i + 1, createdAt: '', liquidity: 0, blockId: 0, decimals: 9, priceChange24h: 0 };
    }

    (mockClient as { get: ReturnType<typeof vi.fn> }).get = vi.fn().mockResolvedValueOnce(response);

    for (const mint of mints) {
      insertToken(mint, mint);
    }

    const prices = await monitor.pollPrices(mints);
    expect(prices.size).toBe(43);

    expect(vi.mocked(logger.warn)).toHaveBeenCalled();
    const warnCalls = vi.mocked(logger.warn).mock.calls;
    const silentDropCalls = warnCalls.filter(
      call => (call[0] as { message: string }).message.includes('Silent drop')
    );
    expect(silentDropCalls.length).toBe(7);
  });

  it('returns empty map for empty mints array', async () => {
    const prices = await monitor.pollPrices([]);
    expect(prices.size).toBe(0);
  });

  it('handles API failure gracefully', async () => {
    (mockClient as { get: ReturnType<typeof vi.fn> }).get = vi.fn().mockRejectedValueOnce(new Error('network'));

    const prices = await monitor.pollPrices(['mint1']);
    expect(prices.size).toBe(0);
  });

  it('persists prices to watched_tokens table', async () => {
    insertToken('mint_x', 'TX');

    (mockClient as { get: ReturnType<typeof vi.fn> }).get = vi.fn().mockResolvedValueOnce({
      mint_x: { usdPrice: 42.5, createdAt: '', liquidity: 0, blockId: 0, decimals: 9, priceChange24h: 0 },
    });

    await monitor.pollPrices(['mint_x']);

    const row = db.prepare('SELECT current_price_usd FROM watched_tokens WHERE mint = ?').get('mint_x') as { current_price_usd: number } | undefined;
    expect(row?.current_price_usd).toBe(42.5);
  });

  it('caches latest prices', async () => {
    (mockClient as { get: ReturnType<typeof vi.fn> }).get = vi.fn().mockResolvedValueOnce({
      mint1: { usdPrice: 99, createdAt: '', liquidity: 0, blockId: 0, decimals: 9, priceChange24h: 0 },
    });

    await monitor.pollPrices(['mint1']);
    const cached = monitor.getLatestPrices();
    expect(cached.get('mint1')).toBe(99);
  });

  it('batches requests when mints > maxBatchSize', async () => {
    const smallMonitor = new PriceMonitor({ client: mockClient, db, maxBatchSize: 2, rateLimitRps: 100 });
    const mints = ['m1', 'm2', 'm3'];

    const getMock = vi.fn()
      .mockResolvedValueOnce({ m1: { usdPrice: 1, createdAt: '', liquidity: 0, blockId: 0, decimals: 9, priceChange24h: 0 }, m2: { usdPrice: 2, createdAt: '', liquidity: 0, blockId: 0, decimals: 9, priceChange24h: 0 } })
      .mockResolvedValueOnce({ m3: { usdPrice: 3, createdAt: '', liquidity: 0, blockId: 0, decimals: 9, priceChange24h: 0 } });
    (smallMonitor as unknown as { client: { get: ReturnType<typeof vi.fn> } }).client = { get: getMock } as never;

    // Need to recreate since client is readonly — just test the chunking logic
    const monitor2 = new PriceMonitor({ client: { get: getMock, post: vi.fn() } as never, db, maxBatchSize: 2, rateLimitRps: 100 });
    const prices = await monitor2.pollPrices(mints);
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(prices.size).toBe(3);
  });
});
