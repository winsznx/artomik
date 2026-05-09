# Developer Experience Report: Building on the Jupiter Developer Platform

## About This Build

I built **Artomik** — an autonomous DeFi engine that chains 7 Jupiter APIs (Tokens, Price, Swap V2, Lend, Trigger, Prediction Markets, Recurring) into a single execution loop: filter tokens → detect volatility → flashloan arbitrage → OTOCO hedging → prediction market delta hedging → DCA reinvestment. Full-stack TypeScript: Node.js 22 engine daemon + Next.js 14 glassmorphism dashboard, connected via SQLite + SSE.

123 unit tests. Ran live cycles against mainnet APIs. Assembled and simulated real VersionedTransactions with ALT compression (693 bytes, well under 1232-byte limit).

---

## Onboarding: First API Call

Time-to-first-call was under 5 minutes. Keyless access at `https://api.jup.ag` with no signup is a massive win — I had SOL pricing data in my terminal before I even created a portal account. `GET /price/v3?ids=So11111111111111111111111111111111111111112` returned in 370ms. No auth header needed. No docs to read first. Just curl and go.

The portal at `portal.jup.ag` for API key generation is straightforward. Tier visibility is clear.

First friction: the Price API response shape didn't match any documentation I could find. The response is `{ [mint]: { usdPrice, liquidity, priceChange24h, ... } }` — a flat object keyed by mint address. Every reference I found (including llms.txt summaries) described it as `{ data: { [mint]: { price: string } }, timeTaken }`. Ended up curling the live endpoint to discover the real shape. This became a pattern.

---

## What Jupiter Got Right

**Keyless prototyping.** Being able to hit `/price/v3`, `/tokens/v2`, and `/swap/v2/build` without an API key is the single best onboarding decision in the entire platform. I built and tested my entire HTTP client, rate limiter, and error handler against live data before touching portal.jup.ag. Most DeFi APIs gate everything behind auth — Jupiter's approach lets you validate your integration before committing.

**Prediction Markets API.** Rich, well-structured responses. 665 active events across crypto, sports, politics. The `outcomePrices`, `outcomes`, and `pricing` objects give you everything needed to build a market scanner in one call. The `{data, pagination}` response pattern is clean. Worked from Lagos without geo-restriction issues.

**Agent Skills (SKILL.md files).** The `integrating-jupiter` SKILL.md is the best developer resource on the entire platform. It's a single file with every API playbook, error code, rate limit, auth flow, and production hardening checklist. When the docs site and our PRD disagreed on response shapes, the SKILL.md was closest to reality. The `jupiter-lend` SKILL.md documented the flashloan SDK API exactly as it works: `getFlashloanIx({connection, signer, asset, amount}) → {borrowIx, paybackIx}`. That saved me hours.

**Swap V2 /build endpoint.** Once I figured out the actual response shape and the required `taker` parameter, the `/build` endpoint is excellent. Returns raw instruction objects I can inject between flashloan borrow/repay. ALT addresses are included in the response (`addressesByLookupTableAddress`). The assembled VersionedTransaction was 693 bytes — plenty of room under the 1232-byte limit.

**@jup-ag/lend SDK.** The flashloan API is clean. `getFlashloanIx` returns exactly two instructions (borrow and payback). No fees. Types are well-defined in `.d.mts` files. The only issue is ESM-only packaging (covered below).

---

## What's Broken

### llms-full.txt Returns 404
- **URL:** `https://dev.jup.ag/docs/ai/llms-full.txt`
- This URL is referenced in the Superteam Earn bounty instructions. It 301-redirects to `developers.jup.ag` and then 404s. The variant without `/ai/` (`developers.jup.ag/docs/llms-full.txt`) returns an HTML page, not plaintext.
- **Recommendation:** Serve the file as `text/plain` at a canonical URL and pin it in the docs site header. Broken URLs in bounty instructions make the platform look unfinished.

### Swap /build: `taker` Parameter Undocumented
- **URL:** `GET /swap/v2/build`
- Omitting `taker` returns `ZodError: "taker" is required`. This parameter is not mentioned in the PRD, not in llms.txt, and only briefly referenced in the Agent Skills file.
- **Impact:** Any agent building from docs alone will hit a cryptic Zod validation error on their first `/build` call.

### Price API Response Shape Doesn't Match Docs
- **Endpoint:** `GET /price/v3`
- **Docs describe:** `{ data: { [mint]: { id, type, price: string } }, timeTaken }`
- **API returns:** `{ [mint]: { usdPrice: number, liquidity, priceChange24h, blockId, decimals, createdAt } }`
- Every field is different. The `data` wrapper doesn't exist. `price` is `usdPrice` and it's a number, not a string. Code written from docs crashes on `response.data[mint]`.

### Tokens API: `isSus` Field Doesn't Exist
- **Endpoint:** `GET /tokens/v2/search`, `/tokens/v2/toporganicscore/24h`
- The docs reference `audit.isSus` as a safety filter. This field does not exist in the API response. The audit object contains `mintAuthorityDisabled`, `freezeAuthorityDisabled`, `topHoldersPercentage`, and `devMints` — no `isSus`.
- Additionally, `topHoldersPercentage` is returned as 0-100 (percentage), but documented as a fraction. I initially rejected every non-stablecoin token because `16.68 > 0.50` was always true.

### @jup-ag/lend: ESM-Only, CJS Incompatible
- **Package:** `@jup-ag/lend@0.1.9`
- The package exports only `.mjs` files. Any project using CommonJS (which includes many Node.js daemons with `module: Node16` in tsconfig) cannot import it directly. I had to use `Function('return import("@jup-ag/lend/flashloan")')()` — a runtime dynamic import hack that bypasses TypeScript's static analysis.
- **Recommendation:** Dual-publish CJS + ESM, or at minimum document the ESM-only constraint in the README.

### Trigger API Auth: `type` Must Be "message", Not "auth"
- **Endpoint:** `POST /trigger/v2/auth/challenge`
- Submitting `{ walletPubkey, type: "auth" }` returns `{ error: "Invalid option: expected one of message|transaction" }`. The valid values aren't documented. Discovered by trial and error.

### Recurring API: Undocumented `recurringType` Parameter
- **Endpoint:** `GET /recurring/v1/getRecurringOrders`
- Returns 400 with `missing field 'recurringType'` if you don't include this query parameter. Not in any documentation I found.

---

## API Edge Cases That Hurt

### Price API: Silent Token Dropping
Query 50 tokens, get 43 back. No error, no 4xx, no indication that 7 tokens were dropped. The response just doesn't include them. This is the correct behavior for tokens without reliable liquidity — but there's no way to distinguish "token has no price" from "I made a typo in the mint address" without cross-referencing the request.

**Recommendation:** Return dropped tokens with `null` value and a `reason` field: `{ "mint123": { usdPrice: null, reason: "insufficient_liquidity" } }`. This lets agents handle drops explicitly instead of guessing.

### Trigger API: 20% Default Stop-Loss Slippage
If you omit `slSlippageBps` when creating an order, the API defaults to 2000 bps (20%). For a stop-loss — the order type specifically designed to limit losses — a 20% slippage default is dangerous. A user who forgets this parameter gets significantly worse execution than expected.

**Recommendation:** Either require `slSlippageBps` as mandatory (reject if missing) or default to 300 bps (3%) with a warning header. Never silently default to 20% on a protective order.

### Swap V2 /build: Every Field Differs from Docs

| What Docs Say | What API Returns |
|---|---|
| `addressLookupTableAddresses: string[]` | `addressesByLookupTableAddress: Record<string, string[]>` |
| `computeUnitLimit: number` | `computeBudgetInstructions: Instruction[]` |
| `swapInstruction: string (base64)` | `swapInstruction: { programId, accounts, data }` |
| No `taker` required | `taker` is required (ZodError if missing) |

The response also includes `blockhashWithMetadata`, `routePlan`, `tipInstruction`, and `swapMode` — none documented. I wrote a `deserializeInstruction()` helper to convert the `{programId, accounts, data}` objects into `TransactionInstruction` instances. This should be a documented pattern or a utility in the SDK.

---

## AI Stack Assessment

### llms.txt / llms-full.txt
The llms.txt index concept is good — it gives LLMs a map of the API surface. The actual file I retrieved provided a useful summary of endpoints and routing logic. However, the `llms-full.txt` URL (referenced in bounty instructions) 404s, and the llms.txt responses come as HTML rather than plaintext, adding parsing overhead for agents. The content was accurate as a high-level index but didn't contain enough detail to prevent the response shape mismatches I hit on Price, Tokens, and Swap /build APIs.

### Agent Skills (SKILL.md)
The strongest part of the AI stack. Two skills available: `integrating-jupiter` and `jupiter-lend`.

`integrating-jupiter` is exceptional. It includes every API playbook, error codes for swap execute (the negative code system I wouldn't have known about otherwise), rate limit tiers, production hardening checklist, and a complete cross-cutting error pattern with retry logic. This single file prevented more bugs than any other documentation resource.

`jupiter-lend` accurately described the flashloan SDK API — the signature, return types, and no-fee policy all matched reality. It saved significant debugging time.

**Gaps:** No Skill exists for Prediction Markets, Trigger API auth flow, or the Recurring API. The Trigger auth type field (`"message"` vs `"auth"`) is wrong in the main Skill — had to discover the valid values via live API call. Adding Skills for every API family, especially ones with non-obvious auth flows, would close the biggest remaining gap.

### Jupiter CLI
Installed via `npm i -g @jup-ag/cli`. First impression: this is well-built. JSON output mode (`--format json`) works exactly as advertised — clean, parseable, no human-readable cruft mixed in. I used it to validate my REST API integration against ground truth:

- `jup spot tokens --search SOL --format json` — returns the same token data as the REST Tokens API. Useful for quick sanity checks.
- `jup spot quote --from SOL --to USDC --amount 0.001 --format json` — returns a clean quote with `inAmount`, `outAmount`, `inUsdValue`. This is how I verified my swap builder was parsing `/build` responses correctly.
- `jup predictions events --category crypto --format json` — returns prediction events in a slightly different shape than the REST API (`events` wrapper vs `data` wrapper). Minor inconsistency.
- `jup lend earn tokens --format json` — shows APY data per token. Useful for verifying flashloan asset selection.

**Friction:** The flag names don't match the REST API parameter names. REST uses `inputMint`/`outputMint`, CLI uses `--from`/`--to`. REST uses `query`, CLI uses `--search`. If you're building against the REST API and using the CLI to validate, you have to mentally translate between two naming conventions. Standardizing would help.

**Friction:** No `price` subcommand. The CLI has `spot quote` but no direct price lookup like `jup price SOL`. I had to use `spot tokens --search SOL` and extract `usdPrice` from the response, which works but isn't discoverable.

**What works well:** The `--dry-run` flag for swaps is excellent for autonomous agents. Non-interactive design means it works in CI pipelines and agent loops without hanging on prompts. This is the right design for AI-native tooling.

### Docs MCP
Connected via `claude mcp add --transport http jupiter https://dev.jup.ag/docs/mcp`. Setup was one command — the smoothest part of the entire AI stack.

The MCP server provides read-only access to Jupiter docs pages and OpenAPI specs. It's useful for looking up endpoint details without leaving the editor, especially when the docs site is slow or you want to search across multiple pages.

**Setup:** The MCP URL is documented on the AI docs page (`developers.jup.ag/docs/ai/mcp`) with setup instructions for Claude Code, Cursor, and Windsurf. One command and you're connected. The setup experience is clean.

**Friction:** The MCP gives you docs content, but the docs themselves have the response shape mismatches I documented above. So the MCP accurately serves you inaccurate docs. It's a distribution mechanism, not a source of truth fix. The value is limited until the underlying docs match the actual API responses.

**What would make it great:** If the MCP could serve live API examples — `"show me what GET /price/v3?ids=SOL actually returns right now"` — that would have saved me hours of curl debugging. A live sandbox via MCP would be a killer feature.

### What's Missing from the AI Stack
1. **No Skill for Prediction Markets.** The response shape (`{data, pagination}`, `metadata.title`, market structure) is non-trivial and differs from what you'd guess.
2. **No Skill for Trigger API auth.** The challenge-response flow with JWT is complex enough to warrant its own Skill.
3. **No way to discover /build response shape without a live call.** The SKILL.md describes parameters but not the instruction object format. An example response in the Skill would save every builder from the same discovery process.
4. **llms-full.txt 404.** A bounty that grades on AI stack usage shouldn't have a broken primary URL.
5. **CLI flag names don't match REST params.** `--from`/`--to` vs `inputMint`/`outputMint`. Developers using both will waste time translating.
6. **No `jup price` command.** The most common operation — checking a token price — requires going through `spot tokens --search` and extracting `usdPrice` from the response.

---

## If I Were Rebuilding developers.jup.ag

### 1. Universal /build REST Layer
Every product — Lend, Perps, Recurring — should have a `/build` endpoint returning raw instructions as JSON. The Lend SDK works, but it's ESM-only TypeScript. Python developers, Rust developers, and AI agents that generate HTTP calls can't use it. The Swap `/build` endpoint is the right pattern — extend it everywhere.

### 2. Response Schema Contracts
Publish JSON Schema or OpenAPI specs for every endpoint that match the actual API responses. Right now, there's a gap between what the docs describe, what the Skills say, and what the API returns. Pin the source of truth to the OpenAPI spec and auto-generate docs from it.

### 3. Enriched Error Payloads
Every 4xx/5xx should include: error code, human explanation, machine-readable fix suggestion, and docs link. The Trigger API's `"Invalid option: expected one of message|transaction"` is a good example — it tells you what went wrong. The Swap `/build` ZodError is less helpful because `"taker" is required` doesn't explain what `taker` should contain.

### 4. Agent-Specific API Keys
Restricted execution keys with spend caps and endpoint allowlists. Giving a full private key to an AI agent (as required for Trigger auth challenge signing) is a security concern. An API key with bounded permissions (e.g., "can place orders up to $10, can only call /trigger and /price") would make autonomous agents viable in production.

### 5. Price API: Explicit Drop Reporting
Return all queried mints in the response, with `null` + reason for unavailable ones. Silent dropping is the correct performance optimization, but it makes debugging impossible. Add an opt-in parameter like `?includeDropped=true` for agents that need explicit feedback.

### 6. Live API Sandbox via MCP
The Docs MCP serves documentation — but the docs don't match the API. If the MCP could proxy live API calls with example responses (`"show me what /price/v3 actually returns for SOL"`), it would close the gap between docs and reality. Every builder hits this gap and has to curl the live API to figure out real response shapes. Bake that into the MCP.

### 7. CLI as REST Validation Layer
The CLI already wraps the REST API with clean JSON output. Publish a mapping table: `jup spot quote --from X --to Y` = `GET /swap/v2/order?inputMint=X&outputMint=Y`. This lets builders use the CLI as a reference implementation and validation tool.

---

## What I Wish Existed
- `GET /swap/v2/build` docs should list `taker` as required with example value
- Price API should return `{ usdPrice: null, reason: "stale" }` instead of omitting tokens
- Trigger API should not default to 2000 bps slippage — require explicit param or default to 300
- `@jup-ag/lend` should support CJS alongside ESM
- Agent Skills for every API, not just Swap and Lend
- An example `/build` response in the Swap Skill showing instruction object structure
- `topHoldersPercentage` should be documented as percentage (0-100), not fraction (0-1)
- A shadow mainnet simulator endpoint for testing without real capital
- `jup price SOL` — direct price lookup command in CLI
- CLI flag names matching REST API parameter names (`--inputMint` not `--from`)
- MCP live sandbox — proxy real API calls with example responses alongside doc content
