import type { PredictionEventInfo } from './marketScanner.js';

export interface HedgeRecommendation {
  event: PredictionEventInfo;
  marketId: string;
  position: 'yes' | 'no';
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

interface HeldPosition {
  mint: string;
  symbol: string;
  direction: 'long' | 'short';
}

const ASSET_KEYWORDS: Record<string, string[]> = {
  SOL: ['sol', 'solana'],
  BTC: ['btc', 'bitcoin'],
  ETH: ['eth', 'ethereum'],
  JUP: ['jup', 'jupiter'],
};

const BEARISH_KEYWORDS = ['drop', 'crash', 'below', 'fall', 'decline', 'under', 'less than', 'lower'];
const BULLISH_KEYWORDS = ['rise', 'rally', 'above', 'pump', 'surge', 'over', 'more than', 'higher', 'exceed'];

export class CorrelationEngine {
  findHedges(heldPositions: HeldPosition[], events: PredictionEventInfo[]): HedgeRecommendation[] {
    const recommendations: HedgeRecommendation[] = [];

    for (const position of heldPositions) {
      const keywords = ASSET_KEYWORDS[position.symbol.toUpperCase()] ?? [position.symbol.toLowerCase()];

      for (const event of events) {
        const titleLower = event.title.toLowerCase();

        const mentionsAsset = keywords.some(kw => titleLower.includes(kw));
        if (!mentionsAsset) continue;

        const isBearish = BEARISH_KEYWORDS.some(kw => titleLower.includes(kw));
        const isBullish = BULLISH_KEYWORDS.some(kw => titleLower.includes(kw));

        if (!isBearish && !isBullish) continue;

        for (const market of event.markets) {
          const rec = this.computeRecommendation(position, event, market.marketId, isBearish, isBullish);
          if (rec) {
            recommendations.push(rec);
          }
        }
      }
    }

    return recommendations;
  }

  private computeRecommendation(
    position: HeldPosition,
    event: PredictionEventInfo,
    marketId: string,
    isBearish: boolean,
    isBullish: boolean,
  ): HedgeRecommendation | null {
    if (position.direction === 'long') {
      if (isBearish) {
        return {
          event,
          marketId,
          position: 'yes',
          reason: `Hedge long ${position.symbol}: event predicts downside. Buying YES hedges against drop.`,
          confidence: 'medium',
        };
      }
      if (isBullish) {
        return {
          event,
          marketId,
          position: 'no',
          reason: `Counter long ${position.symbol}: event predicts upside already priced in. Buying NO if overconfident.`,
          confidence: 'low',
        };
      }
    }

    if (position.direction === 'short') {
      if (isBullish) {
        return {
          event,
          marketId,
          position: 'yes',
          reason: `Hedge short ${position.symbol}: event predicts upside. Buying YES hedges against rally.`,
          confidence: 'medium',
        };
      }
      if (isBearish) {
        return {
          event,
          marketId,
          position: 'no',
          reason: `Counter short ${position.symbol}: event predicts downside already priced in.`,
          confidence: 'low',
        };
      }
    }

    return null;
  }
}
