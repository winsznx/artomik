import { describe, it, expect } from 'vitest';
import { CorrelationEngine } from '../../apps/engine/src/hedging/correlationEngine.js';
import type { PredictionEventInfo } from '../../apps/engine/src/hedging/marketScanner.js';

function makeEvent(title: string, eventId = 'evt-1'): PredictionEventInfo {
  return {
    eventId,
    title,
    category: 'crypto',
    subcategory: 'sol',
    isActive: true,
    markets: [{ marketId: 'mkt-1', title: '150', status: 'open', outcomePrices: ['0.5', '0.5'], outcomes: ['Yes', 'No'], closeTime: Date.now() + 86400000, resolveAt: Date.now() + 86400000 }],
    volume24hr: 1000,
    volumeUsd: 50000,
  };
}

describe('CorrelationEngine', () => {
  const engine = new CorrelationEngine();

  it('recommends YES for "Will SOL drop below $150?" when long SOL', () => {
    const positions = [{ mint: 'SOL_MINT', symbol: 'SOL', direction: 'long' as const }];
    const events = [makeEvent('Will SOL drop below $150?')];

    const recs = engine.findHedges(positions, events);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.position).toBe('yes');
    expect(recs[0]!.reason).toContain('hedge');
  });

  it('recommends NO for "Will BTC rally above $100k?" when long BTC', () => {
    const positions = [{ mint: 'BTC_MINT', symbol: 'BTC', direction: 'long' as const }];
    const events = [makeEvent('Will BTC rally above $100k?')];

    const recs = engine.findHedges(positions, events);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.position).toBe('no');
  });

  it('returns empty for irrelevant events', () => {
    const positions = [{ mint: 'SOL_MINT', symbol: 'SOL', direction: 'long' as const }];
    const events = [makeEvent('Will it rain in New York tomorrow?')];

    const recs = engine.findHedges(positions, events);
    expect(recs).toHaveLength(0);
  });

  it('returns empty when no events match held positions', () => {
    const positions = [{ mint: 'JUP_MINT', symbol: 'JUP', direction: 'long' as const }];
    const events = [makeEvent('Will SOL crash below $50?')];

    const recs = engine.findHedges(positions, events);
    expect(recs).toHaveLength(0);
  });

  it('handles short positions correctly — bullish event', () => {
    const positions = [{ mint: 'ETH_MINT', symbol: 'ETH', direction: 'short' as const }];
    const events = [makeEvent('Will Ethereum rise above $5000?')];

    const recs = engine.findHedges(positions, events);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.position).toBe('yes');
    expect(recs[0]!.reason).toContain('short');
  });

  it('matches by subcategory keywords', () => {
    const positions = [{ mint: 'ETH_MINT', symbol: 'ETH', direction: 'long' as const }];
    const events = [makeEvent('Ethereum above ___ on April 15?')];

    const recs = engine.findHedges(positions, events);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.position).toBe('no');
  });
});
