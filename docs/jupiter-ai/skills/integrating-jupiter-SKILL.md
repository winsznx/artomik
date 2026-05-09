# Jupiter API Integration (from jup-ag/agent-skills)

Fetched from: https://raw.githubusercontent.com/jup-ag/agent-skills/main/skills/integrating-jupiter/SKILL.md

## Key Facts for Artomik

### Swap
- Base URL: https://api.jup.ag/swap/v2
- Recommended flow: GET /order -> sign -> POST /execute (NOT /build for most cases)
- /build is Metis-only raw instructions
- Rate Limit: 50 req/10s base, volume-based scaling
- Gasless paths available

### Trigger (Limit Orders)
- Base URL: https://api.jup.ag/trigger/v2
- REQUIRES JWT auth via challenge-response (POST /auth/challenge -> sign -> POST /auth/verify)
- Min order: 10 USD
- Order types: single, oco, otoco
- Off-chain custodial vault (Privy)

### Recurring (DCA)
- Base URL: https://api.jup.ag/recurring/v1
- Endpoint: /createOrder (NOT /create as in PRD)
- Fee: 0.1%
- Min 100 USD total, min 2 orders, min 50 USD per order
- Token-2022 NOT supported

### Price
- Base URL: https://api.jup.ag/price/v3
- Max 50 mints per request
- Tokens with unreliable pricing return null or omitted

### Tokens
- Base URL: https://api.jup.ag/tokens/v2
- /search max 100 mints
- Categories: toporganicscore, toptraded, toptrending
- Intervals: 5m, 1h, 6h, 24h

### Prediction Markets
- Base URL: https://api.jup.ag/prediction/v1
- BETA (breaking changes possible)
- GEO-RESTRICTED: US and South Korea IPs blocked
- Price convention: 1,000,000 native units = $1.00
- Deposit mints: JupUSD (JuprjznTrTSp2UFa3ZBUFgwdAmtZCq4MQCwysN55USD), USDC

### Lend
- Base URL: https://api.jup.ag/lend/v1
- SDK: @jup-ag/lend (write), @jup-ag/lend-read (read)
- Flashloan: getFlashloanIx from @jup-ag/lend/flashloan — returns { borrowIx, paybackIx }
- NO flashloan fees

### Rate Limits
- Swap: 50 req/10s base, scales with volume
- Other APIs: managed at portal level
- On 429: exponential backoff with jitter

### Error Codes (Swap Execute)
- 0: Success
- -1: Missing/expired cached order (retryable)
- -2: Invalid signed transaction
- -3: Invalid message bytes
- -1000: Failed landing attempt (retryable)
- -1001: Unknown error (retryable)
- -1002: Invalid transaction
- -1003: Not fully signed
- -1004: Invalid block height (retryable)
- -2000 to -2004: RFQ errors (mixed retryable)
