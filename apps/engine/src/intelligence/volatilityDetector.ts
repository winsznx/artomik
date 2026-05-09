import type Database from 'better-sqlite3';
import type { Signal } from '@artomik/shared';
import { logger } from '../infra/logger.js';

const MIN_ABSOLUTE_CHANGE_USD = 0.01;

interface VolatilityDetectorOptions {
  db: Database.Database;
  thresholdStddev: number;
  windowSize: number;
}

export class VolatilityDetector {
  private readonly db: Database.Database;
  private readonly thresholdStddev: number;
  private readonly windowSize: number;
  private readonly priceHistory: Map<string, number[]>;

  constructor(options: VolatilityDetectorOptions) {
    this.db = options.db;
    this.thresholdStddev = options.thresholdStddev;
    this.windowSize = options.windowSize;
    this.priceHistory = new Map();
  }

  detectSignals(prices: Map<string, number>, symbols: Map<string, string>): Signal[] {
    const signals: Signal[] = [];

    for (const [mint, price] of prices) {
      const history = this.priceHistory.get(mint) ?? [];
      history.push(price);

      if (history.length > this.windowSize) {
        history.splice(0, history.length - this.windowSize);
      }

      this.priceHistory.set(mint, history);

      if (history.length < 3) {
        continue;
      }

      const isVolatile = this.isAnomalous(history, price);

      this.updateVolatilityFlag(mint, isVolatile);

      if (isVolatile) {
        const symbol = symbols.get(mint) ?? 'UNKNOWN';
        const signal: Signal = {
          mint,
          symbol,
          organicScore: 0,
          currentPriceUsd: price,
          volatilityFlag: true,
          timestamp: new Date().toISOString(),
        };
        signals.push(signal);

        logger.info({
          module: 'volatilityDetector',
          message: `Volatility signal: ${symbol} (${mint})`,
          data: {
            price,
            mean: this.mean(history),
            stddev: this.stddev(history),
            threshold: this.thresholdStddev,
          },
        });
      }
    }

    return signals;
  }

  isAnomalous(history: number[], currentPrice: number): boolean {
    if (history.length < 3) return false;

    const pastPrices = history.slice(0, -1);
    const avg = this.mean(pastPrices);
    const absoluteChange = Math.abs(currentPrice - avg);

    if (absoluteChange < MIN_ABSOLUTE_CHANGE_USD) return false;

    const sd = this.stddev(pastPrices);

    if (sd === 0) {
      return currentPrice !== avg;
    }

    const zScore = absoluteChange / sd;
    return zScore > this.thresholdStddev;
  }

  getPriceHistory(mint: string): number[] {
    return [...(this.priceHistory.get(mint) ?? [])];
  }

  clearHistory(): void {
    this.priceHistory.clear();
  }

  mean(values: number[]): number {
    if (values.length === 0) return 0;
    let sum = 0;
    for (const v of values) {
      sum += v;
    }
    return sum / values.length;
  }

  stddev(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = this.mean(values);
    let sumSqDiff = 0;
    for (const v of values) {
      const diff = v - avg;
      sumSqDiff += diff * diff;
    }
    return Math.sqrt(sumSqDiff / values.length);
  }

  private updateVolatilityFlag(mint: string, isVolatile: boolean): void {
    try {
      this.db.prepare(
        'UPDATE watched_tokens SET volatility_flag = ?, updated_at = datetime(\'now\') WHERE mint = ?'
      ).run(isVolatile ? 1 : 0, mint);
    } catch {
      // non-critical
    }
  }
}
