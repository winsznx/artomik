import { describe, it, expect, vi } from 'vitest';
import { Keypair, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } from '@solana/web3.js';

vi.mock('../../apps/engine/src/infra/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { simulateTransaction, broadcastTransaction } from '../../apps/engine/src/execution/broadcaster.js';

function makeDummyTx(): VersionedTransaction {
  const payer = Keypair.generate();
  const ix = ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 });
  const msg = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: 'GfVcyD4kkTrj4bKcJcNnQ9dpuJBvG7c1NVfWMdkMePYj',
    instructions: [ix],
  }).compileToV0Message();
  return new VersionedTransaction(msg);
}

describe('broadcaster', () => {
  describe('simulateTransaction', () => {
    it('returns success when simulation passes', async () => {
      const tx = makeDummyTx();
      const mockConnection = {
        simulateTransaction: vi.fn().mockResolvedValue({
          value: { err: null, unitsConsumed: 50000, logs: ['Program log: ok'] },
        }),
      } as never;

      const result = await simulateTransaction(tx, mockConnection);
      expect(result.success).toBe(true);
      expect(result.computeUnits).toBe(50000);
    });

    it('returns failure when simulation has err', async () => {
      const tx = makeDummyTx();
      const mockConnection = {
        simulateTransaction: vi.fn().mockResolvedValue({
          value: { err: { InstructionError: [0, 'Custom'] }, unitsConsumed: 0, logs: ['Program log: fail'] },
        }),
      } as never;

      const result = await simulateTransaction(tx, mockConnection);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('handles RPC error gracefully', async () => {
      const tx = makeDummyTx();
      const mockConnection = {
        simulateTransaction: vi.fn().mockRejectedValue(new Error('RPC down')),
      } as never;

      const result = await simulateTransaction(tx, mockConnection);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('broadcastTransaction', () => {
    it('does NOT broadcast if simulation fails', async () => {
      const tx = makeDummyTx();
      const mockConnection = {
        simulateTransaction: vi.fn().mockResolvedValue({
          value: { err: { InstructionError: [0, 'Custom'] }, unitsConsumed: 0, logs: [] },
        }),
        sendRawTransaction: vi.fn(),
      } as never;

      const result = await broadcastTransaction(tx, mockConnection);
      expect(result.success).toBe(false);
      expect(mockConnection.sendRawTransaction).not.toHaveBeenCalled();
    });

    it('falls back to RPC if no Helius URL provided', async () => {
      const tx = makeDummyTx();
      const mockConnection = {
        simulateTransaction: vi.fn().mockResolvedValue({
          value: { err: null, unitsConsumed: 50000, logs: [] },
        }),
        sendRawTransaction: vi.fn().mockResolvedValue('mock-signature-123'),
      } as never;

      const result = await broadcastTransaction(tx, mockConnection);
      expect(result.success).toBe(true);
      expect(result.path).toBe('rpc_fallback');
      expect(result.signature).toBe('mock-signature-123');
    });

    it('tries Helius then falls back to RPC on Helius failure', async () => {
      const tx = makeDummyTx();
      const mockConnection = {
        simulateTransaction: vi.fn().mockResolvedValue({
          value: { err: null, unitsConsumed: 50000, logs: [] },
        }),
        sendRawTransaction: vi.fn().mockResolvedValue('rpc-sig-456'),
      } as never;

      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Helius down'));

      const result = await broadcastTransaction(tx, mockConnection, 'https://fake-helius.com');
      expect(result.success).toBe(true);
      expect(result.path).toBe('rpc_fallback');

      vi.restoreAllMocks();
    });

    it('records compute units from simulation', async () => {
      const tx = makeDummyTx();
      const mockConnection = {
        simulateTransaction: vi.fn().mockResolvedValue({
          value: { err: null, unitsConsumed: 75000, logs: [] },
        }),
        sendRawTransaction: vi.fn().mockResolvedValue('sig-789'),
      } as never;

      const result = await broadcastTransaction(tx, mockConnection);
      expect(result.computeUnits).toBe(75000);
    });
  });
});
