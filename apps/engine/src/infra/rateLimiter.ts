import { logger } from './logger.js';

export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRateMs: number;
  private lastRefill: number;
  private backoffAttempt: number;
  private readonly maxBackoffAttempts: number;

  constructor(rps: number, maxBackoffAttempts = 3) {
    this.maxTokens = Math.max(1, Math.floor(rps));
    this.tokens = this.maxTokens;
    this.refillRateMs = 1000 / rps;
    this.lastRefill = Date.now();
    this.backoffAttempt = 0;
    this.maxBackoffAttempts = maxBackoffAttempts;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const waitMs = this.refillRateMs - (Date.now() - this.lastRefill);
    if (waitMs > 0) {
      await this.sleep(waitMs);
    }
    this.refill();
    this.tokens -= 1;
  }

  reportRateLimit(): void {
    this.backoffAttempt += 1;

    if (this.backoffAttempt > this.maxBackoffAttempts) {
      throw new Error(`Rate limit backoff exceeded after ${this.maxBackoffAttempts} attempts`);
    }

    const delayMs = this.calculateBackoff(this.backoffAttempt);
    logger.warn({
      module: 'rateLimiter',
      message: `Rate limited. Backing off ${delayMs}ms (attempt ${this.backoffAttempt}/${this.maxBackoffAttempts})`,
    });
  }

  async waitForBackoff(): Promise<void> {
    if (this.backoffAttempt === 0) return;
    const delayMs = this.calculateBackoff(this.backoffAttempt);
    await this.sleep(delayMs);
  }

  reset(): void {
    this.backoffAttempt = 0;
  }

  calculateBackoff(attempt: number): number {
    const base = Math.pow(2, attempt) * 1000;
    const jitter = Math.floor(Math.random() * 500);
    return Math.min(base + jitter, 16000);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed / this.refillRateMs;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
