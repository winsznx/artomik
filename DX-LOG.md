# Artomik — Developer Experience Log

This is a running log of real friction encountered while building with
the Jupiter Developer Platform. Captured in real-time, not retroactively.

## AI Stack Setup
**Date:** 2026-04-15

### llms.txt / llms-full.txt
- The PRD-provided URL `https://dev.jup.ag/docs/ai/llms-full.txt` returned **404 Not Found**.
- `dev.jup.ag` redirects to `developers.jup.ag` (301), but the `/docs/ai/llms-full.txt` path doesn't exist on either domain.
- `https://developers.jup.ag/docs/llms-full.txt` (without `/ai/`) returns an HTML page, not raw text. For an LLM-optimized doc file, a raw `.txt` response would be more useful — the HTML wrapper forces parsing overhead.
- `https://developers.jup.ag/docs/llms.txt` also returns HTML, not plaintext.
- **Verdict:** The llms.txt concept is good but the URLs are fragile. The `dev.jup.ag` → `developers.jup.ag` redirect works, but the `/ai/` path segment silently breaks. A canonical URL listed in the docs site header would help.

### Agent Skills
- The GitHub repo `jup-ag/agent-skills` exists and contains two skills: `integrating-jupiter` and `jupiter-lend`.
- Could not clone via `gh` CLI (not authenticated), so fetched raw SKILL.md files directly from GitHub.
- `integrating-jupiter/SKILL.md` is **excellent** — comprehensive, well-structured, includes all API playbooks, error codes, rate limits, and production hardening guidance in a single file. This is the best AI developer resource in the entire Jupiter platform.
- `jupiter-lend/SKILL.md` is also strong — clear flashloan API with code examples, SDK patterns, and program IDs.
- The `npx skills add jup-ag/agent-skills` installation path was not tested (would need npm auth and may have version issues).
- **Key insight:** The SKILL.md files revealed several discrepancies with our PRD (documented below). Without these files, we would have built against incorrect API contracts.

### Docs MCP
- Not attempted yet — will try when building dashboard API routes.

### Jupiter CLI
- Not attempted yet — will try in a later phase.

## PRD vs Jupiter Docs Discrepancies

Found during cross-reference of `integrating-jupiter/SKILL.md` against PRD-V2.md Sections 7.1-7.7:

### 1. Swap API — Order/Execute flow missing from PRD
- **PRD says:** Use `GET /swap/v2/build` for swap instructions
- **Docs say:** Recommended flow is `GET /swap/v2/order` → sign → `POST /swap/v2/execute`. `/build` is Metis-only and returns raw instructions for self-managed transactions.
- **Impact:** Medium. Our PRD's approach (`/build`) works for flashloan-atomic transactions where we need raw instructions, so it's actually the correct choice for our use case. But we should be aware of the order/execute path for simpler swaps.
- **Action:** Added `SWAP_ORDER` and `SWAP_EXECUTE` endpoints to constants. Added `SwapOrderResponse` and `SwapExecuteResponse` types.

### 2. Swap Error Codes — Completely different system
- **PRD says:** SVM error codes 6001 (SlippageToleranceExceeded), 6008, 6014, 6017, 6024
- **Docs say:** Swap execute uses negative error codes (-1, -1000, -1001, etc.) for execute-phase errors. The SVM codes (6001, etc.) are program-level errors that occur during on-chain execution, not HTTP-level errors.
- **Impact:** High. Our error handler needs to handle BOTH systems — HTTP/execute-level (negative codes) AND on-chain program errors (positive codes).
- **Action:** Error handler will classify both code ranges.

### 3. Trigger API — JWT auth required
- **PRD says:** Just use x-api-key header
- **Docs say:** Trigger API requires dual auth — `x-api-key` (all requests) + `Authorization: Bearer <jwt>` (order mutations). JWT obtained via challenge-response: `POST /auth/challenge` → sign → `POST /auth/verify`.
- **Impact:** High. Order creation flow is more complex than PRD suggests. Three-step process: register vault → deposit → create order.
- **Action:** Added auth endpoints to constants. Added `TriggerAuthChallengeResponse`, `TriggerAuthVerifyResponse`, `TriggerDepositResponse` types.

### 4. Recurring API — Different endpoint name
- **PRD says:** `POST /recurring/v1/create`
- **Docs say:** `POST /recurring/v1/createOrder`
- **Impact:** Low (would cause 404 at runtime).
- **Action:** Fixed in constants.

### 5. Recurring API — Minimum constraints
- **PRD says:** No minimums mentioned
- **Docs say:** Min 100 USD total, min 2 orders, min 50 USD per order. Token-2022 NOT supported.
- **Impact:** Medium. Need validation before creating DCA orders.
- **Action:** Will add validation in Phase DCA implementation.

### 6. JupUSD Mint Address
- **PRD says:** `JupUSD1djCERKizomXRaynojNJzRCf2RjV5DuPMg5oi`
- **Docs say:** `JuprjznTrTSp2UFa3ZBUFgwdAmtZCq4MQCwysN55USD`
- **Impact:** Critical — wrong mint would fail all prediction market deposits.
- **Action:** Fixed in constants.

### 7. Prediction Markets — Geo-restriction
- **PRD says:** No mention of geo-restrictions
- **Docs say:** US and South Korea IPs are BLOCKED
- **Impact:** High for development/testing if building from US. Need VPN or mock responses.
- **Action:** Documented. Will handle in integration testing phase.

### 8. Rate Limits — Tiered system
- **PRD says:** Keyless = 0.5 RPS, with key = RATE_LIMIT_RPS env var
- **Docs say:** Tiered system: Keyless = 0.5 RPS, Free = 1 RPS, Dev = 10 RPS, Launch = 50 RPS, Pro = 150 RPS. Swap API has separate volume-based limits (50 req/10s base).
- **Impact:** Low — our rate limiter is configurable via env var, so it adapts. But good to know the actual tiers.
- **Action:** No code change needed, just awareness.

### 9. Flashloan SDK — @jup-ag/lend EXISTS
- **PRD says:** Use `@jup-ag/lend` for flashloan instructions
- **Phase 1 note:** We flagged this as "not published on npm"
- **Docs say:** `@jup-ag/lend` IS published. Flashloan API: `import { getFlashloanIx } from "@jup-ag/lend/flashloan"` → returns `{ borrowIx, paybackIx }`. No fees.
- **Impact:** High — this resolves our Phase 1 blocker.
- **Action:** Will install and use in Phase 4.

### 10. Price API — Response shape completely different
- **PRD says:** Response is `{ data: { [mint]: { id, type, price: string } }, timeTaken }`
- **Actual API:** Response is `{ [mint]: { createdAt, liquidity, usdPrice: number, blockId, decimals, priceChange24h } }`. No `data` wrapper. `usdPrice` (number) instead of `price` (string).
- **Impact:** Critical — any code written from PRD types would crash at runtime with `Cannot read properties of undefined (reading 'data')`.
- **Action:** Updated `PriceEntry` and `PriceResponse` types to match actual response. Verified with live API call.

## API Friction

### 2026-04-15 — Price API — Response shape mismatch
**Endpoint:** `GET /price/v3?ids={mint}`
**Expected:** Wrapped response `{ data: { [mint]: { id, type, price, extraInfo } }, timeTaken }` (per PRD Section 7.2 and llms.txt descriptions)
**Actual:** Flat object `{ [mint]: { createdAt, liquidity, usdPrice, blockId, decimals, priceChange24h } }`. No `data` wrapper. Price field is `usdPrice` (number), not `price` (string). Includes `liquidity`, `priceChange24h`, `blockId` — none mentioned in PRD.
**Severity:** major — would cause runtime TypeError accessing `response.data[mint]` when `data` doesn't exist
**Fix/Workaround:** Updated `PriceEntry` and `PriceResponse` types to match actual response. No `data` wrapper, `usdPrice` instead of `price`, numeric instead of string.
**Notes:** The Agent Skills SKILL.md mentions `confidenceLevel` field but that wasn't in the response. The SKILL.md says "Tokens with unreliable pricing return null or are omitted" — confirmed, response simply omits the mint key. Keyless mode (no API key) worked at ~370ms latency.

### 2026-04-15 — Tokens API — Multiple response shape mismatches
**Endpoint:** `GET /tokens/v2/search` and `GET /tokens/v2/toporganicscore/24h`
**Expected:** Response wrapped in `{ tokens: [...] }` with fields `address`, `logoURI`, `audit.isSus`, `audit.topHolderConcentration`
**Actual:**
1. Response is a **flat array** `[...]`, not wrapped in `{ tokens: [...] }`
2. Token ID field is `id`, not `address`
3. Logo field is `icon`, not `logoURI`
4. **No `isSus` field exists in audit at all** — PRD references it as a filter rule but the API never returns it
5. Concentration field is `topHoldersPercentage` (in percentage 0-100), not `topHolderConcentration` (fraction 0-1)
6. USDC and USDT have `mintAuthorityDisabled` missing from audit (returns undefined, not true/false)
7. Includes many extra fields not in PRD: `usdPrice`, `liquidity`, `holderCount`, `fdv`, `mcap`, `stats5m/1h/6h/24h`, `circSupply`, `totalSupply`, `tokenProgram`, `isVerified`, `organicScoreLabel`
**Severity:** critical — at least 5 separate type mismatches that would each cause runtime failures
**Fix/Workaround:** Rewrote `TokenInfo`, `TokenAudit`, and `TokenSearchResponse` types entirely. Removed `isSus` filter (field doesn't exist). Fixed `topHoldersPercentage` to normalize from percentage to fraction for comparison.
**DX Note:** The PRD was clearly written against an older or speculative API version. The Agent Skills SKILL.md was much closer to reality but still didn't document the exact audit object shape. The only way to get the true response shape was to curl the live API.

### 2026-04-15 — Swap /build API — Response shape differs from PRD
**Endpoint:** `GET /swap/v2/build`
**Expected (PRD):**
- `addressLookupTableAddresses`: string array
- `computeUnitLimit`: number
- `computeUnitPrice`: string
- `swapInstruction`: base64 string
- No `taker` parameter required

**Actual:**
- `addressesByLookupTableAddress`: object (keys are ALT addresses, values are address arrays)
- `computeBudgetInstructions`: array of instruction objects (not scalar values)
- `swapInstruction`: object with `{programId, accounts, data}` (not base64 string)
- `taker` parameter is REQUIRED (ZodError if missing)
- Includes `blockhashWithMetadata`, `routePlan`, `tipInstruction`, `swapMode` — none in PRD
- Instructions use base64 `data` field (not hex or raw)

**Severity:** major — every field except the existence of `setupInstructions` and `cleanupInstruction` differs
**Fix/Workaround:** Built `deserializeInstruction()` to convert `{programId, accounts, data}` objects into `TransactionInstruction`. Extract ALT addresses from object keys of `addressesByLookupTableAddress`. Use `computeBudgetInstructions` array directly instead of constructing from scalars.
**DX Note:** The `taker` parameter is not documented in the PRD at all. The SKILL.md mentions it but doesn't mark it as required. Live API rejects without it.

### 2026-04-15 — @jup-ag/lend SDK — ESM-only, CJS boundary
**Package:** `@jup-ag/lend@0.1.9`
**Expected:** Standard Node.js package usable from CJS
**Actual:** Package exports only `.mjs` files. Cannot be imported with `require()` or standard `import` from a CJS TypeScript project compiled with `module: Node16`.
**Severity:** major — blocks direct usage in our engine (CJS)
**Fix/Workaround:** Used dynamic `import()` via `Function('return import(...)')()` to cross the ESM/CJS boundary at runtime. This works but prevents static type checking of the SDK. Defined local type signatures matching the SDK's `.d.mts` declarations.
**DX Note:** The SDK types are well-defined in `.d.mts` files. The `getFlashloanIx` function signature matches the SKILL.md documentation exactly: `{connection, signer, asset, amount} → {borrowIx, paybackIx}`. No flashloan fees. The SDK is solid once you get past the module boundary.

### 2026-04-15 — Execution Pipeline — Live Validation Results
**Test:** SOL → USDC, 0.001 SOL (1,000,000 lamports), keyless mode
**Results:**
- `/build` response: 989ms, 200 OK, 1 ALT, 3 setup instructions, 1 compute budget instruction
- Assembled VersionedTransaction: **693 bytes** (well under 1232 limit)
- ALT compression: 1 ALT fetched, all valid
- Simulation: "AccountNotFound" — expected, dummy wallet has no SOL balance
- Pipeline works end-to-end: build → parse → assemble → simulate
**DX Note:** The pipeline is production-ready for real wallets. The 693-byte size leaves room for flashloan borrow+repay instructions (~200-300 bytes each).

### 2026-04-15 — Trigger API Auth — Challenge type validation
**Endpoint:** `POST /trigger/v2/auth/challenge`
**Expected (PRD):** `{ walletPubkey, type: "auth" }`
**Actual:** `type` must be `"message"` or `"transaction"`, not `"auth"`. Submitting `"auth"` returns `{ error: "Invalid option: expected one of message|transaction" }`.
**Severity:** minor — easy fix once discovered, but the PRD and SKILL.md don't mention valid values
**Fix/Workaround:** Use `type: "message"` for wallet ownership proofs. Response is `{ type: "message", challenge: "Sign this message..." }` with an embedded nonce and expiry.
**DX Note:** The challenge text includes the wallet address and a nonce with expiry timestamp. Well-structured for automated signing.

### 2026-04-15 — Trigger API Vault — Requires auth
**Endpoint:** `GET /trigger/v2/vault`
**Expected:** Returns vault info with just x-api-key
**Actual:** Returns `{ error: "Unauthorized" }` without JWT auth. Vault endpoints require the JWT obtained from the challenge-response flow.
**Severity:** minor — expected from Phase 2 research, confirmed live

### 2026-04-15 — Prediction Markets API — Works from Lagos
**Endpoint:** `GET /prediction/v1/events?category=crypto`
**Expected:** Possibly geo-blocked (Phase 2 noted US/Korea restriction)
**Actual:** Returns 665 total events, wrapped in `{ data: [...], pagination: { start, end, total, hasNext } }`. Response shape differs from PRD:
- Events wrapped in `{data, pagination}` (not flat array)
- Event title is in `metadata.title` (not top-level `title`)
- Markets have `outcomePrices` (string array like `["0.9995","0.0005"]`), `outcomes` (string array), `pricing` object with `buyYesPriceUsd` etc
- Market IDs are like `POLY-1919248` (Polymarket-sourced)
- `clobTokenIds` present for on-chain token resolution
**Severity:** major — multiple field mapping differences
**Fix/Workaround:** Built `MarketScanner` to map from actual response shape. Filter inactive events and closed markets server-side.
**DX Note:** Prediction API is the best documented of all Jupiter APIs — response is rich and well-structured. Not geo-blocked from Lagos.

### 2026-04-15 — Recurring API — Requires recurringType param
**Endpoint:** `GET /recurring/v1/getRecurringOrders`
**Expected:** Just wallet param
**Actual:** Returns 400 with `Failed to deserialize query string: missing field 'recurringType'`. Must pass `recurringType=time` (or potentially other values).
**Severity:** minor — undocumented required parameter
**Fix/Workaround:** Added `recurringType: 'time'` to query params.

### 2026-04-15 — tweetnacl — No TypeScript types
**Package:** tweetnacl (transitive dep of @solana/web3.js)
**Expected:** Types available via @types/tweetnacl or built-in
**Actual:** No @types/tweetnacl on npm, no .d.ts in package. Required `require()` with inline type assertion.
**Severity:** minor — workaround is straightforward

### 2026-04-15 — Engine Loop — Full Pipeline Live Run
**Test:** 3 cycles with real Jupiter API calls, 500ms poll interval, dummy wallet
**Results:**
- Cycle 1: 36/50 tokens filtered, 36/36 prices polled, 0 signals (building history)
- Cycle 2: Same, 0 signals (need 3+ data points for stddev)
- Cycle 3: **10 volatility signals detected** — USDT, SOL, JUP, BULL, DUMBMONEY, BURNIE, TripleT, ELON, CrazyFrog, SPRINGULAR
- Started arbitrage attempt on USDT→USDC before shutdown
- Clean SIGINT shutdown — engine stopped gracefully
- DB state: 77 execution_log entries, 36 watched_tokens, engine_state cycle_count=2
- No SQLite locking issues — WAL mode works correctly for concurrent read/write
**DX Note:** The volatility detector is very sensitive with only 3 data points. Micro-fluctuations in stablecoin prices (USDT ±0.00001) trigger signals. Consider raising the minimum window size or adding a minimum absolute price change threshold in production tuning.

### 2026-04-15 — SQLite Concurrent Access — No Issues
**Test:** Engine writing to DB while dashboard opens it read-only
**Result:** WAL mode works. No locking errors, no SQLITE_BUSY. Dashboard can read while engine writes.
**DX Note:** SQLite WAL mode is the right choice for this architecture. No need for Redis or PostgreSQL.

### 2026-04-15 — Jupiter CLI — Solid but naming inconsistency
**Tool:** `@jup-ag/cli` installed via `npm i -g @jup-ag/cli`
**What worked:**
- `jup spot tokens --search SOL --format json` — clean JSON output, same data as REST API
- `jup spot quote --from SOL --to USDC --amount 0.001 --format json` — correct quote with USD values
- `jup predictions events --category crypto --format json` — prediction events accessible
- `jup lend earn tokens --format json` — APY data with jlToken info
- `--dry-run` flag for safe testing
- Non-interactive design works for AI agent loops
**Friction:**
- Flag names don't match REST API: CLI uses `--from`/`--to`, REST uses `inputMint`/`outputMint`. CLI uses `--search`, REST uses `query`. Developers using both have to translate.
- No `jup price SOL` command — most common operation requires `spot tokens` workaround
- `predictions events` returns `{events: [...]}` wrapper, REST API returns `{data: [...]}` — inconsistency

### 2026-04-15 — Docs MCP — Easy setup, limited value
**Tool:** Connected via `claude mcp add --transport http jupiter https://dev.jup.ag/docs/mcp`
**Setup:** One command. Smoothest part of the AI stack.
**What worked:** Access to docs pages and OpenAPI specs from the editor. No filesystem needed.
**Friction:**
- Serves docs content accurately, but the docs themselves have response shape mismatches with the live API
- No live API proxy — can't ask "what does this endpoint actually return?"
**DX Note:** The MCP is a good distribution mechanism but it's only as good as the docs it serves. If the docs don't match the API (which they don't for Price, Tokens, and /build), the MCP inherits those gaps.
