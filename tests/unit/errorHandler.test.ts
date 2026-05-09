import { describe, it, expect } from 'vitest';
import { classifyError, isRetryable, ErrorCategory } from '../../apps/engine/src/infra/errorHandler.js';

describe('classifyError', () => {
  const endpoint = 'https://api.jup.ag/swap/v2/build';

  it('maps SVM code 6001 to SLIPPAGE', () => {
    const result = classifyError({ code: 6001, message: 'SlippageToleranceExceeded' }, endpoint);
    expect(result.category).toBe(ErrorCategory.SLIPPAGE);
  });

  it('maps SVM code 6008 to ACCOUNT_KEYS', () => {
    const result = classifyError({ code: 6008, message: 'NotEnoughAccountKeys' }, endpoint);
    expect(result.category).toBe(ErrorCategory.ACCOUNT_KEYS);
  });

  it('maps SVM code 6014 to TOKEN_PROGRAM', () => {
    const result = classifyError({ code: 6014, message: 'IncorrectTokenProgramID' }, endpoint);
    expect(result.category).toBe(ErrorCategory.TOKEN_PROGRAM);
  });

  it('maps SVM code 6017 to SLIPPAGE', () => {
    const result = classifyError({ code: 6017, message: 'ExactOutAmountNotMatched' }, endpoint);
    expect(result.category).toBe(ErrorCategory.SLIPPAGE);
  });

  it('maps SVM code 6024 to INSUFFICIENT_FUNDS', () => {
    const result = classifyError({ code: 6024, message: 'InsufficientFunds' }, endpoint);
    expect(result.category).toBe(ErrorCategory.INSUFFICIENT_FUNDS);
  });

  it('maps HTTP 429 to RATE_LIMITED', () => {
    const result = classifyError({ status: 429, message: 'Too Many Requests' }, endpoint);
    expect(result.category).toBe(ErrorCategory.RATE_LIMITED);
  });

  it('maps HTTP 500 to NETWORK', () => {
    const result = classifyError({ status: 500, message: 'Internal Server Error' }, endpoint);
    expect(result.category).toBe(ErrorCategory.NETWORK);
  });

  it('maps HTTP 502 to NETWORK', () => {
    const result = classifyError({ status: 502, message: 'Bad Gateway' }, endpoint);
    expect(result.category).toBe(ErrorCategory.NETWORK);
  });

  it('maps fetch AbortError to NETWORK', () => {
    const err = new DOMException('The operation was aborted', 'AbortError');
    const result = classifyError(err, endpoint);
    expect(result.category).toBe(ErrorCategory.NETWORK);
  });

  it('maps unknown errors to UNKNOWN', () => {
    const result = classifyError({ code: 9999, message: 'something weird' }, endpoint);
    expect(result.category).toBe(ErrorCategory.UNKNOWN);
  });

  it('maps string error to UNKNOWN', () => {
    const result = classifyError('random string error', endpoint);
    expect(result.category).toBe(ErrorCategory.UNKNOWN);
  });

  it('includes endpoint in classified error', () => {
    const result = classifyError({ code: 6001, message: 'test' }, endpoint);
    expect(result.endpoint).toBe(endpoint);
  });

  it('every classified error has non-empty suggestedAction', () => {
    const codes = [6001, 6008, 6014, 6017, 6024];
    for (const code of codes) {
      const result = classifyError({ code, message: 'test' }, endpoint);
      expect(result.suggestedAction).toBeTruthy();
      expect(result.suggestedAction.length).toBeGreaterThan(0);
    }
  });

  it('preserves raw error in result', () => {
    const raw = { code: 6001, message: 'test', extra: 'data' };
    const result = classifyError(raw, endpoint);
    expect(result.raw).toBe(raw);
  });
});

describe('isRetryable', () => {
  it('returns true for RATE_LIMITED', () => {
    expect(isRetryable(ErrorCategory.RATE_LIMITED)).toBe(true);
  });

  it('returns true for NETWORK', () => {
    expect(isRetryable(ErrorCategory.NETWORK)).toBe(true);
  });

  it('returns false for SLIPPAGE', () => {
    expect(isRetryable(ErrorCategory.SLIPPAGE)).toBe(false);
  });

  it('returns false for INSUFFICIENT_FUNDS', () => {
    expect(isRetryable(ErrorCategory.INSUFFICIENT_FUNDS)).toBe(false);
  });

  it('returns false for ACCOUNT_KEYS', () => {
    expect(isRetryable(ErrorCategory.ACCOUNT_KEYS)).toBe(false);
  });

  it('returns false for TOKEN_PROGRAM', () => {
    expect(isRetryable(ErrorCategory.TOKEN_PROGRAM)).toBe(false);
  });

  it('returns false for SIMULATION_FAILED', () => {
    expect(isRetryable(ErrorCategory.SIMULATION_FAILED)).toBe(false);
  });

  it('returns false for TX_SIZE_EXCEEDED', () => {
    expect(isRetryable(ErrorCategory.TX_SIZE_EXCEEDED)).toBe(false);
  });

  it('returns false for UNKNOWN', () => {
    expect(isRetryable(ErrorCategory.UNKNOWN)).toBe(false);
  });
});
