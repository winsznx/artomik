import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { initializeDatabase } from '@artomik/shared';

vi.mock('../../apps/engine/src/infra/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { VolatilityDetector } from '../../apps/engine/src/intelligence/volatilityDetector.js';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-volatility.sqlite');

let db: Database.Database;
let detector: VolatilityDetector;

beforeEach(() => {
  const dir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = initializeDatabase(TEST_DB_PATH);
  detector = new VolatilityDetector({ db, thresholdStddev: 2.0, windowSize: 20 });
});

afterEach(() => {
  db.close();
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  vi.restoreAllMocks();
});

describe('VolatilityDetector', () => {
  describe('math helpers', () => {
    it('calculates mean correctly', () => {
      expect(detector.mean([10, 20, 30])).toBe(20);
    });

    it('calculates mean of empty array as 0', () => {
      expect(detector.mean([])).toBe(0);
    });

    it('calculates stddev correctly', () => {
      const sd = detector.stddev([10, 20, 30]);
      expect(sd).toBeCloseTo(8.165, 2);
    });

    it('stddev of single value is 0', () => {
      expect(detector.stddev([5])).toBe(0);
    });

    it('stddev of identical values is 0', () => {
      expect(detector.stddev([5, 5, 5, 5])).toBe(0);
    });
  });

  describe('isAnomalous', () => {
    it('returns false with less than 3 data points', () => {
      expect(detector.isAnomalous([100, 101], 102)).toBe(false);
    });

    it('returns false for normal fluctuation', () => {
      const history = [100, 101, 99, 100.5, 100.2, 100];
      expect(detector.isAnomalous(history, 100.3)).toBe(false);
    });

    it('fires on > 2σ deviation', () => {
      const history = [100, 100, 100, 100, 100, 100, 100, 100, 100, 150];
      expect(detector.isAnomalous(history, 150)).toBe(true);
    });

    it('does not fire on exactly mean price', () => {
      const history = [100, 101, 99, 100];
      expect(detector.isAnomalous(history, 100)).toBe(false);
    });

    it('detects anomaly when stddev is 0 and price differs (all same past prices)', () => {
      const history = [50, 50, 50, 50];
      expect(detector.isAnomalous(history, 55)).toBe(true);
    });

    it('returns false when stddev is 0 and price matches mean', () => {
      const history = [50, 50, 50, 50];
      expect(detector.isAnomalous(history, 50)).toBe(false);
    });

    it('filters stablecoin micro-fluctuations below $0.01 absolute change', () => {
      const history = [1.0000, 1.0001, 1.0000, 1.0001, 1.0000];
      expect(detector.isAnomalous(history, 1.00015)).toBe(false);
    });

    it('allows anomaly when absolute change exceeds $0.01', () => {
      const history = [100, 100, 100, 100, 100, 100, 100, 100, 100, 150];
      expect(detector.isAnomalous(history, 150)).toBe(true);
    });
  });

  describe('detectSignals', () => {
    it('returns empty signals with insufficient history', () => {
      const prices = new Map([['mint1', 100]]);
      const symbols = new Map([['mint1', 'TEST']]);
      const signals = detector.detectSignals(prices, symbols);
      expect(signals).toHaveLength(0);
    });

    it('builds up history and eventually detects signals', () => {
      const symbols = new Map([['mint1', 'TEST']]);

      for (let i = 0; i < 10; i++) {
        detector.detectSignals(new Map([['mint1', 100]]), symbols);
      }

      const signals = detector.detectSignals(new Map([['mint1', 200]]), symbols);
      expect(signals).toHaveLength(1);
      expect(signals[0]!.symbol).toBe('TEST');
      expect(signals[0]!.volatilityFlag).toBe(true);
    });

    it('does not fire on stable prices', () => {
      const symbols = new Map([['mint1', 'STABLE']]);
      const stablePrices = [100, 101, 99, 100.5, 99.5, 100.2, 99.8, 100.3, 99.7, 100.1];

      for (const price of stablePrices) {
        detector.detectSignals(new Map([['mint1', price]]), symbols);
      }

      const signals = detector.detectSignals(new Map([['mint1', 100.4]]), symbols);
      expect(signals).toHaveLength(0);
    });

    it('maintains separate history per mint', () => {
      const symbols = new Map([['m1', 'A'], ['m2', 'B']]);

      for (let i = 0; i < 10; i++) {
        detector.detectSignals(
          new Map([['m1', 100], ['m2', 50]]),
          symbols,
        );
      }

      const signals = detector.detectSignals(
        new Map([['m1', 100], ['m2', 150]]),
        symbols,
      );
      expect(signals).toHaveLength(1);
      expect(signals[0]!.symbol).toBe('B');
    });

    it('respects window size limit', () => {
      const smallDetector = new VolatilityDetector({ db, thresholdStddev: 2.0, windowSize: 5 });
      const symbols = new Map([['m1', 'X']]);

      for (let i = 0; i < 10; i++) {
        smallDetector.detectSignals(new Map([['m1', 100]]), symbols);
      }

      const history = smallDetector.getPriceHistory('m1');
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });
});
