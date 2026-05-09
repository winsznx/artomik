import type Database from 'better-sqlite3';
import { insertApiMetric } from '@artomik/shared';
import { logger } from './logger.js';
import { RateLimiter } from './rateLimiter.js';
import { classifyError, isRetryable, type ClassifiedError } from './errorHandler.js';

interface JupiterClientOptions {
  baseUrl: string;
  apiKey: string;
  rps: number;
  db: Database.Database;
}

const RETRY_DELAYS = [1000, 2000, 4000];
const REQUEST_TIMEOUT_MS = 10000;

export class JupiterClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly rateLimiter: RateLimiter;
  private readonly db: Database.Database;

  constructor(options: JupiterClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.rateLimiter = new RateLimiter(options.rps);
    this.db = options.db;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    return this.request<T>('GET', url);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    return this.request<T>('POST', url, body);
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    let lastError: ClassifiedError | null = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      await this.rateLimiter.acquire();

      if (attempt > 0 && lastError && isRetryable(lastError.category)) {
        if (lastError.category === 'RATE_LIMITED') {
          this.rateLimiter.reportRateLimit();
          await this.rateLimiter.waitForBackoff();
        } else {
          const delay = RETRY_DELAYS[attempt - 1] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1]!;
          await this.sleep(delay);
        }
      }

      const startMs = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
        };
        if (this.apiKey) {
          headers['x-api-key'] = this.apiKey;
        }
        if (body !== undefined) {
          headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        const latencyMs = Date.now() - startMs;
        this.recordMetric(url, response.status, latencyMs, response.status === 429);

        logger.debug({
          module: 'jupiterClient',
          message: `${method} ${url}`,
          data: { status: response.status, latencyMs },
        });

        if (!response.ok) {
          const rawText = await response.text();
          let rawBody: unknown = rawText;
          try {
            rawBody = JSON.parse(rawText);
          } catch {
            // keep as text
          }
          const classified = classifyError(
            { status: response.status, code: response.status, message: rawText, ...((typeof rawBody === 'object' && rawBody !== null) ? rawBody : {}) },
            url,
          );

          if (isRetryable(classified.category) && attempt < RETRY_DELAYS.length) {
            lastError = classified;
            logger.warn({
              module: 'jupiterClient',
              message: `Retryable error (attempt ${attempt + 1}/${RETRY_DELAYS.length + 1})`,
              data: { category: classified.category, status: response.status, url },
            });
            continue;
          }

          throw classified;
        }

        this.rateLimiter.reset();
        return await response.json() as T;
      } catch (error) {
        clearTimeout(timeout);

        if (isClassifiedError(error)) {
          throw error;
        }

        const latencyMs = Date.now() - startMs;
        this.recordMetric(url, 0, latencyMs, false);

        const classified = classifyError(error, url);

        if (isRetryable(classified.category) && attempt < RETRY_DELAYS.length) {
          lastError = classified;
          logger.warn({
            module: 'jupiterClient',
            message: `Network error (attempt ${attempt + 1}/${RETRY_DELAYS.length + 1})`,
            data: { category: classified.category, url },
          });
          continue;
        }

        throw classified;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? classifyError(new Error('Request failed after all retries'), url);
  }

  private recordMetric(url: string, statusCode: number, latencyMs: number, rateLimited: boolean): void {
    try {
      insertApiMetric(this.db, {
        endpoint: url,
        status_code: statusCode,
        latency_ms: latencyMs,
        rate_limited: rateLimited ? 1 : 0,
      });
    } catch {
      // non-critical — don't fail requests because of metric recording
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

function isClassifiedError(error: unknown): error is ClassifiedError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'category' in error &&
    'suggestedAction' in error
  );
}
