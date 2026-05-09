# Jupiter Lend Protocol (from jup-ag/agent-skills)

Fetched from: https://raw.githubusercontent.com/jup-ag/agent-skills/main/skills/jupiter-lend/SKILL.md

## Key Facts for Artomik

### SDKs
- @jup-ag/lend — write operations (deposit, withdraw, borrow, repay, flashloan)
- @jup-ag/lend-read — read-only queries

### Flashloan API
```typescript
import { getFlashloanIx } from "@jup-ag/lend/flashloan";

const { borrowIx, paybackIx } = await getFlashloanIx({
  connection,
  signer,
  asset,       // e.g. USDC PublicKey
  amount,      // BN in base units
});

// Transaction order: borrowIx -> custom instructions -> paybackIx
```

- NO flashloan fees
- Must repay in same transaction
- Returns TransactionInstruction objects

### Program IDs
- Liquidity: jupeiUmn818Jg1ekPURTpr4mFo29p46vygyykFJ3wZC
- Lending (Earn): jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9
- Vaults (Borrow): jupr81YtYssSyPt8jbnGuiWon5f6x9TcDEFxYe3Bdzi
- Flashloan: jupgfSgfuAXv4B6R2Uxu85Z1qdzgju79s6MfZekN6XS

### Vault Operations
- All use getOperateIx function
- Positive colAmount = deposit, negative = withdraw
- Positive debtAmount = borrow, negative = repay
- positionId 0 = create new position
- Sentinel values: MAX_REPAY_AMOUNT, MAX_WITHDRAW_AMOUNT
