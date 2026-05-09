import type { JupiterClient } from '../infra/jupiterClient.js';
import type { WatchedTokenRow } from '@artomik/shared';
import { getWatchedTokens } from '@artomik/shared';
import type Database from 'better-sqlite3';
import { logger } from '../infra/logger.js';

export interface DcaOrderResult {
  success: boolean;
  outputMint: string;
  outputSymbol: string;
  amountPerCycle: string;
  error?: string;
}

interface CreateOrderResponse {
  tx: string;
  orderId?: string;
}

interface RecurringOrder {
  orderId: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  interval: string;
  status: string;
}

const MIN_TOTAL_USD = 100;

export class DcaScheduler {
  private readonly client: JupiterClient;
  private readonly db: Database.Database;

  constructor(client: JupiterClient, db: Database.Database) {
    this.client = client;
    this.db = db;
  }

  async createDcaOrders(params: {
    inputMint: string;
    totalAmount: string;
    interval: 'hourly' | 'daily' | 'weekly';
    totalCycles: number;
    targetTokens?: string[];
  }): Promise<DcaOrderResult[]> {
    const totalUsd = parseFloat(params.totalAmount);
    if (isNaN(totalUsd) || totalUsd < MIN_TOTAL_USD) {
      logger.warn({
        module: 'dcaScheduler',
        message: `Total amount $${totalUsd} below minimum $${MIN_TOTAL_USD}`,
      });
      return [{ success: false, outputMint: '', outputSymbol: '', amountPerCycle: '0', error: `Minimum total is $${MIN_TOTAL_USD}` }];
    }

    const targets = params.targetTokens ?? this.selectTopTokens(3);

    if (targets.length === 0) {
      return [{ success: false, outputMint: '', outputSymbol: '', amountPerCycle: '0', error: 'No target tokens available' }];
    }

    const amountPerToken = Math.floor(totalUsd / targets.length);
    const amountPerCyclePerToken = Math.floor(amountPerToken / params.totalCycles);
    const results: DcaOrderResult[] = [];

    for (const mint of targets) {
      const token = this.getTokenInfo(mint);
      const symbol = token?.symbol ?? 'UNKNOWN';

      logger.info({
        module: 'dcaScheduler',
        message: `Creating DCA: ${symbol}`,
        data: { mint, amountPerCycle: amountPerCyclePerToken, interval: params.interval, cycles: params.totalCycles },
      });

      try {
        await this.client.post<CreateOrderResponse>('/recurring/v1/createOrder', {
          inputMint: params.inputMint,
          outputMint: mint,
          amount: String(amountPerCyclePerToken * 1_000_000),
          interval: params.interval,
          totalCycles: params.totalCycles,
        });

        results.push({
          success: true,
          outputMint: mint,
          outputSymbol: symbol,
          amountPerCycle: String(amountPerCyclePerToken),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ module: 'dcaScheduler', message: `DCA order failed for ${symbol}: ${message}` });
        results.push({
          success: false,
          outputMint: mint,
          outputSymbol: symbol,
          amountPerCycle: String(amountPerCyclePerToken),
          error: message,
        });
      }
    }

    return results;
  }

  async getActiveOrders(): Promise<RecurringOrder[]> {
    try {
      const result = await this.client.get<{ orders: RecurringOrder[] }>('/recurring/v1/getRecurringOrders', {
        recurringType: 'time',
      });
      return result.orders ?? [];
    } catch {
      logger.warn({ module: 'dcaScheduler', message: 'Failed to fetch recurring orders' });
      return [];
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.client.post<unknown>('/recurring/v1/cancelOrder', { orderId });
  }

  private selectTopTokens(count: number): string[] {
    const tokens = getWatchedTokens(this.db);
    return tokens
      .filter(t => t.organic_score >= 60 && t.mint_authority_disabled === 1)
      .slice(0, count)
      .map(t => t.mint);
  }

  private getTokenInfo(mint: string): WatchedTokenRow | undefined {
    return getWatchedTokens(this.db).find(t => t.mint === mint);
  }

  static validateMinimumAmount(totalUsd: number): string | null {
    if (totalUsd < MIN_TOTAL_USD) {
      return `Total $${totalUsd} below minimum $${MIN_TOTAL_USD}`;
    }
    return null;
  }
}
