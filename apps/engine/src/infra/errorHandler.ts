export enum ErrorCategory {
  RATE_LIMITED = 'RATE_LIMITED',
  SLIPPAGE = 'SLIPPAGE',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT',
  ACCOUNT_KEYS = 'ACCOUNT_KEYS',
  TOKEN_PROGRAM = 'TOKEN_PROGRAM',
  SIMULATION_FAILED = 'SIM_FAILED',
  TX_SIZE_EXCEEDED = 'TX_SIZE',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN',
}

export interface ClassifiedError {
  category: ErrorCategory;
  code: string | number;
  message: string;
  endpoint: string;
  suggestedAction: string;
  raw: unknown;
}

const SVM_CODE_MAP: Record<number, ErrorCategory> = {
  6001: ErrorCategory.SLIPPAGE,
  6008: ErrorCategory.ACCOUNT_KEYS,
  6014: ErrorCategory.TOKEN_PROGRAM,
  6017: ErrorCategory.SLIPPAGE,
  6024: ErrorCategory.INSUFFICIENT_FUNDS,
};

const SUGGESTED_ACTIONS: Record<ErrorCategory, string> = {
  [ErrorCategory.SLIPPAGE]: 'Increase slippageBps or enable dynamicSlippage',
  [ErrorCategory.ACCOUNT_KEYS]: 'Verify all accounts from /build response are included',
  [ErrorCategory.TOKEN_PROGRAM]: 'Check token standard (Token vs Token2022) pre-route',
  [ErrorCategory.INSUFFICIENT_FUNDS]: 'Check balance covers: amount + priority fee + rent-exemption',
  [ErrorCategory.TX_SIZE_EXCEEDED]: 'Enable ALT compression or reduce instruction count',
  [ErrorCategory.RATE_LIMITED]: 'Back off and retry — current tier limit reached',
  [ErrorCategory.SIMULATION_FAILED]: 'Re-simulate with updated blockhash and state',
  [ErrorCategory.NETWORK]: 'Retry with exponential backoff',
  [ErrorCategory.UNKNOWN]: 'Inspect raw error and logs for details',
};

function extractCode(error: unknown): string | number {
  if (error !== null && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if ('code' in e && (typeof e.code === 'number' || typeof e.code === 'string')) {
      return e.code;
    }
    if ('status' in e && typeof e.status === 'number') {
      return e.status;
    }
  }
  return 'UNKNOWN';
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error !== null && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if ('message' in e && typeof e.message === 'string') return e.message;
    if ('error' in e && typeof e.error === 'string') return e.error;
  }
  return String(error);
}

function categorizeByCode(code: string | number): ErrorCategory | null {
  if (typeof code === 'number') {
    if (SVM_CODE_MAP[code] !== undefined) {
      return SVM_CODE_MAP[code]!;
    }
    if (code === 429) return ErrorCategory.RATE_LIMITED;
    if (code >= 500 && code < 600) return ErrorCategory.NETWORK;
  }
  if (code === 'RATE_LIMITED') return ErrorCategory.RATE_LIMITED;
  return null;
}

function categorizeByError(error: unknown): ErrorCategory {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return ErrorCategory.NETWORK;
    if (error.name === 'TypeError' && error.message.includes('fetch')) return ErrorCategory.NETWORK;
  }

  const message = extractMessage(error).toLowerCase();
  if (message.includes('slippage')) return ErrorCategory.SLIPPAGE;
  if (message.includes('insufficient')) return ErrorCategory.INSUFFICIENT_FUNDS;
  if (message.includes('transaction too large') || message.includes('tx size')) return ErrorCategory.TX_SIZE_EXCEEDED;
  if (message.includes('simulation failed')) return ErrorCategory.SIMULATION_FAILED;
  if (message.includes('rate limit')) return ErrorCategory.RATE_LIMITED;

  return ErrorCategory.UNKNOWN;
}

export function classifyError(error: unknown, endpoint: string): ClassifiedError {
  const code = extractCode(error);
  const message = extractMessage(error);

  const category = categorizeByCode(code) ?? categorizeByError(error);

  return {
    category,
    code,
    message,
    endpoint,
    suggestedAction: SUGGESTED_ACTIONS[category],
    raw: error,
  };
}

export function isRetryable(category: ErrorCategory): boolean {
  return category === ErrorCategory.RATE_LIMITED || category === ErrorCategory.NETWORK;
}
