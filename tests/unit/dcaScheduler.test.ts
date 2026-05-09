import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { initializeDatabase, upsertWatchedToken } from '@artomik/shared';
import type { WatchedTokenRow } from '@artomik/shared';

vi.mock('../../apps/engine/src/infra/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { DcaScheduler } from '../../apps/engine/src/hedging/dcaScheduler.js';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-dca.sqlite');

let db: Database.Database;

function insertToken(mint: string, symbol: string, organicScore: number): void {
  const row: WatchedTokenRow = {
    mint, symbol, name: symbol, organic_score: organicScore, is_sus: 0,
    mint_authority_disabled: 1, top_holder_concentration: 0.1,
    current_price_usd: 100, price_updated_at: new Date().toISOString(),
    volatility_flag: 0, updated_at: new Date().toISOString(),
  };
  upsertWatchedToken(db, row);
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

describe('DcaScheduler', () => {
  it('rejects if total amount < $100 minimum', async () => {
    const client = { get: vi.fn(), post: vi.fn() } as never;
    const scheduler = new DcaScheduler(client, db);

    const results = await scheduler.createDcaOrders({
      inputMint: 'USDC_MINT',
      totalAmount: '50',
      interval: 'daily',
      totalCycles: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.success).toBe(false);
    expect(results[0]!.error).toContain('100');
  });

  it('splits amount equally across 3 target tokens', async () => {
    insertToken('mint1', 'TOKEN1', 90);
    insertToken('mint2', 'TOKEN2', 85);
    insertToken('mint3', 'TOKEN3', 80);

    const postMock = vi.fn().mockResolvedValue({ tx: 'tx-data', orderId: 'ord-1' });
    const client = { get: vi.fn(), post: postMock } as never;
    const scheduler = new DcaScheduler(client, db);

    const results = await scheduler.createDcaOrders({
      inputMint: 'USDC_MINT',
      totalAmount: '300',
      interval: 'daily',
      totalCycles: 10,
    });

    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);
    expect(postMock).toHaveBeenCalledTimes(3);
  });

  it('uses correct endpoint path /recurring/v1/createOrder', async () => {
    insertToken('mint1', 'T1', 90);

    const postMock = vi.fn().mockResolvedValue({ tx: 'data' });
    const client = { get: vi.fn(), post: postMock } as never;
    const scheduler = new DcaScheduler(client, db);

    await scheduler.createDcaOrders({
      inputMint: 'USDC',
      totalAmount: '100',
      interval: 'daily',
      totalCycles: 5,
      targetTokens: ['mint1'],
    });

    expect(postMock.mock.calls[0][0]).toBe('/recurring/v1/createOrder');
  });

  it('validates minimum amount statically', () => {
    expect(DcaScheduler.validateMinimumAmount(50)).toContain('100');
    expect(DcaScheduler.validateMinimumAmount(100)).toBeNull();
    expect(DcaScheduler.validateMinimumAmount(500)).toBeNull();
  });

  it('handles API failure gracefully', async () => {
    insertToken('mint1', 'T1', 90);

    const postMock = vi.fn().mockRejectedValue(new Error('API error'));
    const client = { get: vi.fn(), post: postMock } as never;
    const scheduler = new DcaScheduler(client, db);

    const results = await scheduler.createDcaOrders({
      inputMint: 'USDC',
      totalAmount: '100',
      interval: 'daily',
      totalCycles: 5,
      targetTokens: ['mint1'],
    });

    expect(results[0]!.success).toBe(false);
    expect(results[0]!.error).toContain('API error');
  });
});
