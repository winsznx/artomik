# PRD V2: Jupiter Autonomous Multi-Vector Yield & Hedging Engine

## Document Purpose

This is the single source of truth for building, testing, and submitting this project. Every phase is scoped for sequential execution in Claude Code. Do not skip phases. Do not combine phases. Each phase has explicit success criteria that must pass before moving forward.

**Submission deadline:** May 11, 2026 (Colosseum Frontier portal). Superteam Earn side track closes May 12.

**Judging weights:**
- DX Report quality: 35%
- AI Stack feedback: 25%
- Technical execution: 25%
- Creativity & ambition: 15%

---

## 1. What We Are Building

An autonomous engine that chains six Jupiter APIs into a single execution loop:

1. **Tokens API** filters assets by organic score and audit flags
2. **Price API** detects volatility anomalies in real-time
3. **Lend API** borrows capital via zero-collateral flashloans
4. **Swap V2 API** (`/build`) executes arbitrage within the same atomic transaction
5. **Trigger API** places OTOCO limit order brackets (entry + TP/SL) as defensive hedging
6. **Prediction Markets API** takes inverse-correlated positions on real-world events
7. **Recurring API** reinvests profits via DCA into high organic-score tokens

The system is split into two processes:
- **Engine** — a persistent Node.js daemon that runs the autonomous loop
- **Dashboard** — a Next.js 14 full-stack web app that visualizes engine state in real-time

They communicate via a shared SQLite database and Server-Sent Events (SSE).

---

## 2. Architecture Overview

### Why Not a Single Next.js App

Next.js API routes run as serverless functions with strict execution timeouts (10-60s depending on host). A continuous, high-frequency trading loop cannot live inside a serverless function. It will timeout and die mid-execution.

**Solution:** Two persistent processes in a monorepo.

```
┌──────────────────────────────────────────────────────────────┐
│                        MONOREPO                              │
│                                                              │
│  ┌─────────────────────┐       ┌────────────────────────┐    │
│  │   apps/engine       │       │   apps/dashboard       │    │
│  │   (Node.js daemon)  │       │   (Next.js 14)         │    │
│  │                     │       │                        │    │
│  │  • Autonomous loop  │       │  • App Router pages    │    │
│  │  • All API calls    │  ───► │  • API routes (read)   │    │
│  │  • Tx assembly      │ SQLite│  • SSE stream endpoin  │    │
│  │  • Broadcasting     │       │  • React components    │    │
│  │  • Writes state     │       │  • Reads state         │    │
│  └─────────────────────┘       └────────────────────────┘    │
│                                                              │
│  ┌─────────────────────┐                                     │
│  │   packages/shared   │                                     │
│  │   • Types           │                                     │
│  │   • Constants       │                                     │
│  │   • DB schema       │                                     │
│  └─────────────────────┘                                     │
└──────────────────────────────────────────────────────────────┘
```

### Why SQLite Over Redis

- Zero infrastructure dependency — no external service to install or manage
- File-based, ships with the repo
- `better-sqlite3` is synchronous and fast enough for this throughput
- Simpler for judges to clone and run

### The 1232-Byte Transaction Limit

Solana transactions have a hard ceiling of 1232 bytes. When composing flashloan borrow + multi-hop swap (potentially spanning 5+ DEXes) + repayment into a single atomic transaction, account keys alone can exceed this limit.

**Solution:** Every transaction MUST use `VersionedTransaction` (v0) with Address Lookup Tables (ALTs).

```typescript
// WRONG — will exceed 1232 bytes on complex routes
const tx = new Transaction();
tx.add(borrowIx, ...swapIxs, repayIx);

// RIGHT — compress account keys via ALTs
const addressLookupTableAccounts = await Promise.all(
  altAddresses.map(addr => connection.getAddressLookupTable(addr))
);
const messageV0 = new TransactionMessage({
  payerKey: wallet.publicKey,
  recentBlockhash,
  instructions: [borrowIx, ...setupIxs, swapIx, cleanupIx, repayIx]
}).compileToV0Message(addressLookupTableAccounts.map(a => a.value));
const tx = new VersionedTransaction(messageV0);
```

The Swap V2 `/build` response includes `addressLookupTableAddresses` — these MUST be fetched and passed into the message compilation. Do not ignore them.

---

## 3. Tech Stack

| Layer | Tool | Version | Why |
|-------|------|---------|-----|
| Runtime | Node.js | 22.14.0 LTS | Native fetch, ESM, stable |
| Language | TypeScript | 5.5+ | Strict mode everywhere |
| Monorepo | npm workspaces | Built-in | No Turborepo overhead for 2 packages |
| Framework | Next.js | 14.x (App Router) | Dashboard only |
| Blockchain | @solana/web3.js | 1.95+ | VersionedTransaction, ALT support |
| Encoding | bs58 | 6.0+ | Base58 for Solana payloads |
| Jupiter SDK | @jup-ag/lend | latest | Flashloan instructions (no REST alternative) |
| Database | better-sqlite3 | 11.x | Engine→Dashboard state sync |
| HTTP | Native fetch | Built-in | No axios |
| CSS | Tailwind CSS | 3.4+ | Utility-first |
| UI Components | shadcn/ui | latest | Modular, themeable |
| Icons | lucide-react | 0.383+ | Clean, consistent |
| Charts | Lightweight Charts | 4.x | Trading-grade price charts |
| Data Fetching | @tanstack/react-query | 5.x | Cache, refetch, SSE integration |
| Client State | Zustand | 4.x | UI-only state (theme, panel toggles) |
| Testing | Vitest | 1.x | Fast, ESM, TS-first |
| Linting | ESLint + Prettier | latest | Consistent style |
| Env | dotenv | 16.x | Env management |
| Tx Sender | Helius Sender | HTTP | Low-latency broadcast |

---

## 4. Project Structure

```
jupiter-yield-engine/
├── package.json                      # Workspace root
├── tsconfig.base.json                # Shared TS config
├── .env.example
├── .gitignore
├── DX-REPORT.md
├── README.md
│
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── types/
│           │   ├── engine.ts               # EngineState, TradeLog, Signal, etc.
│           │   ├── jupiter.ts              # API response types for all endpoints
│           │   └── database.ts             # DB row types
│           ├── constants.ts                # API URLs, chain IDs, known mints
│           ├── db/
│           │   ├── schema.sql              # SQLite table definitions
│           │   └── queries.ts              # Typed query helpers
│           └── index.ts                    # Re-exports
│
├── apps/
│   ├── engine/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts                     # Entry point — starts the loop
│   │       ├── orchestrator.ts             # Main execution loop
│   │       ├── intelligence/
│   │       │   ├── tokenFilter.ts
│   │       │   ├── priceMonitor.ts
│   │       │   └── volatilityDetector.ts
│   │       ├── execution/
│   │       │   ├── flashloan.ts
│   │       │   ├── swapBuilder.ts
│   │       │   ├── txAssembler.ts          # ALT-aware VersionedTransaction builder
│   │       │   └── broadcaster.ts          # Helius primary + RPC fallback
│   │       ├── hedging/
│   │       │   ├── vaultManager.ts
│   │       │   ├── otocoBuilder.ts
│   │       │   ├── marketScanner.ts
│   │       │   ├── correlationEngine.ts
│   │       │   ├── predictionOrderPlacer.ts
│   │       │   └── dcaScheduler.ts
│   │       ├── infra/
│   │       │   ├── jupiterClient.ts        # Unified HTTP + rate limiter
│   │       │   ├── rateLimiter.ts          # Token bucket + exp backoff
│   │       │   ├── errorHandler.ts         # SVM error classification
│   │       │   ├── logger.ts              # Structured JSON logging
│   │       │   ├── config.ts              # Env validation (strict)
│   │       │   └── db.ts                  # SQLite connection + write helpers
│   │       └── types.ts
│   │
│   └── dashboard/
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       └── src/
│           ├── app/
│           │   ├── layout.tsx              # Root layout — theme provider, fonts
│           │   ├── page.tsx                # Dashboard home (redirect to /overview)
│           │   ├── globals.css             # Tailwind base + glassmorphism tokens
│           │   ├── overview/
│           │   │   └── page.tsx            # Main command center view
│           │   ├── signals/
│           │   │   └── page.tsx            # Token watchlist + price feeds
│           │   ├── arbitrage/
│           │   │   └── page.tsx            # Flashloan execution history
│           │   ├── positions/
│           │   │   └── page.tsx            # OTOCO orders + prediction markets
│           │   ├── reinvest/
│           │   │   └── page.tsx            # DCA schedules + performance
│           │   ├── logs/
│           │   │   └── page.tsx            # Full execution log viewer
│           │   ├── settings/
│           │   │   └── page.tsx            # Engine config, wallet info, API status
│           │   └── api/
│           │       ├── state/route.ts      # GET — current engine snapshot from SQLite
│           │       ├── trades/route.ts     # GET — paginated trade history
│           │       ├── signals/route.ts    # GET — current filtered tokens + prices
│           │       ├── positions/route.ts  # GET — active orders + prediction bets
│           │       ├── metrics/route.ts    # GET — latency, uptime, P&L
│           │       └── stream/route.ts     # GET — SSE endpoint for real-time logs
│           │
│           ├── components/
│           │   ├── layout/
│           │   │   ├── Sidebar.tsx
│           │   │   ├── TopBar.tsx
│           │   │   ├── MobileNav.tsx
│           │   │   └── ThemeToggle.tsx
│           │   ├── overview/
│           │   │   ├── StatCards.tsx
│           │   │   ├── PortfolioChart.tsx
│           │   │   ├── RecentTradesTable.tsx
│           │   │   ├── ActivePositions.tsx
│           │   │   └── EngineStatusBadge.tsx
│           │   ├── signals/
│           │   │   ├── TokenTable.tsx
│           │   │   ├── PriceSparkline.tsx
│           │   │   ├── VolatilityBadge.tsx
│           │   │   └── OrganicScoreBar.tsx
│           │   ├── arbitrage/
│           │   │   ├── TradeTimeline.tsx
│           │   │   ├── ProfitLossCard.tsx
│           │   │   ├── FlashloanDetail.tsx
│           │   │   └── TxStatusBadge.tsx
│           │   ├── positions/
│           │   │   ├── OtocoOrderCard.tsx
│           │   │   ├── PredictionCard.tsx
│           │   │   ├── DeltaGauge.tsx
│           │   │   └── SlippageWarning.tsx
│           │   ├── reinvest/
│           │   │   ├── DcaScheduleCard.tsx
│           │   │   ├── TokenAllocationPie.tsx
│           │   │   └── PerformanceChart.tsx
│           │   ├── logs/
│           │   │   ├── LiveTerminal.tsx
│           │   │   ├── LogEntry.tsx
│           │   │   └── LogFilter.tsx
│           │   ├── settings/
│           │   │   ├── EngineControls.tsx
│           │   │   ├── WalletInfo.tsx
│           │   │   ├── ApiKeyStatus.tsx
│           │   │   └── ParameterEditor.tsx
│           │   └── ui/
│           │       ├── GlassCard.tsx        # Glassmorphism container
│           │       ├── GlassPanel.tsx       # Larger glass section wrapper
│           │       ├── StatusDot.tsx
│           │       ├── Skeleton.tsx
│           │       ├── Badge.tsx
│           │       ├── Tooltip.tsx
│           │       └── EmptyState.tsx
│           │
│           ├── hooks/
│           │   ├── useSSE.ts               # SSE subscription hook
│           │   ├── useEngineState.ts        # React Query + SSE merge
│           │   └── useTheme.ts             # Light/dark mode
│           │
│           ├── stores/
│           │   └── uiStore.ts              # Zustand — sidebar open, active panel, filters
│           │
│           └── lib/
│               ├── theme.ts                # Color tokens, glass values
│               ├── formatters.ts           # Currency, time, address truncation
│               └── cn.ts                   # Tailwind class merge utility
│
├── tests/
│   ├── unit/
│   │   ├── tokenFilter.test.ts
│   │   ├── priceMonitor.test.ts
│   │   ├── rateLimiter.test.ts
│   │   ├── errorHandler.test.ts
│   │   ├── swapBuilder.test.ts
│   │   ├── txAssembler.test.ts
│   │   ├── otocoBuilder.test.ts
│   │   └── correlationEngine.test.ts
│   ├── integration/
│   │   ├── signals.test.ts
│   │   ├── swap.test.ts
│   │   ├── trigger.test.ts
│   │   └── simulation.test.ts
│   └── fixtures/
│       ├── tokenResponse.json
│       ├── priceResponse.json
│       ├── priceResponseWithDrops.json     # 43 out of 50 returned
│       ├── swapBuildResponse.json
│       └── otocoResponse.json
│
└── scripts/
    ├── setup.sh
    ├── dev.sh                              # Starts both engine + dashboard
    ├── simulate.ts
    └── checkWallet.ts
```

---

## 5. Environment Configuration

### `.env.example`

```bash
# ──── Solana ────
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PRIVATE_KEY=                              # Base58 encoded. NEVER commit.

# ──── Helius ────
HELIUS_API_KEY=
HELIUS_SENDER_URL=https://mainnet.helius-rpc.com/?api-key=

# ──── Jupiter ────
JUPITER_API_KEY=                          # From portal.jup.ag
JUPITER_API_BASE=https://api.jup.ag

# ──── App ────
NODE_ENV=development
LOG_LEVEL=debug
DASHBOARD_PORT=3000
ENGINE_POLL_INTERVAL_MS=5000

# ──── Database ────
DB_PATH=./data/engine.sqlite

# ──── Engine Parameters ────
VOLATILITY_THRESHOLD_STDDEV=2.0
MIN_ORGANIC_SCORE=60
MAX_PRICE_BATCH_SIZE=50
RATE_LIMIT_RPS=1
FLASHLOAN_ASSET=USDC
SL_SLIPPAGE_BPS=300
MAX_LOSS_PER_24H_USD=5
CIRCUIT_BREAKER_THRESHOLD=3
```

### Config Validation Rules (`apps/engine/src/infra/config.ts`)

Every variable validated at process startup. Missing or malformed = process exits with explicit message. No silent defaults.

| Variable | Validation |
|----------|------------|
| `PRIVATE_KEY` | Valid base58, decodes to exactly 64 bytes |
| `SOLANA_RPC_URL` | Valid URL starting with `https://` |
| `HELIUS_API_KEY` | Non-empty string |
| `JUPITER_API_KEY` | Non-empty string (warn if empty — falls back to 0.5 RPS keyless) |
| `DB_PATH` | Parent directory exists and is writable |
| `VOLATILITY_THRESHOLD_STDDEV` | Positive float > 0 |
| `MIN_ORGANIC_SCORE` | Integer 0-100 |
| `SL_SLIPPAGE_BPS` | Integer > 0, warn if > 500 |
| `MAX_LOSS_PER_24H_USD` | Positive number |
| `CIRCUIT_BREAKER_THRESHOLD` | Integer > 0 |

---

## 6. Database Schema

### `packages/shared/src/db/schema.sql`

```sql
-- Engine state snapshot (single row, updated every cycle)
CREATE TABLE IF NOT EXISTS engine_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'stopped',        -- running | paused | stopped | error
  cycle_count INTEGER NOT NULL DEFAULT 0,
  last_cycle_at TEXT,
  total_pnl_usd REAL NOT NULL DEFAULT 0.0,
  loss_today_usd REAL NOT NULL DEFAULT 0.0,
  loss_reset_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Filtered tokens currently in the watchlist
CREATE TABLE IF NOT EXISTS watched_tokens (
  mint TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  organic_score INTEGER NOT NULL,
  is_sus INTEGER NOT NULL DEFAULT 0,
  mint_authority_disabled INTEGER NOT NULL DEFAULT 1,
  top_holder_concentration REAL,
  current_price_usd REAL,
  price_updated_at TEXT,
  volatility_flag INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every trade attempt (success or failure)
CREATE TABLE IF NOT EXISTS trade_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,                            -- flashloan_arb | otoco | prediction | dca
  status TEXT NOT NULL,                          -- simulated | broadcast | confirmed | failed | reverted
  input_mint TEXT,
  output_mint TEXT,
  input_amount TEXT,
  output_amount TEXT,
  profit_usd REAL,
  tx_signature TEXT,
  compute_units INTEGER,
  error_code TEXT,
  error_message TEXT,
  latency_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Active OTOCO orders
CREATE TABLE IF NOT EXISTS otoco_orders (
  id TEXT PRIMARY KEY,
  input_mint TEXT NOT NULL,
  output_mint TEXT NOT NULL,
  trigger_price_usd REAL NOT NULL,
  tp_price_usd REAL NOT NULL,
  sl_price_usd REAL NOT NULL,
  sl_slippage_bps INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',         -- active | triggered | cancelled | expired
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Prediction market positions
CREATE TABLE IF NOT EXISTS prediction_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id TEXT NOT NULL,
  event_title TEXT NOT NULL,
  is_yes INTEGER NOT NULL,
  deposit_amount INTEGER NOT NULL,
  deposit_mint TEXT NOT NULL,
  current_odds REAL,
  status TEXT NOT NULL DEFAULT 'active',         -- active | settled_win | settled_loss
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DCA schedules
CREATE TABLE IF NOT EXISTS dca_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  input_mint TEXT NOT NULL,
  output_mint TEXT NOT NULL,
  output_symbol TEXT NOT NULL,
  amount_per_cycle TEXT NOT NULL,
  interval TEXT NOT NULL,
  total_cycles INTEGER NOT NULL,
  completed_cycles INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',         -- active | completed | cancelled
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Real-time execution log stream (ringbuffer — keep last 1000)
CREATE TABLE IF NOT EXISTS execution_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,                           -- debug | info | warn | error
  module TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,                                     -- JSON blob
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Trigger to keep execution_log at max 1000 rows
CREATE TRIGGER IF NOT EXISTS trim_execution_log
AFTER INSERT ON execution_log
BEGIN
  DELETE FROM execution_log WHERE id <= (
    SELECT id FROM execution_log ORDER BY id DESC LIMIT 1 OFFSET 1000
  );
END;

-- API metrics
CREATE TABLE IF NOT EXISTS api_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  rate_limited INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 7. API Contract Reference

### 7.1 Tokens API V2

**Endpoint:** `GET https://api.jup.ag/tokens/v2/search`

**Parameters:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `query` | string | yes | Symbol or mint address |
| `tags` | string | no | e.g. `toporganicscore` |

**Filtering Rules (non-negotiable):**
- REJECT if `audit.isSus === true`
- REJECT if `audit.mintAuthorityDisabled === false`
- REJECT if `organicScore < MIN_ORGANIC_SCORE`
- REJECT if `audit.topHolderConcentration > 0.50`
- REJECT if `audit` object is missing entirely
- BYPASS filters for known stablecoin mints: USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`), USDT, JupUSD

### 7.2 Price API V3

**Endpoint:** `GET https://api.jup.ag/price/v3`

**Parameters:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `ids` | string | yes | Comma-separated mints. MAX 50. |
| `showExtraInfo` | boolean | no | Confidence intervals |

**Silent drop handling:**
```typescript
for (const mint of queriedMints) {
  const entry = response.data[mint];
  if (!entry?.price) {
    logger.warn({ module: 'priceMonitor', message: `Silent drop: ${mint}` });
    continue;
  }
  const price = parseFloat(entry.price);
  if (isNaN(price)) {
    logger.warn({ module: 'priceMonitor', message: `NaN price: ${mint}` });
    continue;
  }
}
```

**Rate limit:** Batch max 50. If N > 50, chunk with `1000 / RATE_LIMIT_RPS` ms delay between batches.

### 7.3 Swap V2 — `/build`

**Endpoint:** `GET https://api.jup.ag/swap/v2/build`

**Parameters:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `inputMint` | string | yes | Source token |
| `outputMint` | string | yes | Destination token |
| `amount` | string | yes | Smallest denomination |
| `slippageBps` | number | no | Manual slippage |
| `dynamicSlippage` | boolean | no | RTSE auto-slippage |

**Response includes:**
- `swapInstruction` — base64 encoded
- `setupInstructions` — array
- `cleanupInstruction` — base64
- `addressLookupTableAddresses` — MUST be fetched and used for ALT compression
- `computeUnitLimit`
- `computeUnitPrice`

**Instruction order in atomic tx:**
1. Compute budget instructions (setComputeUnitLimit, setComputeUnitPrice)
2. Flashloan borrow (from Lend SDK)
3. Setup instructions (from `/build`)
4. Swap instruction (from `/build`)
5. Cleanup instruction (from `/build`)
6. Flashloan repayment (from Lend SDK)

**Error matrix:**
| Code | Name | Cause | Action |
|------|------|-------|--------|
| 6001 | SlippageToleranceExceeded | Market moved | Use `dynamicSlippage: true` or increase bps |
| 6008 | NotEnoughAccountKeys | Bad instruction modification | Verify all accounts from `/build` are included |
| 6014 | IncorrectTokenProgramID | Token2022 without proper config | Check token standard pre-route |
| 6017 | ExactOutAmountNotMatched | Flashloan repay slippage | Add buffer to repayment |
| 6024 | InsufficientFunds | Missing priority fees or rent | Pre-calc: amount + priority + rent-exemption |

### 7.4 Lend API (Flashloans)

No REST endpoints for borrow. Must use `@jup-ag/lend` SDK.

**Flow:**
1. Import flashloan builder
2. Specify asset + amount
3. SDK returns `TransactionInstruction[]` for borrow and repay
4. Inject swap instructions between them
5. Compile to `VersionedTransaction` with ALTs
6. Simulate, then broadcast

**Constraint:** Borrow + repay MUST occur in the same transaction block. Cross-block = invalid.

### 7.5 Trigger API V2 (OTOCO)

**Vault setup prerequisite:**
1. `GET /trigger/v2/vault` — check for existing vault
2. If none: create via API flow
3. `POST /trigger/v2/deposit/craft` — returns tx to sign and submit

**Order endpoint:** `POST /trigger/v2/orders/price`

**20% slippage trap:** If `slSlippageBps` is omitted, stop-loss defaults to 2000 bps (20%). Always set explicitly. Engine default: 300 bps.

**Minimum order:** $10 USD equivalent.

**`expiresAt`:** Unix timestamp in milliseconds. Must be future.

### 7.6 Prediction Markets API V1

**Events:** `GET /prediction/v1/events?category=crypto`

**Orders:** `POST /prediction/v1/orders`

```json
{
  "ownerPubkey": "...",
  "marketId": "...",
  "depositMint": "JupUSD or USDC mint",
  "depositAmount": 2000000,
  "isBuy": true,
  "isYes": false
}
```

**Amount format:** Native units. $2.00 = `2000000`.

### 7.7 Recurring API (DCA)

**Endpoint:** `POST /recurring/v1/create`

**Parameters:** `inputMint`, `outputMint`, `amount`, `interval` (`hourly`|`daily`|`weekly`), `totalCycles`

**Token selection:** Top 3 by organic score, all passing audit filters. Equal allocation.

---

## 8. Shared Infrastructure Specs

### 8.1 Jupiter HTTP Client

Single client wrapping all Jupiter calls:
- Attaches `x-api-key` header if key exists
- Token bucket rate limiting
- Exponential backoff with jitter on 429: `min(2^attempt * 1000 + random(0,500), 16000)` ms
- Structured logging per request/response
- 10s timeout per request
- Max 3 retries with schedule `[1s, 2s, 4s]`
- Records every call to `api_metrics` table

### 8.2 Error Handler

```typescript
enum ErrorCategory {
  RATE_LIMITED = 'RATE_LIMITED',
  SLIPPAGE = 'SLIPPAGE',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT',
  ACCOUNT_KEYS = 'ACCOUNT_KEYS',
  TOKEN_PROGRAM = 'TOKEN_PROGRAM',
  SIMULATION_FAILED = 'SIM_FAILED',
  TX_SIZE_EXCEEDED = 'TX_SIZE',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN'
}
```

Every error logged with: timestamp (ISO 8601), category, raw code + message, endpoint, redacted payload, suggested action.

### 8.3 Logger

Structured JSON. No `console.log` anywhere.

```typescript
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  module: string;
  message: string;
  data?: Record<string, unknown>;
}
```

Every log entry is also written to the `execution_log` table so the dashboard SSE stream can pick it up.

### 8.4 Transaction Broadcaster

Two-tier broadcast:
1. **Primary:** Helius Sender — serialize `VersionedTransaction` to base58, POST
2. **Fallback:** Standard RPC `sendRawTransaction`

Flow:
1. Serialize tx → base58
2. POST to Helius, timeout 5s
3. If error or timeout → retry once
4. If second fail → fallback to RPC
5. Log which path succeeded, latency

### 8.5 Transaction Assembler (ALT-Aware)

```typescript
async function assembleAtomicTx(params: {
  borrowIx: TransactionInstruction;
  setupIxs: TransactionInstruction[];
  swapIx: TransactionInstruction;
  cleanupIx: TransactionInstruction;
  repayIx: TransactionInstruction;
  altAddresses: string[];
  payer: PublicKey;
  connection: Connection;
}): Promise<VersionedTransaction> {
  // 1. Fetch ALTs from addresses provided by /build
  const altAccounts = await Promise.all(
    params.altAddresses.map(addr =>
      params.connection.getAddressLookupTable(new PublicKey(addr))
    )
  );
  const validAlts = altAccounts
    .map(a => a.value)
    .filter((a): a is AddressLookupTableAccount => a !== null);

  // 2. Build compute budget instructions
  const computeIxs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 })
  ];

  // 3. Compile to V0 message with ALTs
  const { blockhash } = await params.connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: params.payer,
    recentBlockhash: blockhash,
    instructions: [
      ...computeIxs,
      params.borrowIx,
      ...params.setupIxs,
      params.swapIx,
      params.cleanupIx,
      params.repayIx
    ]
  }).compileToV0Message(validAlts);

  return new VersionedTransaction(message);
}
```

---

## 9. Dashboard Routes & Screens

### 9.1 Route Map

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Redirect to `/overview` | Entry point |
| `/overview` | Command Center | At-a-glance: P&L, engine status, recent trades, active positions |
| `/signals` | Token Watchlist | Filtered tokens, prices, volatility flags, organic scores |
| `/arbitrage` | Execution History | Flashloan trade timeline, profit/loss per trade, tx links |
| `/positions` | Active Positions | OTOCO orders, prediction market bets, delta gauge |
| `/reinvest` | DCA Manager | Active DCA schedules, allocation pie, performance over time |
| `/logs` | Live Terminal | Real-time execution log stream with filters |
| `/settings` | Configuration | Wallet info, API key status, engine parameters, start/stop |

---

## 10. Design System

### 10.1 Theme Architecture

The dashboard supports **light mode** and **dark mode** with a toggle in the top bar. Theme preference persists to `localStorage`. Default: dark mode (matches the trading terminal aesthetic).

**Color Tokens (CSS Custom Properties):**

```css
:root {
  /* ── Light Mode ── */
  --bg-base: #f8f9fc;
  --bg-surface: rgba(255, 255, 255, 0.60);
  --bg-surface-hover: rgba(255, 255, 255, 0.80);
  --bg-elevated: rgba(255, 255, 255, 0.75);
  --bg-terminal: #1a1b23;

  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-default: rgba(0, 0, 0, 0.10);
  --border-focus: #6366f1;

  --text-primary: #0f1117;
  --text-secondary: #5b5e6e;
  --text-tertiary: #9194a1;
  --text-on-dark: #e4e5eb;

  --accent-primary: #6366f1;          /* Indigo — main actions */
  --accent-success: #10b981;          /* Emerald — profit, confirmed */
  --accent-warning: #f59e0b;          /* Amber — caution, pending */
  --accent-danger: #ef4444;           /* Red — loss, error, critical */
  --accent-info: #06b6d4;             /* Cyan — neutral data, info */

  /* ── Glassmorphism ── */
  --glass-bg: rgba(255, 255, 255, 0.45);
  --glass-border: rgba(255, 255, 255, 0.50);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
  --glass-blur: 16px;

  /* ── Shadows ── */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.08);

  /* ── Radii ── */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
}

[data-theme="dark"] {
  --bg-base: #0c0d12;
  --bg-surface: rgba(22, 24, 33, 0.70);
  --bg-surface-hover: rgba(30, 33, 45, 0.80);
  --bg-elevated: rgba(28, 31, 43, 0.85);
  --bg-terminal: #0a0b0f;

  --border-subtle: rgba(255, 255, 255, 0.04);
  --border-default: rgba(255, 255, 255, 0.08);
  --border-focus: #818cf8;

  --text-primary: #e4e5eb;
  --text-secondary: #9194a1;
  --text-tertiary: #5b5e6e;
  --text-on-dark: #e4e5eb;

  --accent-primary: #818cf8;

  --glass-bg: rgba(22, 24, 33, 0.50);
  --glass-border: rgba(255, 255, 255, 0.06);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.30);
  --glass-blur: 20px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.20);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.30);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.40);
}
```

### 10.2 Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Display / headings | **Space Grotesk** | 600-700 | 24-32px |
| Body / labels | **Geist Sans** | 400-500 | 13-16px |
| Data / numbers / terminal | **JetBrains Mono** | 400-500 | 12-14px |

Import via `next/font/google` for zero layout shift.

**Update:** If Space Grotesk feels generic, substitute with **Instrument Sans** or **Plus Jakarta Sans** for headings. The key is a geometric sans with personality that pairs cleanly with the mono data font.

### 10.3 Glassmorphism Components

**GlassCard** — the primary container for all dashboard panels:

```css
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
  transition: all 0.2s ease;
}

.glass-card:hover {
  background: var(--bg-surface-hover);
  box-shadow: var(--shadow-md);
}
```

**GlassPanel** — larger section wrapper (sidebar, main content area):

```css
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(calc(var(--glass-blur) * 1.25));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) * 1.25));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--glass-lg);
}
```

**Background treatment:**
- Light mode: subtle gradient mesh background — layered radial gradients with low opacity indigo and cyan
- Dark mode: deep near-black base with very faint gradient orbs in the corners (indigo, cyan at 3-5% opacity) to give depth without distraction

```css
body {
  background: var(--bg-base);
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.05) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(6, 182, 212, 0.04) 0%, transparent 50%);
}
```

### 10.4 Component Patterns

**StatusDot** — engine status indicator:
- `running` → pulsing emerald dot with glow
- `paused` → static amber dot
- `stopped` → static gray dot
- `error` → pulsing red dot with glow

**Badge** — contextual labels:
- Filled variant for status (confirmed, failed, active)
- Outlined variant for categories (flashloan, otoco, prediction, dca)
- Colors match accent tokens

**Skeleton** — loading states:
- Every data panel shows skeleton loaders while SSE connection initializes
- Skeleton uses `var(--bg-surface)` with a shimmer animation
- Skeletons match the exact shape of the loaded content (no generic rectangles)

**EmptyState** — when no data exists:
- Centered illustration (simple SVG) + message + action button
- e.g. "No trades yet. Engine is warming up." with a muted icon

---

## 11. Screen-by-Screen Specification

### 11.1 Layout Shell

**Desktop (≥1024px):**

```
┌──────────────────────────────────────────────────────────┐
│  TopBar (h-14)                                           │
│  ┌────┬────────────────────┬───────────────────────────┐ │
│  │Logo│  Route breadcrumb   │  Theme toggle · Wallet ·  │ │
│  │    │                     │  Engine status badge      │ │
│  └────┴────────────────────┴───────────────────────────┘ │
├─────────┬────────────────────────────────────────────────┤
│ Sidebar │  Main Content Area                             │
│ (w-64)  │                                                │
│ ┌─────┐ │  (page-specific content)                       │
│ │ Nav │ │                                                │
│ │items│ │                                                │
│ │     │ │                                                │
│ │     │ │                                                │
│ │     │ │                                                │
│ └─────┘ │                                                │
│         │                                                │
│ Engine  │                                                │
│ Status  │                                                │
│ Mini    │                                                │
└─────────┴────────────────────────────────────────────────┘
```

- Sidebar: GlassPanel, fixed position, scrollable if nav items overflow
- Sidebar nav items: icon + label, active state with accent background
- Sidebar bottom: compact engine status (status dot + P&L + uptime)
- Main content: padded container with max-width 1440px

**Mobile (<1024px):**

```
┌────────────────────────────┐
│ TopBar                     │
│ ┌────┬──────────┬────────┐ │
│ │ ☰  │   Logo   │ Theme  │ │
│ └────┴──────────┴────────┘ │
├────────────────────────────┤
│                            │
│   Main Content             │
│   (stacked, full width,    │
│    16px side padding)      │
│                            │
├────────────────────────────┤
│ Bottom Nav (h-16)          │
│ ┌──┬──┬──┬──┬──┐          │
│ │OV│SG│AR│PS│LG│          │
│ └──┴──┴──┴──┴──┘          │
└────────────────────────────┘
```

- Hamburger menu opens sidebar as a slide-over overlay with backdrop blur
- Bottom navigation bar with 5 most important routes (Overview, Signals, Arbitrage, Positions, Logs)
- Settings accessible via hamburger only
- All GlassCards stack vertically with 12px gap

### 11.2 `/overview` — Command Center

**Purpose:** At-a-glance snapshot of everything. A judge should understand the engine's current state in 5 seconds.

**Desktop Layout:**

```
┌────────────────────────────────────────────────────────┐
│  STAT CARDS ROW (4 cards, equal width)                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐     │
│  │Total P&L│ │Active   │ │Trades   │ │Engine    │     │
│  │$12.45   │ │Positions│ │Today    │ │Uptime    │     │
│  │+2.3%    │ │    4    │ │   17    │ │ 4h 23m   │     │
│  └─────────┘ └─────────┘ └─────────┘ └──────────┘     │
├──────────────────────────────┬─────────────────────────┤
│  PORTFOLIO CHART             │  ACTIVE POSITIONS        │
│  (Lightweight Charts)        │                         │
│  ┌──────────────────────┐    │  ┌─────────────────┐    │
│  │                      │    │  │ SOL OTOCO Long   │    │
│  │   Equity curve       │    │  │ Entry: $172      │    │
│  │   over time          │    │  │ TP: $190 SL:$160 │    │
│  │                      │    │  ├─────────────────┤    │
│  │                      │    │  │ BTC Pred Market  │    │
│  │                      │    │  │ YES @ $0.62      │    │
│  └──────────────────────┘    │  └─────────────────┘    │
├──────────────────────────────┴─────────────────────────┤
│  RECENT TRADES TABLE                                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Time    │ Type      │ Pair     │ P&L   │ Status   │ │
│  │ 2:45pm  │ Flashloan │ SOL/USDC│ +$0.23│ ✓ Conf   │ │
│  │ 2:41pm  │ OTOCO     │ SOL/USDC│  —    │ ● Active │ │
│  │ 2:38pm  │ Flashloan │ JUP/USDC│ -$0.05│ ✗ Revert │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

**Mobile Layout:**
Stacked vertically: Stat Cards (2×2 grid) → Portfolio Chart (full width) → Active Positions (horizontal scroll cards) → Recent Trades (simplified, last 5)

**Component Details:**

**StatCards:**
- Each card: GlassCard
- Primary metric: large JetBrains Mono, bold
- Sub-metric: smaller, colored (green if positive, red if negative)
- Subtle icon top-right (lucide)
- Hover: slight lift + shadow increase

**PortfolioChart:**
- Lightweight Charts line/area chart
- Dark: green area fill on dark bg. Light: indigo area fill on white.
- Tooltip on hover showing exact value + timestamp
- Time range selector: 1H | 6H | 24H | 7D | ALL

**ActivePositions:**
- Compact cards in a vertical list
- Each shows: type badge (OTOCO, Prediction, DCA), key prices, status dot
- OTOCO card shows a mini price scale with entry/TP/SL markers

**RecentTradesTable:**
- Sortable columns
- Status column uses StatusDot + text
- Profit column: green text for positive, red for negative
- TX signature column: truncated address, click to copy or open on Solscan
- Pagination: load more button, not page numbers

### 11.3 `/signals` — Token Watchlist

**Purpose:** See exactly which tokens passed the filter, their current prices, volatility status, and organic scores.

**Desktop Layout:**

```
┌────────────────────────────────────────────────────────┐
│  HEADER: Token Watchlist          [Refresh] [Filters ▼]│
├────────────────────────────────────────────────────────┤
│  TOKEN TABLE                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │Token      │ Price    │ 24h     │ OrgScore │ Vol  │   │
│  ├───────────┼─────────┼─────────┼──────────┼──────┤   │
│  │☀ SOL      │ $178.45 │ +3.2%   │ ██████95│  ⚡  │   │
│  │  Solana   │         │ spark~~ │          │      │   │
│  ├───────────┼─────────┼─────────┼──────────┼──────┤   │
│  │◆ JUP      │ $1.23   │ -1.1%   │ █████ 82│  —   │   │
│  │  Jupiter  │         │ spark~~ │          │      │   │
│  └──────────────────────────────────────────────────┘   │
├──────────────────────────┬─────────────────────────────┤
│  PRICE DETAIL (selected) │  AUDIT DETAIL (selected)    │
│  ┌──────────────────┐    │  ┌───────────────────────┐  │
│  │  Price chart      │    │  │ isSus: false ✓        │  │
│  │  (sparkline       │    │  │ Mint auth: disabled ✓ │  │
│  │   expanded)       │    │  │ Freeze: disabled ✓    │  │
│  │                   │    │  │ Top holders: 12% ✓    │  │
│  └──────────────────┘    │  └───────────────────────┘  │
└──────────────────────────┴─────────────────────────────┘
```

**Mobile Layout:**
- Token table becomes a card list (one card per token)
- Each card shows: icon, symbol, price, 24h change, organic score bar
- Tap card to expand and show audit details inline

**Component Details:**

**OrganicScoreBar:**
- Horizontal bar chart, 0-100 scale
- Fill color: <40 red, 40-70 amber, >70 emerald
- Number displayed at end of bar

**VolatilityBadge:**
- Lightning bolt icon when volatility flag is active
- Dash when normal
- Pulsing animation on active

**PriceSparkline:**
- Tiny inline line chart (last 20 observations)
- Green if trending up, red if down
- Expand on row click to show full chart

### 11.4 `/arbitrage` — Execution History

**Purpose:** Full timeline of every flashloan arbitrage attempt.

**Desktop Layout:**

```
┌────────────────────────────────────────────────────────┐
│  SUMMARY BAR                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Total Arbs│ │Success % │ │Net Profit│ │Avg CU    │  │
│  │    42    │ │   71%    │ │  $8.23   │ │  312K    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├────────────────────────────────────────────────────────┤
│  TRADE TIMELINE (vertical)                              │
│                                                         │
│  ● 2:45 PM ─── Flashloan Arb ──────────────────────── │
│  │  SOL → USDC → SOL via Raydium → Orca               │
│  │  Borrowed: 50 USDC | Returned: 50 USDC              │
│  │  Profit: +$0.23 | CU: 298,412                       │
│  │  Tx: 4Kx7...9fRm [copy] [solscan]                   │
│  │  Status: ✓ Confirmed                                │
│  │                                                      │
│  ● 2:41 PM ─── Flashloan Arb ──────────────────────── │
│  │  JUP → USDC → JUP via Meteora → Phoenix             │
│  │  Status: ✗ Simulation Failed — 6001 Slippage         │
│  │  Action taken: Skipped broadcast                     │
│  │                                                      │
│  ● 2:38 PM ─── Flashloan Arb ──────────────────────── │
│  │  ...                                                 │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**Mobile Layout:**
- Summary bar: 2×2 grid of stat cards
- Timeline: full width, cards with less detail, tap to expand

**Component Details:**

**TradeTimeline:**
- Vertical timeline with connected dots
- Green dot: confirmed. Red dot: failed/reverted. Amber dot: simulated only.
- Each entry is a GlassCard attached to the timeline
- Expanded view shows full instruction breakdown

**FlashloanDetail (expanded):**
- Route visualization: token icons connected by arrows
- Borrow/repay amounts side by side
- Compute units bar (visual, showing % of 400K budget used)
- Error details if failed (code, message, suggested action)

### 11.5 `/positions` — Active Positions

**Purpose:** All open OTOCO orders and prediction market bets in one view.

**Desktop Layout:**

```
┌────────────────────────────────────────────────────────┐
│  DELTA GAUGE (center)                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │           Net Portfolio Delta: -0.03                │ │
│  │     ◄───────────────●──────────────────►           │ │
│  │    -1.0         neutral          +1.0              │ │
│  │    (fully hedged)       (fully exposed)            │ │
│  └────────────────────────────────────────────────────┘ │
├──────────────────────────┬─────────────────────────────┤
│  OTOCO ORDERS            │  PREDICTION POSITIONS        │
│  ┌──────────────────┐    │  ┌───────────────────────┐  │
│  │ SOL Long Entry   │    │  │ "SOL below $150      │  │
│  │ ┌──────────────┐ │    │  │  by June 2026"       │  │
│  │ │ TP: $190.00  │ │    │  │                       │  │
│  │ │ ━━━●━━━━━━━━ │ │    │  │  Position: YES       │  │
│  │ │ Entry: $172  │ │    │  │  Cost: $2.00          │  │
│  │ │ ━━━━━━━●━━━━ │ │    │  │  Current odds: 0.38  │  │
│  │ │ SL: $160.00  │ │    │  │  Potential: $5.26     │  │
│  │ │ Slip: 300bps │ │    │  │  Status: ● Active     │  │
│  │ └──────────────┘ │    │  └───────────────────────┘  │
│  │ Status: ● Active │    │                              │
│  │ Expires: 48h     │    │  ┌───────────────────────┐  │
│  └──────────────────┘    │  │ "Fed rate cut by      │  │
│                          │  │  July 2026"           │  │
│  ┌──────────────────┐    │  │  ...                   │  │
│  │ JUP Short Entry  │    │  └───────────────────────┘  │
│  │ ...               │    │                              │
│  └──────────────────┘    │                              │
└──────────────────────────┴─────────────────────────────┘
```

**Mobile Layout:**
- Delta gauge: full width, compact
- Tabs: "Orders" | "Markets" — swipe between
- Cards stack vertically

**Component Details:**

**DeltaGauge:**
- Horizontal bar, -1.0 to +1.0 scale
- Indicator dot shows current net delta
- Left region (teal): hedged. Right region (amber): exposed. Center (green): neutral.
- Tooltip explaining what delta means

**OtocoOrderCard:**
- Visual price scale with three markers (SL, Entry, TP)
- Current price indicator as a moving line
- Slippage warning if `slSlippageBps > 500`: amber banner inside card
- Expiry countdown timer

**PredictionCard:**
- Event title in bold
- YES/NO position badge
- Cost vs potential payout
- Current odds progress bar
- Settlement status

### 11.6 `/reinvest` — DCA Manager

**Purpose:** Track how profits are being reinvested via DCA.

**Desktop Layout:**

```
┌────────────────────────────────────────────────────────┐
│  ALLOCATION PIE        │  PERFORMANCE CHART             │
│  ┌───────────────┐     │  ┌──────────────────────────┐ │
│  │     ╱ SOL ╲    │     │  │                          │ │
│  │   ╱  35%    ╲  │     │  │   Cumulative DCA value   │ │
│  │  │  JUP 30%  │ │     │  │   vs cost basis          │ │
│  │   ╲ BONK 35%╱  │     │  │                          │ │
│  │     ╲______╱   │     │  └──────────────────────────┘ │
│  └───────────────┘     │                                │
├────────────────────────┴────────────────────────────────┤
│  DCA SCHEDULES                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Token  │ Per Cycle │ Interval │ Progress  │ Status │ │
│  │ SOL    │ $1.67     │ Daily    │ ███░░ 3/7 │Active  │ │
│  │ JUP    │ $1.43     │ Daily    │ █████ 7/7 │Done    │ │
│  │ BONK   │ $1.67     │ Daily    │ ██░░░ 2/7 │Active  │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

**Mobile Layout:**
- Pie chart: full width, tappable segments
- Performance chart below
- Schedule cards stacked

### 11.7 `/logs` — Live Terminal

**Purpose:** Real-time execution log viewer. The debug window for the judge to see the engine thinking.

**Desktop Layout:**

```
┌────────────────────────────────────────────────────────┐
│  LOG FILTERS                                            │
│  [All] [Info] [Warn] [Error] │ Module: [All ▼] │[Clear]│
├────────────────────────────────────────────────────────┤
│  TERMINAL                                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 14:45:02.331 INFO  priceMonitor                    │ │
│  │   Polled 47/50 tokens (3 silently dropped)         │ │
│  │                                                     │ │
│  │ 14:45:02.892 WARN  priceMonitor                    │ │
│  │   Silent drop: 7xKXt...mint — removed from loop    │ │
│  │                                                     │ │
│  │ 14:45:03.104 INFO  volatilityDetector              │ │
│  │   SOL σ=2.31 — ANOMALY DETECTED                    │ │
│  │                                                     │ │
│  │ 14:45:03.205 INFO  flashloan                       │ │
│  │   Attempting 50 USDC borrow via Lend SDK            │ │
│  │                                                     │ │
│  │ 14:45:03.891 INFO  swapBuilder                     │ │
│  │   Route: SOL→USDC via Raydium (3 hops, 4 ALTs)     │ │
│  │                                                     │ │
│  │ 14:45:04.102 INFO  txAssembler                     │ │
│  │   VersionedTransaction: 1087 bytes (under 1232)     │ │
│  │                                                     │ │
│  │ 14:45:04.300 INFO  broadcaster                     │ │
│  │   Simulating... OK (298,412 CU)                     │ │
│  │                                                     │ │
│  │ 14:45:04.501 INFO  broadcaster                     │ │
│  │   Broadcasting via Helius... confirmed in 1.2s      │ │
│  │                                                     │ │
│  │ 14:45:04.510 INFO  orchestrator                    │ │
│  │   Cycle 42 complete. Profit: +$0.23. Next in 5s.    │ │
│  │ ▌                                                   │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

**Styling:**
- Terminal: `var(--bg-terminal)` background (near-black in both themes)
- Text: monospace (`JetBrains Mono`), 12px
- Color coding: INFO=cyan, WARN=amber, ERROR=red, DEBUG=gray
- Auto-scroll to bottom with smooth animation
- Click any log entry to expand and see the full `data` JSON blob
- Search/filter by text in real-time

**Mobile Layout:**
- Full-screen terminal experience
- Filters collapse into a dropdown
- Swipe down to pause auto-scroll

### 11.8 `/settings` — Configuration

**Purpose:** Engine control panel. Start, stop, view wallet, check API status.

**Desktop Layout:**

```
┌────────────────────────────────────────────────────────┐
│  ENGINE CONTROLS                                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Status: ● Running          [Pause] [Stop]         │ │
│  │  Uptime: 4h 23m 12s                                │ │
│  │  Cycles: 284                                        │ │
│  │  Loss today: $0.42 / $5.00 cap                     │ │
│  └────────────────────────────────────────────────────┘ │
├──────────────────────────┬─────────────────────────────┤
│  WALLET INFO             │  API STATUS                  │
│  ┌──────────────────┐    │  ┌───────────────────────┐  │
│  │ Address:          │    │  │ Jupiter API  ● Online │  │
│  │ 4Kx7...9fRm      │    │  │ Key: ****...xK2m     │  │
│  │ [copy] [solscan]  │    │  │ Tier: Free (1 RPS)   │  │
│  │                   │    │  │ Calls today: 2,341   │  │
│  │ SOL: 0.5432       │    │  │ 429s today: 12       │  │
│  │ USDC: 14.23       │    │  ├───────────────────────┤  │
│  │ JupUSD: 5.00      │    │  │ Helius RPC   ● Online │  │
│  └──────────────────┘    │  │ Latency: 45ms avg    │  │
│                          │  ├───────────────────────┤  │
│                          │  │ Solana RPC   ● Online │  │
│                          │  │ Slot: 284,123,456     │  │
│                          │  └───────────────────────┘  │
├──────────────────────────┴─────────────────────────────┤
│  PARAMETERS                                             │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Volatility Threshold (σ):  [2.0    ]               │ │
│  │ Min Organic Score:         [60     ]               │ │
│  │ SL Slippage (bps):         [300    ]               │ │
│  │ Max Daily Loss ($):        [5.00   ]               │ │
│  │ Poll Interval (ms):        [5000   ]               │ │
│  │                                  [Save & Restart]  │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

**Mobile Layout:**
- All sections stack vertically
- Parameter editor: full-width inputs
- Buttons: full-width, large touch targets

---

## 12. Server-Sent Events (SSE) Specification

### Dashboard SSE Endpoint: `apps/dashboard/src/app/api/stream/route.ts`

The SSE endpoint reads from the `execution_log` table and streams new entries to connected clients.

**Implementation:**

```typescript
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let lastId = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Poll SQLite for new log entries every 500ms
      const interval = setInterval(async () => {
        try {
          const newEntries = db.prepare(
            'SELECT * FROM execution_log WHERE id > ? ORDER BY id ASC LIMIT 50'
          ).all(lastId);

          for (const entry of newEntries) {
            send(entry);
            lastId = entry.id;
          }
        } catch (err) {
          send({ level: 'error', module: 'sse', message: 'Poll failed' });
        }
      }, 500);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### Client-Side SSE Hook: `apps/dashboard/src/hooks/useSSE.ts`

```typescript
function useSSE(url: string) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource(url);
    source.onopen = () => setConnected(true);
    source.onmessage = (event) => {
      const entry = JSON.parse(event.data);
      setLogs(prev => [...prev.slice(-999), entry]); // Keep last 1000 in memory
    };
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, [url]);

  return { logs, connected };
}
```

---

## 13. Build Phases

### Phase 1: Monorepo Scaffold + Shared Package + Database

**What to build:**
- Initialize npm workspace with `apps/engine`, `apps/dashboard`, `packages/shared`
- Create `tsconfig.base.json` and per-package `tsconfig.json`
- Implement `packages/shared/src/db/schema.sql`
- Implement `packages/shared/src/db/queries.ts` with typed helpers
- Implement `packages/shared/src/types/` (all type definitions)
- Implement `packages/shared/src/constants.ts`
- Create `.env.example`, `.gitignore`
- Create `scripts/setup.sh` and `scripts/dev.sh`

**Dependencies:**
```bash
# Root
npm init -w apps/engine -w apps/dashboard -w packages/shared

# Shared
cd packages/shared && npm install better-sqlite3
npm install -D @types/better-sqlite3

# Engine
cd apps/engine && npm install @solana/web3.js bs58 dotenv @jup-ag/lend
npm install -D typescript @types/node vitest

# Dashboard
cd apps/dashboard && npx create-next-app@14 . --typescript --tailwind --app --src-dir
npm install @tanstack/react-query zustand lucide-react lightweight-charts
npm install -D @types/better-sqlite3
# Install shadcn/ui components as needed
```

**Success Criteria:**
- `npm run dev` from root starts both engine and dashboard
- SQLite database creates all tables on first run
- Shared types import correctly in both apps
- Logger writes to stdout AND to `execution_log` table

---

### Phase 2: Engine Infrastructure — HTTP Client + Rate Limiter + Error Handler + Config

**What to build:**
- `apps/engine/src/infra/config.ts`
- `apps/engine/src/infra/logger.ts`
- `apps/engine/src/infra/db.ts`
- `apps/engine/src/infra/jupiterClient.ts`
- `apps/engine/src/infra/rateLimiter.ts`
- `apps/engine/src/infra/errorHandler.ts`

**Testing:**
- Unit: rate limiter throttles to configured RPS
- Unit: rate limiter backs off exponentially on 429
- Unit: error handler classifies all 7 SVM error codes
- Unit: config validation rejects bad private key format
- Integration: real keyless request to Price API returns SOL price

**Success Criteria:**
- All unit tests pass
- Integration test returns live data
- Config rejects invalid env

---

### Phase 3: Signal Layer — Token Filtering + Price Monitoring + Volatility Detection

**What to build:**
- `apps/engine/src/intelligence/tokenFilter.ts`
- `apps/engine/src/intelligence/priceMonitor.ts`
- `apps/engine/src/intelligence/volatilityDetector.ts`

**Testing:**
- Unit: rejects `isSus: true`
- Unit: rejects missing audit object
- Unit: allows whitelisted stablecoins
- Unit: handles 43-of-50 price response without crash
- Unit: volatility fires on > 2σ, silent on normal fluctuation
- Integration: fetch live `toporganicscore` tokens

**Success Criteria:**
- Clean filtered token list
- Prices polled without crash on silent drops
- Volatility signals fire correctly

---

### Phase 4: Execution Core — Flashloan + Swap V2 + ALT-Aware Tx Assembly + Broadcasting

**What to build:**
- `apps/engine/src/execution/flashloan.ts`
- `apps/engine/src/execution/swapBuilder.ts`
- `apps/engine/src/execution/txAssembler.ts` (with ALT compression)
- `apps/engine/src/execution/broadcaster.ts`

**Critical Rules:**
- Use `/build` NOT `/order`
- Fetch and use `addressLookupTableAddresses` from `/build` response
- Compile to `VersionedTransaction` V0 with ALTs
- Always simulate before broadcast
- Start with tiny amounts (0.01 USDC)
- Log tx size in bytes — must be < 1232

**Testing:**
- Unit: tx assembler fetches ALTs and compiles V0 message
- Unit: instruction ordering matches spec
- Integration: call `/build` for SOL→USDC, parse response
- Integration: simulate a small tx, log result

**Success Criteria:**
- Valid VersionedTransaction under 1232 bytes
- Simulation returns meaningful result
- Broadcaster sends to Helius with RPC fallback

---

### Phase 5: Hedging Layer — OTOCO + Prediction Markets + DCA

**What to build:**
- `apps/engine/src/hedging/vaultManager.ts`
- `apps/engine/src/hedging/otocoBuilder.ts`
- `apps/engine/src/hedging/marketScanner.ts`
- `apps/engine/src/hedging/correlationEngine.ts`
- `apps/engine/src/hedging/predictionOrderPlacer.ts`
- `apps/engine/src/hedging/dcaScheduler.ts`

**Rules:**
- Always set `slSlippageBps` explicitly
- Always set `expiresAt` as future timestamp
- Prediction deposits in native units ($2 = 2000000)
- DCA targets top 3 organic-score tokens

**Testing:**
- Unit: OTOCO always includes slSlippageBps
- Unit: rejects expired expiresAt
- Unit: correlation engine matches inverse events
- Unit: DCA splits equally across 3 tokens
- Integration: fetch live prediction markets

**Success Criteria:**
- OTOCO orders constructed safely (no 20% default)
- Prediction market orders formatted correctly
- DCA schedules target only audit-passing tokens

---

### Phase 6: Orchestrator — Main Engine Loop

**What to build:**
- `apps/engine/src/orchestrator.ts`
- `apps/engine/src/main.ts`

**Loop (see Section 2 architecture diagram):**
1. Refresh tokens + poll prices
2. Check volatility
3. If anomaly: simulate arb → if profitable broadcast → place OTOCO → check prediction markets → hedge if match
4. If profit: schedule DCA
5. Sleep for interval
6. Log metrics
7. Check safety guardrails

**Guardrails:**
- Max $5/day loss cap
- Circuit breaker: 3 consecutive failures → pause
- All txs simulate first
- Pause/resume via writing to engine_state table

**Testing:**
- Unit: orchestrator respects loss cap
- Unit: circuit breaker triggers on 3 failures
- Integration: run one full cycle in simulation mode

**Success Criteria:**
- Complete cycle without crash
- Guardrails prevent runaway losses
- All state written to SQLite

---

### Phase 7: Dashboard API Routes + SSE

**What to build:**
- All routes under `apps/dashboard/src/app/api/`
- SSE stream endpoint
- React Query provider setup

**Routes:**
| Route | Method | Returns |
|-------|--------|---------|
| `/api/state` | GET | Current engine_state row |
| `/api/trades` | GET | Paginated trade_logs |
| `/api/signals` | GET | watched_tokens rows |
| `/api/positions` | GET | otoco_orders + prediction_positions |
| `/api/metrics` | GET | Aggregated api_metrics |
| `/api/stream` | GET | SSE stream of execution_log |

**Success Criteria:**
- All routes return valid JSON
- SSE stream delivers new log entries within 500ms
- React Query hooks fetch and cache correctly

---

### Phase 8: Dashboard UI — Layout + Theme + Core Components

**What to build:**
- Layout shell (Sidebar, TopBar, MobileNav, ThemeToggle)
- GlassCard, GlassPanel, StatusDot, Badge, Skeleton, EmptyState
- Theme system (light/dark toggle, CSS variables, localStorage persistence)
- Background gradient treatment

**Design enforcement:**
- Import fonts via `next/font/google`
- All containers use GlassCard or GlassPanel
- No hard-coded colors — everything via CSS variables
- Skeleton loaders on every panel
- Responsive breakpoint at 1024px

**Success Criteria:**
- Theme toggle switches all colors correctly
- Layout renders correctly at 1440px, 1024px, 768px, 375px
- Glass effect visible with backdrop blur
- Skeletons show while data loads

---

### Phase 9: Dashboard UI — All Page Screens

**What to build:**
- `/overview` with StatCards, PortfolioChart, ActivePositions, RecentTradesTable
- `/signals` with TokenTable, PriceSparkline, OrganicScoreBar, VolatilityBadge
- `/arbitrage` with TradeTimeline, ProfitLossCard, FlashloanDetail
- `/positions` with DeltaGauge, OtocoOrderCard, PredictionCard
- `/reinvest` with DcaScheduleCard, TokenAllocationPie, PerformanceChart
- `/logs` with LiveTerminal, LogFilter
- `/settings` with EngineControls, WalletInfo, ApiKeyStatus, ParameterEditor

**Each page must:**
- Fetch data via React Query hooks
- Show skeletons while loading
- Show empty state if no data
- Be fully responsive (desktop grid → mobile stack)
- Use GlassCard for all panels
- Use correct typography scale (headings, body, data)

**Success Criteria:**
- Every screen renders without errors
- Data populates from API routes
- LiveTerminal auto-scrolls on new SSE entries
- Mobile navigation works (bottom nav + hamburger)

---

### Phase 10: Polish + DX Report + README + Submission

**What to do:**

1. **DX Report** — rewrite `DX-REPORT.md` from real build experience. First person, direct, specific. Every sentence must describe friction, praise, or recommend.
2. **Animations** — add micro-interactions: card hover lifts, status dot pulses, chart fade-ins, skeleton shimmer, page transitions
3. **Error states** — every API failure shows a user-facing message in the UI
4. **Loading states** — verify every panel has skeleton coverage
5. **Code cleanup** — remove dead code, consistent naming, JSDoc on public functions
6. **README** — setup instructions, architecture diagram, demo link
7. **Demo video** — 3-5 minute walkthrough
8. **Final test suite** — all unit + integration tests green
9. **Submission** — Colosseum portal by May 11, Superteam Earn by May 12

---

## 14. DX Report Template

```markdown
# Developer Experience Report: Jupiter Developer Platform

## Who I Am
[1-2 sentences. What you built, which APIs you used.]

## Onboarding
- Time-to-first-call: ~4.5 minutes
- Keyless access for prototyping: excellent decision
- [What confused you during setup]
- [What you'd change]

## What Worked Well
[Specific praise. Cite exact endpoints and behaviors.]

## What's Broken
[Broken links, dead endpoints, missing docs. Exact URLs.]
- dev.jup.ag/docs/api-reference/index.md — returned null
- Lend API borrow REST endpoints: "coming soon"
- Perps API: requires Anchor IDL, no REST

## API Edge Cases That Hurt
[Per issue: expected vs actual, how you fixed it]
- Price API silent drops
- Trigger API 20% default slippage
- Swap V2 /build SVM error codes bleeding into app layer
- 429 without Retry-After header
- 1232-byte tx limit with multi-hop routes

## AI Stack Assessment
[Per tool: used it? What worked? What didn't?]
- llms-full.txt
- Agent Skills (SKILL.md)
- Docs MCP
- Jupiter CLI

## If I Rebuilt developers.jup.ag
1. Universal /build REST layer for all products
2. Shadow mainnet simulator endpoint
3. Agent-specific API keys with spend caps
4. Enriched error payloads with machine-readable actions
5. [Additional from real experience]

## What I Wish Existed
[Concrete feature requests]
```

---

## 15. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Flashloan tx exceeds 1232 bytes | Tx rejected | High | ALT compression mandatory |
| Next.js API route timeout | Engine dies mid-loop | Eliminated | Separate Node daemon |
| Rate limit exhaustion during demo | Engine stalls | High | Caching, backoff, lower poll freq |
| Price API silent drops | Arb loop crashes on NaN | High | Explicit null guards |
| OTOCO 20% default slippage | Massive loss on stop-loss | Medium | Hardcoded explicit cap |
| DX report reads as AI-generated | Judges reject | High | Rewrite from real experience |
| SQLite write contention | Engine and dashboard conflict | Low | WAL mode enabled |
| Helius sender down | Tx doesn't land | Low | RPC fallback |
| Prediction markets have no crypto events | Hedge module idle | Medium | Expand to broader categories |

---

## 16. Claude Code Prompt Sequence

Use this exact pattern for each phase:

```
Phase [N]: [Phase Name]

Context: I'm building a Jupiter DeFi yield & hedging engine for the Superteam Earn
bounty. This is a monorepo with apps/engine (Node.js daemon) and apps/dashboard
(Next.js 14). They sync via SQLite. Read the PRD V2 section for Phase [N].

Your task:
- Implement the files listed in Phase [N]
- Follow the exact API contracts and type definitions from the PRD
- Write tests as specified in the phase
- Do not proceed to the next phase
- Do not use legacy Jupiter API endpoints (no v1, no ultra)

Tech constraints:
- TypeScript strict mode
- No console.log — use the structured logger that writes to stdout + SQLite
- All Jupiter HTTP calls go through jupiterClient.ts with rate limiting
- All errors classified via errorHandler.ts
- All transactions must use VersionedTransaction with ALT compression
- Dashboard uses glassmorphism design with light/dark theme support

When done, confirm:
1. Files created/modified
2. Tests passing
3. Any deviations from the PRD
```

---

*End of PRD V2. This document is the single source of truth. All decisions reference back here.*
