import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type AddressLookupTableAccount,
  type TransactionInstruction,
} from '@solana/web3.js';
import type { FlashloanInstructions } from './flashloan.js';
import type { SwapBuildResult } from './swapBuilder.js';
import { logger } from '../infra/logger.js';

const MAX_TX_SIZE_BYTES = 1232;

export interface AssembledTransaction {
  transaction: VersionedTransaction;
  sizeBytes: number;
}

interface AssembleParams {
  flashloan: FlashloanInstructions;
  swap: SwapBuildResult;
  payer: Keypair;
  connection: Connection;
}

export async function assembleAtomicTransaction(params: AssembleParams): Promise<AssembledTransaction> {
  const { flashloan, swap, payer, connection } = params;

  const altAccounts = await fetchAltAccounts(swap.altAddresses, connection);

  const instructions: TransactionInstruction[] = [
    ...swap.computeBudgetInstructions,
    flashloan.borrowIx,
    ...swap.setupInstructions,
    swap.swapInstruction,
    ...(swap.cleanupInstruction ? [swap.cleanupInstruction] : []),
    flashloan.repayIx,
  ];

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(altAccounts);

  const transaction = new VersionedTransaction(message);

  const serialized = transaction.serialize();
  const sizeBytes = serialized.length;

  logger.info({
    module: 'txAssembler',
    message: 'Transaction assembled',
    data: {
      sizeBytes,
      maxBytes: MAX_TX_SIZE_BYTES,
      withinLimit: sizeBytes <= MAX_TX_SIZE_BYTES,
      instructionCount: instructions.length,
      altCount: altAccounts.length,
      lastValidBlockHeight,
    },
  });

  if (sizeBytes > MAX_TX_SIZE_BYTES) {
    logger.error({
      module: 'txAssembler',
      message: `Transaction exceeds size limit: ${sizeBytes} > ${MAX_TX_SIZE_BYTES} bytes`,
      data: { sizeBytes, limit: MAX_TX_SIZE_BYTES },
    });
  }

  return { transaction, sizeBytes };
}

async function fetchAltAccounts(
  altAddresses: string[],
  connection: Connection,
): Promise<AddressLookupTableAccount[]> {
  if (altAddresses.length === 0) return [];

  const results = await Promise.all(
    altAddresses.map(addr =>
      connection.getAddressLookupTable(new PublicKey(addr))
    ),
  );

  const valid = results
    .map(r => r.value)
    .filter((a): a is AddressLookupTableAccount => a !== null);

  logger.debug({
    module: 'txAssembler',
    message: `Fetched ALTs: ${valid.length}/${altAddresses.length}`,
  });

  return valid;
}

export { MAX_TX_SIZE_BYTES, fetchAltAccounts };
