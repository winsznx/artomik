import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { TokenInfo } from '@artomik/shared';
import { initializeDatabase, KNOWN_MINTS } from '@artomik/shared';

vi.mock('../../apps/engine/src/infra/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { TokenFilter } from '../../apps/engine/src/intelligence/tokenFilter.js';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-token-filter.sqlite');

function makeToken(overrides: Partial<TokenInfo> = {}): TokenInfo {
  return {
    id: 'TestMint111111111111111111111111111111111111',
    symbol: 'TEST',
    name: 'Test Token',
    decimals: 9,
    icon: null,
    organicScore: 80,
    audit: {
      mintAuthorityDisabled: true,
      freezeAuthorityDisabled: true,
      topHoldersPercentage: 0.2,
      devMints: 0,
    },
    tags: ['verified'],
    usdPrice: 1.0,
    liquidity: 1000000,
    holderCount: 1000,
    ...overrides,
  };
}

let db: Database.Database;
let filter: TokenFilter;

const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
} as never;

beforeEach(() => {
  const dir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = initializeDatabase(TEST_DB_PATH);
  filter = new TokenFilter({
    client: mockClient,
    db,
    minOrganicScore: 60,
    maxTopHoldersPercentage: 0.50,
  });
});

afterEach(() => {
  db.close();
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  vi.restoreAllMocks();
});

describe('TokenFilter', () => {
  it('accepts a valid token', () => {
    const tokens = [makeToken()];
    const { accepted, rejected } = filter.filterTokens(tokens);
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('rejects token with missing audit object', () => {
    const tokens = [makeToken({ audit: null })];
    const { accepted, rejected } = filter.filterTokens(tokens);
    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toContain('missing audit');
  });

  it('rejects token with mint authority enabled', () => {
    const tokens = [makeToken({
      audit: { mintAuthorityDisabled: false, freezeAuthorityDisabled: true, topHoldersPercentage: 0.2, devMints: 0 },
    })];
    const { accepted, rejected } = filter.filterTokens(tokens);
    expect(accepted).toHaveLength(0);
    expect(rejected[0]!.reason).toContain('mint authority');
  });

  it('rejects token with low organic score', () => {
    const tokens = [makeToken({ organicScore: 30 })];
    const { accepted, rejected } = filter.filterTokens(tokens);
    expect(accepted).toHaveLength(0);
    expect(rejected[0]!.reason).toContain('organicScore');
  });

  it('rejects token with high top holders concentration', () => {
    const tokens = [makeToken({
      audit: { mintAuthorityDisabled: true, freezeAuthorityDisabled: true, topHoldersPercentage: 0.75, devMints: 0 },
    })];
    const { accepted, rejected } = filter.filterTokens(tokens);
    expect(accepted).toHaveLength(0);
    expect(rejected[0]!.reason).toContain('topHoldersPercentage');
  });

  it('bypasses all filters for USDC', () => {
    const tokens = [makeToken({
      id: KNOWN_MINTS.USDC,
      symbol: 'USDC',
      audit: null,
      organicScore: 0,
    })];
    const { accepted, rejected } = filter.filterTokens(tokens);
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('bypasses all filters for SOL', () => {
    const tokens = [makeToken({
      id: KNOWN_MINTS.SOL,
      symbol: 'SOL',
      audit: null,
      organicScore: 10,
    })];
    const { accepted, rejected } = filter.filterTokens(tokens);
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('bypasses all filters for JupUSD', () => {
    const tokens = [makeToken({
      id: KNOWN_MINTS.JupUSD,
      symbol: 'JupUSD',
      audit: null,
    })];
    const { accepted, rejected } = filter.filterTokens(tokens);
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('filters multiple tokens correctly', () => {
    const tokens = [
      makeToken({ id: 'mint1', symbol: 'GOOD', organicScore: 90 }),
      makeToken({ id: 'mint2', symbol: 'BAD', audit: null }),
      makeToken({ id: KNOWN_MINTS.USDC, symbol: 'USDC', audit: null }),
    ];
    const { accepted, rejected } = filter.filterTokens(tokens);
    expect(accepted).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.token.symbol).toBe('BAD');
  });

  it('writes accepted tokens to DB', async () => {
    (mockClient as { get: ReturnType<typeof vi.fn> }).get = vi.fn().mockResolvedValueOnce([
      makeToken({ id: 'mint_a', symbol: 'AAA' }),
    ]);

    const result = await filter.refreshWatchlist();
    expect(result).toHaveLength(1);
    expect(result[0]!.mint).toBe('mint_a');
    expect(result[0]!.symbol).toBe('AAA');
  });

  it('returns cached watchlist on API failure', async () => {
    (mockClient as { get: ReturnType<typeof vi.fn> }).get = vi.fn().mockRejectedValueOnce(new Error('network'));
    const result = await filter.refreshWatchlist();
    expect(result).toHaveLength(0);
  });
});
