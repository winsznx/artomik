import type { JupiterClient } from '../infra/jupiterClient.js';
import type { VaultManager } from './vaultManager.js';
import { logger } from '../infra/logger.js';

export interface OtocoParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  triggerCondition: 'above' | 'below';
  triggerPriceUsd: string;
  tpPriceUsd: string;
  slPriceUsd: string;
  slSlippageBps: number;
  expiresAt: number;
}

export interface OtocoOrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export interface OtocoOrder {
  id: string;
  inputMint: string;
  outputMint: string;
  status: string;
  triggerPriceUsd: number;
  tpPriceUsd: number;
  slPriceUsd: number;
  slSlippageBps: number;
  expiresAt: string;
  createdAt: string;
}

const MIN_ORDER_USD = 10;

export class OtocoBuilder {
  private readonly client: JupiterClient;
  private readonly vaultManager: VaultManager;
  private readonly defaultSlSlippageBps: number;

  constructor(client: JupiterClient, vaultManager: VaultManager, defaultSlSlippageBps = 300) {
    this.client = client;
    this.vaultManager = vaultManager;
    this.defaultSlSlippageBps = defaultSlSlippageBps;
  }

  async placeOtocoOrder(params: OtocoParams): Promise<OtocoOrderResult> {
    const validation = this.validateParams(params);
    if (validation) {
      logger.warn({ module: 'otocoBuilder', message: `Validation failed: ${validation}` });
      return { success: false, error: validation };
    }

    const jwt = this.vaultManager.getJwt();
    if (!jwt) {
      return { success: false, error: 'Not authenticated — call vaultManager.authenticate() first' };
    }

    const slSlippageBps = params.slSlippageBps || this.defaultSlSlippageBps;

    if (slSlippageBps !== params.slSlippageBps) {
      logger.warn({
        module: 'otocoBuilder',
        message: `slSlippageBps not explicitly set, using default ${this.defaultSlSlippageBps}. Never rely on API default (2000 bps = 20%).`,
      });
    }

    logger.info({
      module: 'otocoBuilder',
      message: 'Placing OTOCO order',
      data: {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount,
        triggerCondition: params.triggerCondition,
        slSlippageBps,
      },
    });

    try {
      const result = await this.client.post<{ id: string; status: string }>('/trigger/v2/orders/price', {
        type: 'otoco',
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        makingAmount: params.amount,
        triggerCondition: params.triggerCondition,
        triggerPrice: params.triggerPriceUsd,
        tpPrice: params.tpPriceUsd,
        slPrice: params.slPriceUsd,
        slSlippageBps: slSlippageBps,
        expiredAt: String(params.expiresAt),
      });

      logger.info({
        module: 'otocoBuilder',
        message: 'OTOCO order placed',
        data: { orderId: result.id, status: result.status },
      });

      return { success: true, orderId: result.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ module: 'otocoBuilder', message: `OTOCO order failed: ${message}` });
      return { success: false, error: message };
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    logger.info({ module: 'otocoBuilder', message: `Cancelling order ${orderId}` });

    await this.client.post<unknown>(`/trigger/v2/orders/price/cancel/${orderId}`, {});
  }

  async getActiveOrders(): Promise<OtocoOrder[]> {
    try {
      const result = await this.client.get<{ orders: OtocoOrder[] }>('/trigger/v2/orders/history');
      return (result.orders ?? []).filter(o => o.status === 'active');
    } catch {
      logger.warn({ module: 'otocoBuilder', message: 'Failed to fetch orders' });
      return [];
    }
  }

  private validateParams(params: OtocoParams): string | null {
    if (params.expiresAt <= Date.now()) {
      return 'expiresAt must be in the future';
    }

    const amountNum = parseFloat(params.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return 'amount must be a positive number';
    }

    const triggerPrice = parseFloat(params.triggerPriceUsd);
    if (isNaN(triggerPrice) || triggerPrice <= 0) {
      return 'triggerPriceUsd must be a positive number';
    }

    if (!params.slSlippageBps || params.slSlippageBps <= 0) {
      return 'slSlippageBps must be explicitly set to a positive value';
    }

    return null;
  }

  static validateMinimumOrder(amountUsd: number): string | null {
    if (amountUsd < MIN_ORDER_USD) {
      return `Order amount $${amountUsd} is below minimum $${MIN_ORDER_USD}`;
    }
    return null;
  }
}
