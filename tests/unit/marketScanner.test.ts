import { describe, it, expect, vi } from 'vitest';

vi.mock('../../apps/engine/src/infra/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { MarketScanner } from '../../apps/engine/src/hedging/marketScanner.js';

const MOCK_EVENTS_RESPONSE = {
  data: [
    {
      eventId: 'POLY-1',
      isActive: true,
      category: 'crypto',
      subcategory: 'sol',
      metadata: { title: 'Will SOL reach $200?' },
      markets: [
        {
          marketId: 'MKT-1',
          title: '200',
          status: 'open',
          outcomePrices: ['0.3', '0.7'],
          outcomes: ['Yes', 'No'],
          closeTime: Date.now() + 86400000,
          resolveAt: Date.now() + 86400000,
        },
        {
          marketId: 'MKT-2',
          title: '150',
          status: 'closed',
          outcomePrices: ['0.9', '0.1'],
          outcomes: ['Yes', 'No'],
          closeTime: Date.now() - 1000,
          resolveAt: Date.now() - 1000,
        },
      ],
      volume24hr: 5000,
      volumeUsd: 250000,
      tags: ['crypto'],
    },
    {
      eventId: 'POLY-2',
      isActive: false,
      category: 'crypto',
      subcategory: 'btc',
      metadata: { title: 'Old event' },
      markets: [],
      volume24hr: 0,
      volumeUsd: 0,
      tags: [],
    },
  ],
  pagination: { start: 0, end: 10, total: 2, hasNext: false },
};

describe('MarketScanner', () => {
  it('parses prediction event response correctly', async () => {
    const client = { get: vi.fn().mockResolvedValue(MOCK_EVENTS_RESPONSE), post: vi.fn() } as never;
    const scanner = new MarketScanner(client);

    const events = await scanner.getActiveEvents('crypto');
    expect(events).toHaveLength(1);
    expect(events[0]!.eventId).toBe('POLY-1');
    expect(events[0]!.title).toBe('Will SOL reach $200?');
  });

  it('filters out inactive events', async () => {
    const client = { get: vi.fn().mockResolvedValue(MOCK_EVENTS_RESPONSE), post: vi.fn() } as never;
    const scanner = new MarketScanner(client);

    const events = await scanner.getActiveEvents();
    const inactive = events.filter(e => !e.isActive);
    expect(inactive).toHaveLength(0);
  });

  it('filters out closed markets within events', async () => {
    const client = { get: vi.fn().mockResolvedValue(MOCK_EVENTS_RESPONSE), post: vi.fn() } as never;
    const scanner = new MarketScanner(client);

    const events = await scanner.getActiveEvents();
    expect(events[0]!.markets).toHaveLength(1);
    expect(events[0]!.markets[0]!.status).toBe('open');
  });

  it('handles empty event list gracefully', async () => {
    const empty = { data: [], pagination: { start: 0, end: 0, total: 0, hasNext: false } };
    const client = { get: vi.fn().mockResolvedValue(empty), post: vi.fn() } as never;
    const scanner = new MarketScanner(client);

    const events = await scanner.getActiveEvents();
    expect(events).toHaveLength(0);
  });

  it('handles API unavailability without crash', async () => {
    const client = { get: vi.fn().mockRejectedValue(new Error('503 Service Unavailable')), post: vi.fn() } as never;
    const scanner = new MarketScanner(client);

    const events = await scanner.getActiveEvents();
    expect(events).toHaveLength(0);
  });
});
