import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import type { JupiterClient } from '../infra/jupiterClient.js';
import { logger } from '../infra/logger.js';

export interface SwapBuildResult {
  setupInstructions: TransactionInstruction[];
  swapInstruction: TransactionInstruction;
  cleanupInstruction: TransactionInstruction | null;
  computeBudgetInstructions: TransactionInstruction[];
  altAddresses: string[];
  inAmount: string;
  outAmount: string;
}

interface RawInstruction {
  programId: string;
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  data: string;
}

interface BuildResponse {
  swapInstruction: RawInstruction;
  setupInstructions: RawInstruction[];
  cleanupInstruction: RawInstruction | null;
  computeBudgetInstructions: RawInstruction[];
  otherInstructions: RawInstruction[];
  addressesByLookupTableAddress: Record<string, string[]>;
  inAmount: string;
  outAmount: string;
  inputMint: string;
  outputMint: string;
  slippageBps: number;
  routePlan: unknown[];
  tipInstruction: RawInstruction | null;
}

function deserializeInstruction(raw: RawInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(raw.programId),
    keys: raw.accounts.map(acc => ({
      pubkey: new PublicKey(acc.pubkey),
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    })),
    data: Buffer.from(raw.data, 'base64'),
  });
}

interface BuildSwapParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  taker: string;
  slippageBps?: number;
  dynamicSlippage?: boolean;
}

export async function buildSwapInstructions(
  client: JupiterClient,
  params: BuildSwapParams,
): Promise<SwapBuildResult> {
  const queryParams: Record<string, string> = {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    taker: params.taker,
  };

  if (params.slippageBps !== undefined) {
    queryParams.slippageBps = String(params.slippageBps);
  }
  if (params.dynamicSlippage) {
    queryParams.dynamicSlippage = 'true';
  }

  logger.info({
    module: 'swapBuilder',
    message: 'Fetching /build instructions',
    data: { inputMint: params.inputMint, outputMint: params.outputMint, amount: params.amount },
  });

  const response = await client.get<BuildResponse>('/swap/v2/build', queryParams);

  const altAddresses = Object.keys(response.addressesByLookupTableAddress);

  const result: SwapBuildResult = {
    setupInstructions: response.setupInstructions.map(deserializeInstruction),
    swapInstruction: deserializeInstruction(response.swapInstruction),
    cleanupInstruction: response.cleanupInstruction
      ? deserializeInstruction(response.cleanupInstruction)
      : null,
    computeBudgetInstructions: response.computeBudgetInstructions.map(deserializeInstruction),
    altAddresses,
    inAmount: response.inAmount,
    outAmount: response.outAmount,
  };

  logger.info({
    module: 'swapBuilder',
    message: 'Swap instructions built',
    data: {
      setupCount: result.setupInstructions.length,
      altCount: altAddresses.length,
      inAmount: response.inAmount,
      outAmount: response.outAmount,
      slippageBps: response.slippageBps,
      routeSteps: response.routePlan.length,
    },
  });

  return result;
}

export { deserializeInstruction };
