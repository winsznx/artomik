export interface TokenAudit {
  mintAuthorityDisabled: boolean;
  freezeAuthorityDisabled: boolean;
  topHoldersPercentage: number;
  devMints: number;
}

export interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  icon: string | null;
  organicScore: number;
  organicScoreLabel?: string;
  audit: TokenAudit | null;
  tags: string[];
  usdPrice: number;
  liquidity: number;
  holderCount: number;
  isVerified?: boolean;
}

export type TokenListResponse = TokenInfo[];

export interface PriceEntry {
  createdAt: string;
  liquidity: number;
  usdPrice: number;
  blockId: number;
  decimals: number;
  priceChange24h: number;
}

export type PriceResponse = Record<string, PriceEntry | undefined>;

export interface SwapOrderResponse {
  requestId: string;
  transaction: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: unknown[];
  dynamicSlippageReport?: {
    slippageBps: number;
    otherAmount: string;
    simulatedIncurredSlippageBps: number;
  };
}

export interface SwapExecuteResponse {
  status: 'Success' | 'Failed';
  code: number;
  inputAmountResult?: string;
  outputAmountResult?: string;
  txId?: string;
  error?: string;
}

export interface SwapBuildInstruction {
  programId: string;
  accounts: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: string;
}

export interface SwapBuildResponse {
  swapInstruction: string;
  setupInstructions: string[];
  cleanupInstruction: string | null;
  addressLookupTableAddresses: string[];
  computeUnitLimit: number;
  computeUnitPrice: string;
  otherInstructions: string[];
  dynamicSlippageReport?: {
    slippageBps: number;
    otherAmount: string;
    simulatedIncurredSlippageBps: number;
  };
}

export interface TriggerAuthChallengeResponse {
  challenge: string;
}

export interface TriggerAuthVerifyResponse {
  token: string;
}

export interface TriggerVault {
  pubkey: string;
  token: string;
  amount: string;
}

export interface TriggerDepositResponse {
  transaction: string;
  requestId: string;
}

export type TriggerOrderType = 'single' | 'oco' | 'otoco';
export type TriggerCondition = 'above' | 'below';

export interface TriggerOrderParams {
  inputMint: string;
  outputMint: string;
  makingAmount: string;
  takingAmount: string;
  triggerCondition: TriggerCondition;
  triggerPrice: string;
  expiredAt: string | null;
  depositRequestId: string;
  depositSignedTx: string;
}

export interface TriggerOrderResponse {
  id: string;
  status: string;
}

export interface PredictionEvent {
  id: string;
  title: string;
  category: string;
  markets: PredictionMarket[];
}

export interface PredictionMarket {
  id: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
}

export interface PredictionOrderParams {
  ownerPubkey: string;
  marketId: string;
  depositMint: string;
  depositAmount: number;
  isBuy: boolean;
  isYes: boolean;
}

export interface PredictionOrderResponse {
  tx: string;
  orderId: string;
}

export interface RecurringCreateParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  interval: 'hourly' | 'daily' | 'weekly';
  totalCycles: number;
}

export interface RecurringCreateResponse {
  tx: string;
  scheduleId: string;
}
