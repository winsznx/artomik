import * as path from 'node:path';
import { initializeDatabase } from '@artomik/shared';
import { JupiterClient } from '../apps/engine/src/infra/jupiterClient.js';
import { initLogger, logger } from '../apps/engine/src/infra/logger.js';
import { TokenFilter } from '../apps/engine/src/intelligence/tokenFilter.js';
import { PriceMonitor } from '../apps/engine/src/intelligence/priceMonitor.js';
import { VolatilityDetector } from '../apps/engine/src/intelligence/volatilityDetector.js';

const DB_PATH = path.resolve('./data/validate-signals.sqlite');
const db = initializeDatabase(DB_PATH);
initLogger(db, 'info');

async function main(): Promise<void> {
  const client = new JupiterClient({
    baseUrl: 'https://api.jup.ag',
    apiKey: '',
    rps: 1,
    db,
  });

  const tokenFilter = new TokenFilter({
    client,
    db,
    minOrganicScore: 60,
    maxTopHoldersPercentage: 0.50,
  });

  logger.info({ module: 'validate', message: 'Fetching and filtering toporganicscore tokens...' });
  const watchlist = await tokenFilter.refreshWatchlist();

  logger.info({
    module: 'validate',
    message: `Watchlist: ${watchlist.length} tokens`,
    data: { tokens: watchlist.slice(0, 5).map(t => `${t.symbol} (${t.organic_score})`) },
  });

  const mints = watchlist.map(t => t.mint);

  const priceMonitor = new PriceMonitor({
    client,
    db,
    maxBatchSize: 50,
    rateLimitRps: 1,
  });

  logger.info({ module: 'validate', message: `Polling prices for ${mints.length} mints...` });
  const prices = await priceMonitor.pollPrices(mints);

  logger.info({
    module: 'validate',
    message: `Prices received: ${prices.size}/${mints.length}`,
  });

  const symbols = new Map(watchlist.map(t => [t.mint, t.symbol]));
  const detector = new VolatilityDetector({ db, thresholdStddev: 2.0, windowSize: 20 });
  const signals = detector.detectSignals(prices, symbols);

  logger.info({
    module: 'validate',
    message: `Volatility signals: ${signals.length} (expected 0 on first run — need history)`,
  });

  logger.info({ module: 'validate', message: 'Signal layer validation complete' });
  db.close();
}

main().catch((err) => {
  logger.error({ module: 'validate', message: 'Validation failed', data: { error: String(err) } });
  db.close();
  process.exit(1);
});
