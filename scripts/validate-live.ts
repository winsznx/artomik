import * as path from 'node:path';
import { initializeDatabase } from '@artomik/shared';
import { JupiterClient } from '../apps/engine/src/infra/jupiterClient.js';
import { initLogger, logger } from '../apps/engine/src/infra/logger.js';
import type { PriceResponse } from '@artomik/shared';

const DB_PATH = path.resolve('./data/validate-live.sqlite');
const db = initializeDatabase(DB_PATH);
initLogger(db, 'debug');

async function main(): Promise<void> {
  const client = new JupiterClient({
    baseUrl: 'https://api.jup.ag',
    apiKey: '',
    rps: 1,
    db,
  });

  logger.info({ module: 'validate', message: 'Making keyless GET to /price/v3 for SOL price...' });

  const SOL_MINT = 'So11111111111111111111111111111111111111112';

  const result = await client.get<PriceResponse>('/price/v3', { ids: SOL_MINT });

  const solData = result[SOL_MINT];
  if (solData?.usdPrice) {
    logger.info({
      module: 'validate',
      message: `SOL price: $${solData.usdPrice}`,
      data: { mint: SOL_MINT, usdPrice: solData.usdPrice, priceChange24h: solData.priceChange24h },
    });
  } else {
    logger.warn({ module: 'validate', message: 'SOL price not returned or null' });
  }

  const metrics = db.prepare('SELECT * FROM api_metrics ORDER BY id DESC LIMIT 1').get() as Record<string, unknown> | undefined;
  if (metrics) {
    logger.info({
      module: 'validate',
      message: 'API metric recorded',
      data: { endpoint: metrics.endpoint, status: metrics.status_code, latency: metrics.latency_ms },
    });
  }

  logger.info({ module: 'validate', message: 'Live validation complete' });
  db.close();
}

main().catch((err) => {
  logger.error({ module: 'validate', message: 'Live validation failed', data: { error: String(err) } });
  db.close();
  process.exit(1);
});
