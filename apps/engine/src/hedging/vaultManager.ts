import { Keypair, VersionedTransaction } from '@solana/web3.js';
import type { JupiterClient } from '../infra/jupiterClient.js';
import { logger } from '../infra/logger.js';

function signMessage(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nacl = require('tweetnacl') as { sign: { detached: (m: Uint8Array, sk: Uint8Array) => Uint8Array } };
  return nacl.sign.detached(message, secretKey);
}

export interface VaultInfo {
  pubkey: string;
  exists: boolean;
}

interface ChallengeResponse {
  type: string;
  challenge: string;
}

interface VerifyResponse {
  token: string;
}

interface DepositCraftResponse {
  transaction: string;
  requestId: string;
}

export class VaultManager {
  private readonly client: JupiterClient;
  private readonly wallet: Keypair;
  private jwt: string | null = null;

  constructor(client: JupiterClient, wallet: Keypair) {
    this.client = client;
    this.wallet = wallet;
  }

  async authenticate(): Promise<string> {
    const walletPubkey = this.wallet.publicKey.toBase58();

    logger.info({ module: 'vaultManager', message: 'Requesting auth challenge' });

    const challengeRes = await this.client.post<ChallengeResponse>('/trigger/v2/auth/challenge', {
      walletPubkey,
      type: 'message',
    });

    const messageBytes = new TextEncoder().encode(challengeRes.challenge);
    const signatureBytes = signMessage(messageBytes, this.wallet.secretKey);
    const signatureBase58 = this.encodeBase58(signatureBytes);

    logger.info({ module: 'vaultManager', message: 'Submitting signed challenge' });

    const verifyRes = await this.client.post<VerifyResponse>('/trigger/v2/auth/verify', {
      type: 'message',
      walletPubkey,
      signature: signatureBase58,
    });

    this.jwt = verifyRes.token;

    logger.info({ module: 'vaultManager', message: 'Trigger API authenticated' });

    return this.jwt;
  }

  async getOrCreateVault(): Promise<VaultInfo> {
    try {
      const vault = await this.client.get<VaultInfo>('/trigger/v2/vault');
      logger.info({ module: 'vaultManager', message: 'Vault found', data: { pubkey: vault.pubkey } });
      return { ...vault, exists: true };
    } catch {
      logger.info({ module: 'vaultManager', message: 'No vault found, registering' });

      await this.client.get<unknown>('/trigger/v2/vault/register');
      const vault = await this.client.get<VaultInfo>('/trigger/v2/vault');
      return { ...vault, exists: true };
    }
  }

  async craftDeposit(amount: string, mint: string): Promise<{ tx: VersionedTransaction; requestId: string }> {
    const res = await this.client.post<DepositCraftResponse>('/trigger/v2/deposit/craft', {
      amount,
      mint,
    });

    const txBytes = Buffer.from(res.transaction, 'base64');
    const tx = VersionedTransaction.deserialize(txBytes);

    logger.info({
      module: 'vaultManager',
      message: 'Deposit transaction crafted',
      data: { requestId: res.requestId, mint, amount },
    });

    return { tx, requestId: res.requestId };
  }

  getJwt(): string | null {
    return this.jwt;
  }

  private encodeBase58(bytes: Uint8Array): string {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt(0);
    for (const byte of bytes) {
      num = num * 256n + BigInt(byte);
    }
    let encoded = '';
    while (num > 0n) {
      const rem = Number(num % 58n);
      encoded = ALPHABET[rem] + encoded;
      num = num / 58n;
    }
    for (const byte of bytes) {
      if (byte !== 0) break;
      encoded = '1' + encoded;
    }
    return encoded || '1';
  }
}
