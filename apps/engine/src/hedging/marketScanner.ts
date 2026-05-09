import type { JupiterClient } from '../infra/jupiterClient.js';
import { logger } from '../infra/logger.js';

export interface PredictionMarketInfo {
  marketId: string;
  title: string;
  status: string;
  outcomePrices: string[];
  outcomes: string[];
  closeTime: number;
  resolveAt: number;
}

export interface PredictionEventInfo {
  eventId: string;
  title: string;
  category: string;
  subcategory: string;
  isActive: boolean;
  markets: PredictionMarketInfo[];
  volume24hr: number;
  volumeUsd: number;
}

interface EventsApiResponse {
  data: Array<{
    eventId: string;
    isActive: boolean;
    category: string;
    subcategory: string;
    metadata: { title: string };
    markets: Array<{
      marketId: string;
      title: string;
      status: string;
      outcomePrices: string[];
      outcomes: string[];
      closeTime: number;
      resolveAt: number;
    }>;
    volume24hr: number;
    volumeUsd: number;
    tags: string[];
  }>;
  pagination: { start: number; end: number; total: number; hasNext: boolean };
}

export class MarketScanner {
  private readonly client: JupiterClient;

  constructor(client: JupiterClient) {
    this.client = client;
  }

  async getActiveEvents(category = 'crypto'): Promise<PredictionEventInfo[]> {
    try {
      const response = await this.client.get<EventsApiResponse>('/prediction/v1/events', { category });

      const events = response.data
        .filter(e => e.isActive)
        .map(e => this.mapEvent(e));

      logger.info({
        module: 'marketScanner',
        message: `Fetched ${events.length} active ${category} events`,
        data: { total: response.pagination.total, active: events.length },
      });

      return events;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({
        module: 'marketScanner',
        message: `Failed to fetch prediction events: ${message}`,
      });
      return [];
    }
  }

  async getEventById(eventId: string): Promise<PredictionEventInfo | null> {
    const events = await this.getActiveEvents();
    return events.find(e => e.eventId === eventId) ?? null;
  }

  private mapEvent(raw: EventsApiResponse['data'][number]): PredictionEventInfo {
    return {
      eventId: raw.eventId,
      title: raw.metadata.title,
      category: raw.category,
      subcategory: raw.subcategory,
      isActive: raw.isActive,
      markets: raw.markets
        .filter(m => m.status === 'open')
        .map(m => ({
          marketId: m.marketId,
          title: m.title,
          status: m.status,
          outcomePrices: m.outcomePrices,
          outcomes: m.outcomes,
          closeTime: m.closeTime,
          resolveAt: m.resolveAt,
        })),
      volume24hr: raw.volume24hr,
      volumeUsd: raw.volumeUsd,
    };
  }
}
