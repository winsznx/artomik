import { Connection, PublicKey, type TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
import { logger } from '../infra/logger.js';

export interface FlashloanInstructions {
  borrowIx: TransactionInstruction;
  repayIx: TransactionInstruction;
  borrowAmount: bigint;
  asset: string;
}

interface BuildFlashloanParams {
  asset: string;
  amount: bigint;
  borrower: PublicKey;
  connection: Connection;
}

type FlashloanIxFn = (params: {
  connection: Connection;
  signer: PublicKey;
  asset: PublicKey;
  amount: BN;
}) => Promise<{ borrowIx: TransactionInstruction; paybackIx: TransactionInstruction }>;

let _getFlashloanIx: FlashloanIxFn | null = null;

async function loadFlashloanSdk(): Promise<FlashloanIxFn> {
  if (_getFlashloanIx) return _getFlashloanIx;

  try {
    const mod = await (Function('return import("@jup-ag/lend/flashloan")')() as Promise<{ getFlashloanIx: FlashloanIxFn }>);
    _getFlashloanIx = mod.getFlashloanIx;
    return _getFlashloanIx;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load @jup-ag/lend/flashloan: ${message}`);
  }
}

export async function buildFlashloanInstructions(params: BuildFlashloanParams): Promise<FlashloanInstructions> {
  const getFlashloanIx = await loadFlashloanSdk();

  const amount = new BN(params.amount.toString());

  logger.info({
    module: 'flashloan',
    message: 'Building flashloan instructions',
    data: { asset: params.asset, amount: params.amount.toString() },
  });

  const { borrowIx, paybackIx } = await getFlashloanIx({
    connection: params.connection,
    signer: params.borrower,
    asset: new PublicKey(params.asset),
    amount,
  });

  logger.info({
    module: 'flashloan',
    message: 'Flashloan instructions built',
    data: {
      borrowProgramId: borrowIx.programId.toBase58(),
      repayProgramId: paybackIx.programId.toBase58(),
      borrowKeys: borrowIx.keys.length,
      repayKeys: paybackIx.keys.length,
    },
  });

  return {
    borrowIx,
    repayIx: paybackIx,
    borrowAmount: params.amount,
    asset: params.asset,
  };
}
