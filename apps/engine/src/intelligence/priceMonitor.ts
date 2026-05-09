import type Database from 'better-sqlite3';
import type { PriceResponse } from '@artomik/shared';
import type { JupiterClient } from '../infra/jupiterClient.js';
import { logger } from '../infra/logger.js';

interface PriceMonitorOptions {
  client: JupiterClient;
  db: Database.Database;
  maxBatchSize: number;
  rateLimitRps: number;
}

export class PriceMonitor {
  private readonly client: JupiterClient;
  private readonly db: Database.Database;
  private readonly maxBatchSize: number;
  private readonly batchDelayMs: number;
  private prices: Map<string, number>;

  constructor(options: PriceMonitorOptions) {
    this.client = options.client;
    this.db = options.db;
    this.maxBatchSize = options.maxBatchSize;
    this.batchDelayMs = Math.ceil(1000 / options.rateLimitRps);
    this.prices = new Map();
  }

  async pollPrices(mints: string[]): Promise<Map<string, number>> {
    if (mints.length === 0) {
      logger.debug({ module: 'priceMonitor', message: 'No mints to poll' });
      return this.prices;
    }

    const batches = this.chunk(mints, this.maxBatchSize);
    const allPrices = new Map<string, number>();

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!;

      if (i > 0) {
        await this.sleep(this.batchDelayMs);
      }

      try {
        const response = await this.client.get<PriceResponse>('/price/v3', {
          ids: batch.join(','),
        });

        let returnedCount = 0;
        for (const mint of batch) {
          const entry = response[mint];
          if (!entry) {
            logger.warn({
              module: 'priceMonitor',
              message: `Silent drop: ${mint} not in response`,
            });
            continue;
          }

          const price = entry.usdPrice;
          if (typeof price !== 'number' || isNaN(price)) {
            logger.warn({
              module: 'priceMonitor',
              message: `Invalid price for ${mint}: ${String(price)}`,
            });
            continue;
          }

          allPrices.set(mint, price);
          returnedCount++;
        }

        if (returnedCount < batch.length) {
          logger.warn({
            module: 'priceMonitor',
            message: `Price batch: ${returnedCount}/${batch.length} returned`,
            data: { queried: batch.length, returned: returnedCount },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({
          module: 'priceMonitor',
          message: `Price batch failed: ${message}`,
          data: { batchIndex: i, batchSize: batch.length },
        });
      }
    }

    this.prices = allPrices;

    this.persistPrices(allPrices);

    logger.info({
      module: 'priceMonitor',
      message: `Polled prices: ${allPrices.size}/${mints.length} mints`,
    });

    return allPrices;
  }

  getLatestPrices(): Map<string, number> {
    return new Map(this.prices);
  }

  private persistPrices(prices: Map<string, number>): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      'UPDATE watched_tokens SET current_price_usd = ?, price_updated_at = ?, updated_at = datetime(\'now\') WHERE mint = ?'
    );

    const transaction = this.db.transaction(() => {
      for (const [mint, price] of prices) {
        stmt.run(price, now, mint);
      }
    });

    transaction();
  }

  private chunk(arr: string[], size: number): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
