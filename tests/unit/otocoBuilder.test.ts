import { describe, it, expect, vi } from 'vitest';
import { Keypair } from '@solana/web3.js';

vi.mock('../../apps/engine/src/infra/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { OtocoBuilder } from '../../apps/engine/src/hedging/otocoBuilder.js';

function makeVaultManager(jwt: string | null = 'mock-jwt') {
  return { getJwt: () => jwt, authenticate: vi.fn(), getOrCreateVault: vi.fn(), craftDeposit: vi.fn() } as never;
}

function makeClient(postResult?: unknown) {
  return { get: vi.fn(), post: vi.fn().mockResolvedValue(postResult ?? { id: 'order-1', status: 'active' }) } as never;
}

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    inputMint: 'So11111111111111111111111111111111111111112',
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    amount: '1000000',
    triggerCondition: 'below' as const,
    triggerPriceUsd: '80.0',
    tpPriceUsd: '90.0',
    slPriceUsd: '75.0',
    slSlippageBps: 300,
    expiresAt: Date.now() + 3600000,
    ...overrides,
  };
}

describe('OtocoBuilder', () => {
  it('always includes slSlippageBps in order params', async () => {
    const client = makeClient();
    const builder = new OtocoBuilder(client, makeVaultManager());
    await builder.placeOtocoOrder(makeParams());

    const postCall = (client as { post: ReturnType<typeof vi.fn> }).post.mock.calls[0];
    expect(postCall[1].slSlippageBps).toBe(300);
  });

  it('rejects if expiresAt is in the past', async () => {
    const builder = new OtocoBuilder(makeClient(), makeVaultManager());
    const result = await builder.placeOtocoOrder(makeParams({ expiresAt: Date.now() - 1000 }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('future');
  });

  it('rejects if slSlippageBps is not set', async () => {
    const builder = new OtocoBuilder(makeClient(), makeVaultManager());
    const result = await builder.placeOtocoOrder(makeParams({ slSlippageBps: 0 }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('slSlippageBps');
  });

  it('rejects if not authenticated', async () => {
    const builder = new OtocoBuilder(makeClient(), makeVaultManager(null));
    const result = await builder.placeOtocoOrder(makeParams());
    expect(result.success).toBe(false);
    expect(result.error).toContain('authenticated');
  });

  it('validates minimum order amount', () => {
    expect(OtocoBuilder.validateMinimumOrder(5)).toContain('below');
    expect(OtocoBuilder.validateMinimumOrder(10)).toBeNull();
    expect(OtocoBuilder.validateMinimumOrder(100)).toBeNull();
  });

  it('places order successfully with valid params', async () => {
    const builder = new OtocoBuilder(makeClient(), makeVaultManager());
    const result = await builder.placeOtocoOrder(makeParams());
    expect(result.success).toBe(true);
    expect(result.orderId).toBe('order-1');
  });
});
