import * as path from 'node:path';
import { Connection, Keypair } from '@solana/web3.js';
import { initializeDatabase, KNOWN_MINTS } from '@artomik/shared';
import { JupiterClient } from '../apps/engine/src/infra/jupiterClient.js';
import { initLogger, logger } from '../apps/engine/src/infra/logger.js';
import { buildSwapInstructions } from '../apps/engine/src/execution/swapBuilder.js';

const DB_PATH = path.resolve('./data/validate-execution.sqlite');
const db = initializeDatabase(DB_PATH);
initLogger(db, 'debug');

async function main(): Promise<void> {
  const client = new JupiterClient({
    baseUrl: 'https://api.jup.ag',
    apiKey: '',
    rps: 1,
    db,
  });

  const dummyWallet = Keypair.generate();

  logger.info({ module: 'validate', message: '=== Step 1: Fetch /build response for SOL → USDC ===' });

  const swap = await buildSwapInstructions(client, {
    inputMint: KNOWN_MINTS.SOL,
    outputMint: KNOWN_MINTS.USDC,
    amount: '1000000',
    taker: dummyWallet.publicKey.toBase58(),
    slippageBps: 300,
  });

  logger.info({
    module: 'validate',
    message: 'Swap build result',
    data: {
      setupInstructionCount: swap.setupInstructions.length,
      hasCleanup: swap.cleanupInstruction !== null,
      computeBudgetCount: swap.computeBudgetInstructions.length,
      altCount: swap.altAddresses.length,
      altAddresses: swap.altAddresses,
      inAmount: swap.inAmount,
      outAmount: swap.outAmount,
    },
  });

  logger.info({ module: 'validate', message: '=== Step 2: Assemble atomic tx (swap-only, no flashloan) ===' });

  const connection = new Connection('https://api.mainnet-beta.solana.com');

  const { assembleAtomicTransaction } = await import('../apps/engine/src/execution/txAssembler.js');
  const { simulateTransaction } = await import('../apps/engine/src/execution/broadcaster.js');

  const dummyFlashloan = {
    borrowIx: swap.setupInstructions[0]!,
    repayIx: swap.setupInstructions[0]!,
    borrowAmount: 1000000n,
    asset: KNOWN_MINTS.USDC,
  };

  try {
    const { transaction, sizeBytes } = await assembleAtomicTransaction({
      flashloan: dummyFlashloan,
      swap,
      payer: dummyWallet,
      connection,
    });

    logger.info({
      module: 'validate',
      message: `Transaction assembled: ${sizeBytes} bytes`,
      data: { sizeBytes, underLimit: sizeBytes <= 1232, version: transaction.version },
    });

    logger.info({ module: 'validate', message: '=== Step 3: Simulate transaction ===' });

    const simResult = await simulateTransaction(transaction, connection);

    logger.info({
      module: 'validate',
      message: `Simulation result: ${simResult.success ? 'PASS' : 'FAIL'}`,
      data: {
        success: simResult.success,
        computeUnits: simResult.computeUnits,
        errorCategory: simResult.error?.category,
        errorMessage: simResult.error?.message,
      },
    });
  } catch (err) {
    logger.error({
      module: 'validate',
      message: 'Assembly/simulation failed',
      data: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  logger.info({ module: 'validate', message: '=== Execution validation complete ===' });
  db.close();
}

main().catch((err) => {
  logger.error({ module: 'validate', message: 'Validation failed', data: { error: String(err) } });
  db.close();
  process.exit(1);
});
