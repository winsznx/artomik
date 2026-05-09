export const JUPITER_API_BASE = 'https://api.jup.ag';

export const JUPITER_ENDPOINTS = {
  TOKENS_SEARCH: `${JUPITER_API_BASE}/tokens/v2/search`,
  PRICE: `${JUPITER_API_BASE}/price/v3`,
  SWAP_ORDER: `${JUPITER_API_BASE}/swap/v2/order`,
  SWAP_EXECUTE: `${JUPITER_API_BASE}/swap/v2/execute`,
  SWAP_BUILD: `${JUPITER_API_BASE}/swap/v2/build`,
  TRIGGER_AUTH_CHALLENGE: `${JUPITER_API_BASE}/trigger/v2/auth/challenge`,
  TRIGGER_AUTH_VERIFY: `${JUPITER_API_BASE}/trigger/v2/auth/verify`,
  TRIGGER_VAULT: `${JUPITER_API_BASE}/trigger/v2/vault`,
  TRIGGER_VAULT_REGISTER: `${JUPITER_API_BASE}/trigger/v2/vault/register`,
  TRIGGER_DEPOSIT: `${JUPITER_API_BASE}/trigger/v2/deposit/craft`,
  TRIGGER_ORDERS: `${JUPITER_API_BASE}/trigger/v2/orders/price`,
  PREDICTION_EVENTS: `${JUPITER_API_BASE}/prediction/v1/events`,
  PREDICTION_ORDERS: `${JUPITER_API_BASE}/prediction/v1/orders`,
  RECURRING_CREATE: `${JUPITER_API_BASE}/recurring/v1/createOrder`,
  RECURRING_EXECUTE: `${JUPITER_API_BASE}/recurring/v1/execute`,
} as const;

export const KNOWN_MINTS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  JupUSD: 'JuprjznTrTSp2UFa3ZBUFgwdAmtZCq4MQCwysN55USD',
  SOL: 'So11111111111111111111111111111111111111112',
} as const;

export const STABLECOIN_MINTS = new Set([
  KNOWN_MINTS.USDC,
  KNOWN_MINTS.USDT,
  KNOWN_MINTS.JupUSD,
]);

export const SOLANA_CHAIN_ID = 'solana';
export const SOLANA_MAINNET_URL = 'https://api.mainnet-beta.solana.com';

export const RATE_LIMITS = {
  DEFAULT_RPS: 1,
  KEYLESS_RPS: 0.5,
  MAX_PRICE_BATCH_SIZE: 50,
  BACKOFF_BASE_MS: 1000,
  BACKOFF_MAX_MS: 16000,
  BACKOFF_JITTER_MS: 500,
  MAX_RETRIES: 3,
  REQUEST_TIMEOUT_MS: 10000,
} as const;

export const DB_DEFAULTS = {
  MAX_EXECUTION_LOG_ROWS: 1000,
} as const;
