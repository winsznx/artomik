import type Database from 'better-sqlite3';
import type { TokenInfo, TokenListResponse } from '@artomik/shared';
import { KNOWN_MINTS, upsertWatchedToken, getWatchedTokens, deleteWatchedToken } from '@artomik/shared';
import type { WatchedTokenRow } from '@artomik/shared';
import type { JupiterClient } from '../infra/jupiterClient.js';
import { logger } from '../infra/logger.js';

interface TokenFilterOptions {
  client: JupiterClient;
  db: Database.Database;
  minOrganicScore: number;
  maxTopHoldersPercentage: number;
}

const BYPASS_MINTS: Set<string> = new Set([
  KNOWN_MINTS.USDC,
  KNOWN_MINTS.USDT,
  KNOWN_MINTS.JupUSD,
  KNOWN_MINTS.SOL,
]);

export interface FilterResult {
  accepted: TokenInfo[];
  rejected: Array<{ token: TokenInfo; reason: string }>;
}

export class TokenFilter {
  private readonly client: JupiterClient;
  private readonly db: Database.Database;
  private readonly minOrganicScore: number;
  private readonly maxTopHoldersPercentage: number;

  constructor(options: TokenFilterOptions) {
    this.client = options.client;
    this.db = options.db;
    this.minOrganicScore = options.minOrganicScore;
    this.maxTopHoldersPercentage = options.maxTopHoldersPercentage;
  }

  async refreshWatchlist(): Promise<WatchedTokenRow[]> {
    let tokens: TokenInfo[];
    try {
      tokens = await this.client.get<TokenListResponse>('/tokens/v2/toporganicscore/24h');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({
        module: 'tokenFilter',
        message: `Failed to fetch tokens: ${message}`,
      });
      return this.getWatchlist();
    }

    if (!Array.isArray(tokens) || tokens.length === 0) {
      logger.warn({ module: 'tokenFilter', message: 'Token API returned empty results' });
      return this.getWatchlist();
    }

    const { accepted, rejected } = this.filterTokens(tokens);

    logger.info({
      module: 'tokenFilter',
      message: `Filtered tokens: ${accepted.length} accepted, ${rejected.length} rejected out of ${tokens.length}`,
    });

    for (const reason of rejected) {
      logger.debug({
        module: 'tokenFilter',
        message: `Rejected ${reason.token.symbol} (${reason.token.id}): ${reason.reason}`,
      });
    }

    const acceptedMints = new Set(accepted.map(t => t.id));
    const existingTokens = getWatchedTokens(this.db);
    for (const existing of existingTokens) {
      if (!acceptedMints.has(existing.mint)) {
        deleteWatchedToken(this.db, existing.mint);
      }
    }

    for (const token of accepted) {
      const row: WatchedTokenRow = {
        mint: token.id,
        symbol: token.symbol,
        name: token.name,
        icon_url: token.icon ?? null,
        organic_score: Math.round(token.organicScore),
        is_sus: 0,
        mint_authority_disabled: token.audit?.mintAuthorityDisabled ? 1 : 0,
        top_holder_concentration: token.audit?.topHoldersPercentage ?? null,
        current_price_usd: token.usdPrice ?? null,
        price_updated_at: new Date().toISOString(),
        volatility_flag: 0,
        updated_at: new Date().toISOString(),
      };
      upsertWatchedToken(this.db, row);
    }

    return this.getWatchlist();
  }

  getWatchlist(): WatchedTokenRow[] {
    return getWatchedTokens(this.db);
  }

  filterTokens(tokens: TokenInfo[]): FilterResult {
    const accepted: TokenInfo[] = [];
    const rejected: Array<{ token: TokenInfo; reason: string }> = [];

    for (const token of tokens) {
      const reason = this.getRejectReason(token);
      if (reason) {
        rejected.push({ token, reason });
      } else {
        accepted.push(token);
      }
    }

    return { accepted, rejected };
  }

  private getRejectReason(token: TokenInfo): string | null {
    if (BYPASS_MINTS.has(token.id)) {
      return null;
    }

    if (!token.audit) {
      return 'missing audit object';
    }

    if (!token.audit.mintAuthorityDisabled) {
      return 'mint authority not disabled';
    }

    if (token.organicScore < this.minOrganicScore) {
      return `organicScore ${token.organicScore.toFixed(1)} < ${this.minOrganicScore}`;
    }

    const topHoldersPct = token.audit.topHoldersPercentage > 1
      ? token.audit.topHoldersPercentage / 100
      : token.audit.topHoldersPercentage;

    if (topHoldersPct > this.maxTopHoldersPercentage) {
      return `topHoldersPercentage ${(topHoldersPct * 100).toFixed(1)}% > ${(this.maxTopHoldersPercentage * 100).toFixed(1)}%`;
    }

    return null;
  }
}
