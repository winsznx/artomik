import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../apps/engine/src/infra/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { RateLimiter } from '../../apps/engine/src/infra/rateLimiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to configured RPS', async () => {
    const limiter = new RateLimiter(2);
    await limiter.acquire();
    await limiter.acquire();
    // Two requests should succeed immediately at 2 RPS
  });

  it('blocks when bucket is empty', async () => {
    const limiter = new RateLimiter(1);
    await limiter.acquire();

    let resolved = false;
    const acquirePromise = limiter.acquire().then(() => { resolved = true; });

    // Should not resolve immediately
    await vi.advanceTimersByTimeAsync(500);
    expect(resolved).toBe(false);

    // Should resolve after enough time
    await vi.advanceTimersByTimeAsync(600);
    await acquirePromise;
    expect(resolved).toBe(true);
  });

  it('calculates exponential backoff correctly for attempt 1', () => {
    const limiter = new RateLimiter(1);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const delay = limiter.calculateBackoff(1);
    expect(delay).toBe(2000); // 2^1 * 1000 + 0 jitter
  });

  it('calculates exponential backoff correctly for attempt 2', () => {
    const limiter = new RateLimiter(1);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const delay = limiter.calculateBackoff(2);
    expect(delay).toBe(4000); // 2^2 * 1000 + 0 jitter
  });

  it('calculates exponential backoff correctly for attempt 3', () => {
    const limiter = new RateLimiter(1);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const delay = limiter.calculateBackoff(3);
    expect(delay).toBe(8000); // 2^3 * 1000 + 0 jitter
  });

  it('caps backoff at 16000ms', () => {
    const limiter = new RateLimiter(1);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const delay = limiter.calculateBackoff(5);
    expect(delay).toBe(16000); // min(2^5 * 1000, 16000) = 16000
  });

  it('throws after max backoff attempts', () => {
    const limiter = new RateLimiter(1, 3);
    limiter.reportRateLimit(); // attempt 1
    limiter.reportRateLimit(); // attempt 2
    limiter.reportRateLimit(); // attempt 3
    expect(() => limiter.reportRateLimit()).toThrow('Rate limit backoff exceeded after 3 attempts');
  });

  it('jitter adds randomness within expected range', () => {
    const limiter = new RateLimiter(1);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const delay = limiter.calculateBackoff(1);
    expect(delay).toBe(2250); // 2^1 * 1000 + floor(0.5 * 500)
  });

  it('reset clears backoff state', () => {
    const limiter = new RateLimiter(1, 2);
    limiter.reportRateLimit();
    limiter.reportRateLimit();
    limiter.reset();
    // Should not throw after reset
    limiter.reportRateLimit();
  });
});
