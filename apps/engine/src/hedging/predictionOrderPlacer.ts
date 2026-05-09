import type { JupiterClient } from '../infra/jupiterClient.js';
import { logger } from '../infra/logger.js';

export interface PredictionOrderResult {
  success: boolean;
  tx?: string;
  orderId?: string;
  error?: string;
}

interface OrderApiResponse {
  tx: string;
  orderId?: string;
}

export class PredictionOrderPlacer {
  private readonly client: JupiterClient;

  constructor(client: JupiterClient) {
    this.client = client;
  }

  async placeOrder(params: {
    marketId: string;
    isYes: boolean;
    depositMint: string;
    depositAmount: number;
    ownerPubkey: string;
  }): Promise<PredictionOrderResult> {
    if (params.depositAmount <= 0) {
      return { success: false, error: 'depositAmount must be positive' };
    }

    logger.info({
      module: 'predictionOrderPlacer',
      message: 'Placing prediction order',
      data: {
        marketId: params.marketId,
        isYes: params.isYes,
        depositAmount: params.depositAmount,
        depositMint: params.depositMint,
      },
    });

    try {
      const result = await this.client.post<OrderApiResponse>('/prediction/v1/orders', {
        ownerPubkey: params.ownerPubkey,
        marketId: params.marketId,
        depositMint: params.depositMint,
        depositAmount: params.depositAmount,
        isBuy: true,
        isYes: params.isYes,
      });

      logger.info({
        module: 'predictionOrderPlacer',
        message: 'Prediction order placed',
        data: { orderId: result.orderId },
      });

      return { success: true, tx: result.tx, orderId: result.orderId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('geo') || message.includes('blocked') || message.includes('403')) {
        logger.warn({
          module: 'predictionOrderPlacer',
          message: 'Prediction markets unavailable (likely geo-restricted)',
        });
        return { success: false, error: 'unavailable: geo-restricted or API blocked' };
      }

      logger.error({ module: 'predictionOrderPlacer', message: `Order failed: ${message}` });
      return { success: false, error: message };
    }
  }
}
