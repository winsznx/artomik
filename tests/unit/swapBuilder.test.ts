import { describe, it, expect, vi } from 'vitest';
import { PublicKey } from '@solana/web3.js';

vi.mock('../../apps/engine/src/infra/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { deserializeInstruction } from '../../apps/engine/src/execution/swapBuilder.js';

const MOCK_BUILD_RESPONSE = {
  inputMint: 'So11111111111111111111111111111111111111112',
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  inAmount: '1000000',
  outAmount: '83829',
  otherAmountThreshold: '81315',
  swapMode: 'ExactIn',
  slippageBps: 300,
  priceImpactPct: '0',
  routePlan: [{ label: 'Raydium' }],
  computeBudgetInstructions: [
    {
      programId: 'ComputeBudget111111111111111111111111111111',
      accounts: [],
      data: 'A6XJCgAAAAAA',
    },
  ],
  setupInstructions: [
    {
      programId: '11111111111111111111111111111111',
      accounts: [
        { pubkey: '11111111111111111111111111111111', isSigner: true, isWritable: true },
      ],
      data: 'AQAAAA==',
    },
  ],
  swapInstruction: {
    programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    accounts: [
      { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
      { pubkey: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', isSigner: false, isWritable: true },
    ],
    data: 'AQAAAAAAAAAA',
  },
  cleanupInstruction: {
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    accounts: [
      { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: true },
    ],
    data: 'CQAAAA==',
  },
  otherInstructions: [],
  tipInstruction: null,
  addressesByLookupTableAddress: {
    '7iBnR91CiHD1eFuSY38Hv5uiNaW4Ju33vekd8yjrqoq': ['addr1', 'addr2'],
    'CFjpuoQRyoykAEt2pBYTccpE25wUK1V5iP92SPVgDY7L': ['addr3'],
  },
  blockhashWithMetadata: {
    blockhash: 'testblockhash',
    fetchedAt: '2024-01-01',
    lastValidBlockHeight: 100000,
  },
};

describe('swapBuilder', () => {
  describe('deserializeInstruction', () => {
    it('parses raw instruction into TransactionInstruction', () => {
      const raw = MOCK_BUILD_RESPONSE.swapInstruction;
      const ix = deserializeInstruction(raw);

      expect(ix.programId).toBeInstanceOf(PublicKey);
      expect(ix.programId.toBase58()).toBe('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
      expect(ix.keys).toHaveLength(2);
      expect(ix.data).toBeInstanceOf(Buffer);
    });

    it('correctly maps account metadata', () => {
      const raw = MOCK_BUILD_RESPONSE.swapInstruction;
      const ix = deserializeInstruction(raw);

      expect(ix.keys[0]!.isSigner).toBe(false);
      expect(ix.keys[0]!.isWritable).toBe(false);
      expect(ix.keys[1]!.isWritable).toBe(true);
    });
  });

  describe('buildSwapInstructions (via mock client)', () => {
    it('extracts ALT addresses from response', async () => {
      const { buildSwapInstructions } = await import('../../apps/engine/src/execution/swapBuilder.js');

      const mockClient = {
        get: vi.fn().mockResolvedValue(MOCK_BUILD_RESPONSE),
        post: vi.fn(),
      } as never;

      const result = await buildSwapInstructions(mockClient, {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: '1000000',
        taker: '11111111111111111111111111111111',
      });

      expect(result.altAddresses).toHaveLength(2);
      expect(result.altAddresses).toContain('7iBnR91CiHD1eFuSY38Hv5uiNaW4Ju33vekd8yjrqoq');
    });

    it('extracts compute budget instructions from response', async () => {
      const { buildSwapInstructions } = await import('../../apps/engine/src/execution/swapBuilder.js');

      const mockClient = {
        get: vi.fn().mockResolvedValue(MOCK_BUILD_RESPONSE),
        post: vi.fn(),
      } as never;

      const result = await buildSwapInstructions(mockClient, {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: '1000000',
        taker: '11111111111111111111111111111111',
      });

      expect(result.computeBudgetInstructions).toHaveLength(1);
      expect(result.computeBudgetInstructions[0]!.programId.toBase58()).toBe(
        'ComputeBudget111111111111111111111111111111'
      );
    });

    it('handles missing cleanupInstruction gracefully', async () => {
      const { buildSwapInstructions } = await import('../../apps/engine/src/execution/swapBuilder.js');

      const noCleanup = { ...MOCK_BUILD_RESPONSE, cleanupInstruction: null };
      const mockClient = { get: vi.fn().mockResolvedValue(noCleanup), post: vi.fn() } as never;

      const result = await buildSwapInstructions(mockClient, {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: '1000000',
        taker: '11111111111111111111111111111111',
      });

      expect(result.cleanupInstruction).toBeNull();
    });

    it('extracts inAmount and outAmount', async () => {
      const { buildSwapInstructions } = await import('../../apps/engine/src/execution/swapBuilder.js');

      const mockClient = { get: vi.fn().mockResolvedValue(MOCK_BUILD_RESPONSE), post: vi.fn() } as never;

      const result = await buildSwapInstructions(mockClient, {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: '1000000',
        taker: '11111111111111111111111111111111',
      });

      expect(result.inAmount).toBe('1000000');
      expect(result.outAmount).toBe('83829');
    });
  });
});
