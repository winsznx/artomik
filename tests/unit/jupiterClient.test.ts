import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';

vi.mock('../../apps/engine/src/infra/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { JupiterClient } from '../../apps/engine/src/infra/jupiterClient.js';
import { initializeDatabase } from '@artomik/shared';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-jupiter-client.sqlite');

let db: Database.Database;
let client: JupiterClient;

function createTestClient(options?: { apiKey?: string; rps?: number }): JupiterClient {
  return new JupiterClient({
    baseUrl: 'https://api.jup.ag',
    apiKey: options?.apiKey ?? 'test-key',
    rps: options?.rps ?? 10,
    db,
  });
}

beforeEach(() => {
  const dir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = initializeDatabase(TEST_DB_PATH);
  client = createTestClient();
});

afterEach(() => {
  db.close();
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  vi.restoreAllMocks();
});

describe('JupiterClient', () => {
  it('attaches x-api-key header when configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: {} }), { status: 200 })
    );

    await client.get('/price/v3', { ids: 'test' });

    const callArgs = fetchSpy.mock.calls[0];
    const requestInit = callArgs?.[1] as RequestInit;
    const headers = requestInit?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
  });

  it('omits x-api-key header in keyless mode', async () => {
    const keylessClient = createTestClient({ apiKey: '' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: {} }), { status: 200 })
    );

    await keylessClient.get('/price/v3', { ids: 'test' });

    const callArgs = fetchSpy.mock.calls[0];
    const requestInit = callArgs?.[1] as RequestInit;
    const headers = requestInit?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBeUndefined();
  });

  it('retries on 429 then succeeds', async () => {
    vi.useRealTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('Rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { price: '100' } }), { status: 200 }));

    const result = await client.get<{ data: { price: string } }>('/price/v3');
    expect(result.data.price).toBe('100');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('retries on 5xx then succeeds', async () => {
    vi.useRealTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await client.get<{ ok: boolean }>('/test');
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws after 3 failed retries', async () => {
    vi.useRealTimers();
    vi.spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('Server Error', { status: 500 })));

    await expect(client.get('/test')).rejects.toMatchObject({
      category: 'NETWORK',
    });
  }, 15000);

  it('records metrics to api_metrics table on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: {} }), { status: 200 })
    );

    await client.get('/price/v3');

    const rows = db.prepare('SELECT * FROM api_metrics').all() as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const lastRow = rows[rows.length - 1]!;
    expect(lastRow.status_code).toBe(200);
    expect(lastRow.endpoint).toContain('/price/v3');
  });

  it('records metrics on failed requests', async () => {
    vi.useRealTimers();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 })
    );

    await expect(client.get('/nonexistent')).rejects.toBeDefined();

    const rows = db.prepare('SELECT * FROM api_metrics').all() as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('handles POST requests with body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: '123' }), { status: 200 })
    );

    const result = await client.post<{ id: string }>('/prediction/v1/orders', { marketId: 'abc' });
    expect(result.id).toBe('123');

    const callArgs = fetchSpy.mock.calls[0];
    const requestInit = callArgs?.[1] as RequestInit;
    expect(requestInit.method).toBe('POST');
    expect(requestInit.body).toBe(JSON.stringify({ marketId: 'abc' }));
  });
});
