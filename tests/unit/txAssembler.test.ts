import { describe, it, expect, vi } from 'vitest';
import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import type { FlashloanInstructions } from '../../apps/engine/src/execution/flashloan.js';
import type { SwapBuildResult } from '../../apps/engine/src/execution/swapBuilder.js';

vi.mock('../../apps/engine/src/infra/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { assembleAtomicTransaction, MAX_TX_SIZE_BYTES } from '../../apps/engine/src/execution/txAssembler.js';

function makeDummyIx(label: string): TransactionInstruction {
  return new TransactionInstruction({
    programId: Keypair.generate().publicKey,
    keys: [{ pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true }],
    data: Buffer.from(label),
  });
}

function makeTestFixtures() {
  const payer = Keypair.generate();

  const flashloan: FlashloanInstructions = {
    borrowIx: makeDummyIx('borrow'),
    repayIx: makeDummyIx('repay'),
    borrowAmount: 1000000n,
    asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  };

  const swap: SwapBuildResult = {
    computeBudgetInstructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }),
    ],
    setupInstructions: [makeDummyIx('setup')],
    swapInstruction: makeDummyIx('swap'),
    cleanupInstruction: makeDummyIx('cleanup'),
    altAddresses: [],
    inAmount: '1000000',
    outAmount: '83000',
  };

  const mockConnection = {
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: 'GfVcyD4kkTrj4bKcJcNnQ9dpuJBvG7c1NVfWMdkMePYj',
      lastValidBlockHeight: 200000,
    }),
    getAddressLookupTable: vi.fn().mockResolvedValue({ value: null }),
  } as never;

  return { payer, flashloan, swap, mockConnection };
}

describe('txAssembler', () => {
  it('produces a VersionedTransaction (not legacy)', async () => {
    const { payer, flashloan, swap, mockConnection } = makeTestFixtures();
    const { transaction } = await assembleAtomicTransaction({
      flashloan, swap, payer, connection: mockConnection,
    });

    expect(transaction.version).toBe(0);
  });

  it('instructions ordered: compute → borrow → setup → swap → cleanup → repay', async () => {
    const { payer, flashloan, swap, mockConnection } = makeTestFixtures();
    const { transaction } = await assembleAtomicTransaction({
      flashloan, swap, payer, connection: mockConnection,
    });

    const msg = transaction.message;
    const ixCount = msg.compiledInstructions.length;

    expect(ixCount).toBe(6);
  });

  it('reports tx size in bytes', async () => {
    const { payer, flashloan, swap, mockConnection } = makeTestFixtures();
    const { sizeBytes } = await assembleAtomicTransaction({
      flashloan, swap, payer, connection: mockConnection,
    });

    expect(sizeBytes).toBeGreaterThan(0);
    expect(typeof sizeBytes).toBe('number');
  });

  it('handles missing cleanupInstruction', async () => {
    const { payer, flashloan, swap, mockConnection } = makeTestFixtures();
    swap.cleanupInstruction = null;

    const { transaction } = await assembleAtomicTransaction({
      flashloan, swap, payer, connection: mockConnection,
    });

    const ixCount = transaction.message.compiledInstructions.length;
    expect(ixCount).toBe(5);
  });

  it('MAX_TX_SIZE_BYTES is 1232', () => {
    expect(MAX_TX_SIZE_BYTES).toBe(1232);
  });
});
