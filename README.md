# Artomik — Autonomous Multi-Vector DeFi Yield & Hedging Engine

An autonomous engine that chains 7 Jupiter APIs into a single execution loop: filter tokens by organic score → detect volatility anomalies → execute flashloan arbitrage → place OTOCO bracket hedges → take inverse prediction market positions → reinvest profits via DCA. Full-stack TypeScript monorepo with a Node.js daemon engine and a glassmorphism Next.js dashboard.

**Live:** [artomik.xyz](https://artomik.xyz) — engine running on Railway against Jupiter mainnet APIs.

## Architecture

```
┌───────────────────────────────────────────────────────----───┐
│                        MONOREPO                              │
│                                                              │
│  ┌──────────────────-───┐         ┌────────────────────────┐ │
│  │   apps/engine        │         │   apps/dashboard       │ │
│  │   (Node.js daemon)   │         │   (Next.js 14)         │ │
│  │                      │         │                        │ │
│  │  • Autonomous loop   │         │  • 7 page routes       │ │
│  │  • All API calls     │  ───►   │  • SSE log stream      │ │
│  │  • Tx assembly       │ SQLite  │  • Glassmorphism UI    │ │
│  │  • Writes state      │         │  • Light/dark theme    │ │
│  └─────────────────-────┘         └────────────────────────┘ │
│                                                              │
│  ┌─────────────────────┐                                     │
│  │   packages/shared   │                                     │
│  │   • Types + DB      │                                     │
│  └─────────────────────┘                                     │
└───────────────────────────────────────────────────────----───┘
```

## Jupiter APIs Used

| API | Usage |
|-----|-------|
| **Tokens V2** | Filter tokens by organic score, audit flags, holder concentration |
| **Price V3** | Real-time price polling with silent drop detection |
| **Swap V2 /build** | Raw instructions for flashloan-atomic arbitrage transactions |
| **Lend (Flashloan)** | Zero-fee borrow/repay via `@jup-ag/lend` SDK |
| **Trigger V2 (OTOCO)** | Bracket orders with explicit stop-loss slippage (never 20% default) |
| **Prediction Markets** | Inverse-correlated event hedging via keyword correlation |
| **Recurring (DCA)** | Profit reinvestment into top organic-score tokens |

## Quick Start

```bash
git clone https://github.com/winsznx/artomik.git
cd artomik
bash scripts/setup.sh      # installs deps, copies .env.example
# Edit .env with your PRIVATE_KEY, HELIUS_API_KEY
npm run dev                 # starts engine + dashboard
```

Local dashboard: http://localhost:3000 · Live: [artomik.xyz](https://artomik.xyz)

## Dashboard

7 pages with glassmorphism UI, light/dark theme toggle, SSE live terminal:

- **Overview** — P&L, active positions, recent trades, portfolio chart
- **Signals** — Token watchlist with organic scores and volatility badges
- **Arbitrage** — Flashloan execution timeline with status dots
- **Positions** — OTOCO orders + prediction market positions + delta gauge
- **Reinvest** — DCA schedules with allocation pie chart
- **Logs** — Real-time terminal with color-coded levels and expandable entries
- **Settings** — Engine controls, API status, parameter display

## Tests

```bash
npx vitest run    # 123 tests across 14 files
```

## DX Report

See [DX-REPORT.md](./DX-REPORT.md) for the full developer experience report — real friction, real praise, specific recommendations.

## Built With

- [Jupiter Developer Platform](https://developers.jup.ag) — APIs and AI Stack
- [Jupiter Agent Skills](https://github.com/jup-ag/agent-skills) — SKILL.md integration guidance
- Node.js 22 + TypeScript 5.5 (strict mode)
- Next.js 14 (App Router) + Tailwind + Recharts
- Solana web3.js + @jup-ag/lend
- better-sqlite3 (WAL mode) + Vitest
