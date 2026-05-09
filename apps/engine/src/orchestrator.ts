import type Database from 'better-sqlite3';
import { Connection, Keypair } from '@solana/web3.js';
import type { EngineStatus, Signal } from '@artomik/shared';
import {
  KNOWN_MINTS,
  getEngineState,
  upsertEngineState,
  insertTradeLog,
} from '@artomik/shared';
import { buildFlashloanInstructions } from './execution/flashloan.js';
import type { EngineConfig } from './infra/config.js';
import { logger } from './infra/logger.js';
import { JupiterClient } from './infra/jupiterClient.js';
import { TokenFilter } from './intelligence/tokenFilter.js';
import { PriceMonitor } from './intelligence/priceMonitor.js';
import { VolatilityDetector } from './intelligence/volatilityDetector.js';
import { buildSwapInstructions } from './execution/swapBuilder.js';
import { assembleAtomicTransaction } from './execution/txAssembler.js';
import { simulateTransaction, broadcastTransaction } from './execution/broadcaster.js';
import { OtocoBuilder } from './hedging/otocoBuilder.js';
import { VaultManager } from './hedging/vaultManager.js';
import { MarketScanner } from './hedging/marketScanner.js';
import { CorrelationEngine } from './hedging/correlationEngine.js';
import { PredictionOrderPlacer } from './hedging/predictionOrderPlacer.js';
import { DcaScheduler } from './hedging/dcaScheduler.js';

export interface EngineMetrics {
  cycleCount: number;
  totalPnlUsd: number;
  lossTodayUsd: number;
  consecutiveFailures: number;
  status: EngineStatus;
  lastCycleMs: number;
}

export interface OrchestratorDeps {
  db: Database.Database;
  config: EngineConfig;
  connection: Connection;
  wallet: Keypair;
  client: JupiterClient;
  tokenFilter: TokenFilter;
  priceMonitor: PriceMonitor;
  volatilityDetector: VolatilityDetector;
  otocoBuilder: OtocoBuilder;
  vaultManager: VaultManager;
  marketScanner: MarketScanner;
  correlationEngine: CorrelationEngine;
  predictionOrderPlacer: PredictionOrderPlacer;
  dcaScheduler: DcaScheduler;
}

export class Orchestrator {
  private status: EngineStatus = 'stopped';
  private cycleCount = 0;
  private totalPnlUsd = 0;
  private lossTodayUsd = 0;
  private lossResetAt: string;
  private consecutiveFailures = 0;
  private lastCycleMs = 0;
  private running = false;

  private readonly db: Database.Database;
  private readonly config: EngineConfig;
  private readonly connection: Connection;
  private readonly wallet: Keypair;
  private readonly client: JupiterClient;
  private readonly tokenFilter: TokenFilter;
  private readonly priceMonitor: PriceMonitor;
  private readonly volatilityDetector: VolatilityDetector;
  private readonly otocoBuilder: OtocoBuilder;
  private readonly marketScanner: MarketScanner;
  private readonly correlationEngine: CorrelationEngine;
  private readonly predictionOrderPlacer: PredictionOrderPlacer;
  private readonly dcaScheduler: DcaScheduler;

  constructor(deps: OrchestratorDeps) {
    this.db = deps.db;
    this.config = deps.config;
    this.connection = deps.connection;
    this.wallet = deps.wallet;
    this.client = deps.client;
    this.tokenFilter = deps.tokenFilter;
    this.priceMonitor = deps.priceMonitor;
    this.volatilityDetector = deps.volatilityDetector;
    this.otocoBuilder = deps.otocoBuilder;
    this.marketScanner = deps.marketScanner;
    this.correlationEngine = deps.correlationEngine;
    this.predictionOrderPlacer = deps.predictionOrderPlacer;
    this.dcaScheduler = deps.dcaScheduler;
    this.lossResetAt = new Date().toISOString();
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.status = 'running';
    this.persistState();

    logger.info({ module: 'orchestrator', message: 'Engine loop started' });

    while (this.running) {
      this.checkExternalStatus();
      if (this.status !== 'running') {
        if (!this.running) break;
        await this.sleep(this.config.enginePollIntervalMs);
        continue;
      }

      this.resetDailyLossIfNeeded();

      const cycleStart = Date.now();
      try {
        await this.runCycle();
        this.consecutiveFailures = 0;
      } catch (err) {
        this.consecutiveFailures++;
        const message = err instanceof Error ? err.message : String(err);
        logger.error({
          module: 'orchestrator',
          message: `Cycle failed (${this.consecutiveFailures}/${this.config.circuitBreakerThreshold})`,
          data: { error: message },
        });

        insertTradeLog(this.db, {
          type: 'flashloan_arb',
          status: 'failed',
          input_mint: null,
          output_mint: null,
          input_amount: null,
          output_amount: null,
          profit_usd: null,
          tx_signature: null,
          compute_units: null,
          error_code: 'CYCLE_FAILURE',
          error_message: message,
          latency_ms: Date.now() - cycleStart,
        });
      }

      this.lastCycleMs = Date.now() - cycleStart;
      this.cycleCount++;
      this.persistState();

      if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
        logger.error({
          module: 'orchestrator',
          message: 'Circuit breaker triggered — engine paused',
          data: { failures: this.consecutiveFailures, threshold: this.config.circuitBreakerThreshold },
        });
        this.status = 'paused';
        this.persistState();
      }

      if (this.lossTodayUsd >= this.config.maxLossPer24hUsd) {
        logger.error({
          module: 'orchestrator',
          message: 'Daily loss cap reached — engine paused',
          data: { lossTodayUsd: this.lossTodayUsd, cap: this.config.maxLossPer24hUsd },
        });
        this.status = 'paused';
        this.persistState();
      }

      await this.sleep(this.config.enginePollIntervalMs);
    }

    logger.info({ module: 'orchestrator', message: 'Engine loop stopped' });
  }

  async pause(): Promise<void> {
    this.status = 'paused';
    this.persistState();
    logger.info({ module: 'orchestrator', message: 'Engine paused' });
  }

  async resume(): Promise<void> {
    this.status = 'running';
    this.consecutiveFailures = 0;
    this.persistState();
    logger.info({ module: 'orchestrator', message: 'Engine resumed' });
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
    this.running = false;
    this.persistState();
    logger.info({ module: 'orchestrator', message: 'Engine stopped' });
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  getMetrics(): EngineMetrics {
    return {
      cycleCount: this.cycleCount,
      totalPnlUsd: this.totalPnlUsd,
      lossTodayUsd: this.lossTodayUsd,
      consecutiveFailures: this.consecutiveFailures,
      status: this.status,
      lastCycleMs: this.lastCycleMs,
    };
  }

  private async runCycle(): Promise<void> {
    logger.info({ module: 'orchestrator', message: `Cycle ${this.cycleCount + 1} starting` });

    const tokens = await this.tokenFilter.refreshWatchlist();
    const mints = tokens.map(t => t.mint);

    const prices = await this.priceMonitor.pollPrices(mints);

    const symbolMap = new Map(tokens.map(t => [t.mint, t.symbol]));
    const signals = this.volatilityDetector.detectSignals(prices, symbolMap);

    if (signals.length === 0) {
      logger.debug({ module: 'orchestrator', message: 'No volatility signals this cycle' });
      return;
    }

    logger.info({
      module: 'orchestrator',
      message: `${signals.length} volatility signals detected`,
      data: { signals: signals.map(s => s.symbol) },
    });

    let cycleProfitUsd = 0;

    for (const signal of signals) {
      const tradeResult = await this.attemptArbitrage(signal);
      if (tradeResult !== null) {
        cycleProfitUsd += tradeResult;
      }

      await this.placeHedge(signal);
    }

    await this.attemptPredictionHedge(signals);

    if (cycleProfitUsd >= 100) {
      await this.reinvestProfits(cycleProfitUsd);
    }
  }

  private async attemptArbitrage(signal: Signal): Promise<number | null> {
    const startMs = Date.now();

    try {
      const swap = await buildSwapInstructions(this.client, {
        inputMint: signal.mint,
        outputMint: KNOWN_MINTS.USDC,
        amount: '1000000',
        taker: this.wallet.publicKey.toBase58(),
        slippageBps: this.config.slSlippageBps,
      });

      let flashloan;
      try {
        flashloan = await buildFlashloanInstructions({
          asset: KNOWN_MINTS.USDC,
          amount: BigInt(swap.inAmount),
          borrower: this.wallet.publicKey,
          connection: this.connection,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn({ module: 'orchestrator', message: `Flashloan build failed, simulating swap-only: ${msg}` });
        flashloan = {
          borrowIx: swap.setupInstructions[0]!,
          repayIx: swap.cleanupInstruction ?? swap.setupInstructions[0]!,
          borrowAmount: BigInt(swap.inAmount),
          asset: KNOWN_MINTS.USDC,
        };
      }

      const { transaction } = await assembleAtomicTransaction({
        flashloan,
        swap,
        payer: this.wallet,
        connection: this.connection,
      });

      const simResult = await simulateTransaction(transaction, this.connection);
      const latencyMs = Date.now() - startMs;

      if (!simResult.success) {
        insertTradeLog(this.db, {
          type: 'flashloan_arb',
          status: 'failed',
          input_mint: signal.mint,
          output_mint: KNOWN_MINTS.USDC,
          input_amount: swap.inAmount,
          output_amount: swap.outAmount,
          profit_usd: null,
          tx_signature: null,
          compute_units: simResult.computeUnits ?? null,
          error_code: simResult.error?.category ?? 'SIM_FAILED',
          error_message: simResult.error?.message ?? 'Simulation failed',
          latency_ms: latencyMs,
        });
        return null;
      }

      const inAmountUsd = signal.currentPriceUsd * (parseInt(swap.inAmount, 10) / 1e9);
      const outAmountUsd = parseInt(swap.outAmount, 10) / 1e6;
      const estimatedProfit = outAmountUsd - inAmountUsd;

      if (estimatedProfit <= 0) {
        insertTradeLog(this.db, {
          type: 'flashloan_arb',
          status: 'simulated',
          input_mint: signal.mint,
          output_mint: KNOWN_MINTS.USDC,
          input_amount: swap.inAmount,
          output_amount: swap.outAmount,
          profit_usd: estimatedProfit,
          tx_signature: null,
          compute_units: simResult.computeUnits ?? null,
          error_code: null,
          error_message: 'Not profitable',
          latency_ms: latencyMs,
        });
        return null;
      }

      const result = await broadcastTransaction(
        transaction,
        this.connection,
        this.config.heliusSenderUrl,
      );

      if (result.success) {
        this.totalPnlUsd += estimatedProfit;
        insertTradeLog(this.db, {
          type: 'flashloan_arb',
          status: 'broadcast',
          input_mint: signal.mint,
          output_mint: KNOWN_MINTS.USDC,
          input_amount: swap.inAmount,
          output_amount: swap.outAmount,
          profit_usd: estimatedProfit,
          tx_signature: result.signature ?? null,
          compute_units: result.computeUnits ?? null,
          error_code: null,
          error_message: null,
          latency_ms: latencyMs,
        });
        return estimatedProfit;
      }

      if (estimatedProfit < 0) {
        this.lossTodayUsd += Math.abs(estimatedProfit);
      }

      insertTradeLog(this.db, {
        type: 'flashloan_arb',
        status: 'failed',
        input_mint: signal.mint,
        output_mint: KNOWN_MINTS.USDC,
        input_amount: swap.inAmount,
        output_amount: swap.outAmount,
        profit_usd: null,
        tx_signature: null,
        compute_units: null,
        error_code: result.error?.category ?? 'BROADCAST_FAILED',
        error_message: result.error?.message ?? 'Broadcast failed',
        latency_ms: latencyMs,
      });
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      insertTradeLog(this.db, {
        type: 'flashloan_arb',
        status: 'failed',
        input_mint: signal.mint,
        output_mint: KNOWN_MINTS.USDC,
        input_amount: null,
        output_amount: null,
        profit_usd: null,
        tx_signature: null,
        compute_units: null,
        error_code: 'EXCEPTION',
        error_message: message,
        latency_ms: Date.now() - startMs,
      });
      return null;
    }
  }

  private async placeHedge(signal: Signal): Promise<void> {
    const startMs = Date.now();
    try {
      const result = await this.otocoBuilder.placeOtocoOrder({
        inputMint: KNOWN_MINTS.USDC,
        outputMint: signal.mint,
        amount: '10000000',
        triggerCondition: 'below',
        triggerPriceUsd: String(signal.currentPriceUsd * 0.98),
        tpPriceUsd: String(signal.currentPriceUsd * 1.05),
        slPriceUsd: String(signal.currentPriceUsd * 0.93),
        slSlippageBps: this.config.slSlippageBps,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
      insertTradeLog(this.db, {
        type: 'otoco',
        status: result.success ? 'broadcast' : 'failed',
        input_mint: KNOWN_MINTS.USDC,
        output_mint: signal.mint,
        input_amount: '10000000',
        output_amount: null,
        profit_usd: null,
        tx_signature: null,
        compute_units: null,
        error_code: result.success ? null : 'OTOCO_FAILED',
        error_message: result.error ?? null,
        latency_ms: Date.now() - startMs,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      insertTradeLog(this.db, {
        type: 'otoco',
        status: 'failed',
        input_mint: KNOWN_MINTS.USDC,
        output_mint: signal.mint,
        input_amount: null,
        output_amount: null,
        profit_usd: null,
        tx_signature: null,
        compute_units: null,
        error_code: 'EXCEPTION',
        error_message: message,
        latency_ms: Date.now() - startMs,
      });
    }
  }

  private async attemptPredictionHedge(signals: Signal[]): Promise<void> {
    try {
      const events = await this.marketScanner.getActiveEvents('crypto');
      if (events.length === 0) return;

      const positions = signals.map(s => ({
        mint: s.mint,
        symbol: s.symbol,
        direction: 'long' as const,
      }));

      const hedges = this.correlationEngine.findHedges(positions, events);

      for (const hedge of hedges.slice(0, 3)) {
        const startMs = Date.now();
        const result = await this.predictionOrderPlacer.placeOrder({
          marketId: hedge.marketId,
          isYes: hedge.position === 'yes',
          depositMint: KNOWN_MINTS.USDC,
          depositAmount: 2_000_000,
          ownerPubkey: this.wallet.publicKey.toBase58(),
        });
        insertTradeLog(this.db, {
          type: 'prediction',
          status: result.success ? 'broadcast' : 'failed',
          input_mint: KNOWN_MINTS.USDC,
          output_mint: hedge.marketId,
          input_amount: '2000000',
          output_amount: null,
          profit_usd: null,
          tx_signature: null,
          compute_units: null,
          error_code: result.success ? null : 'PREDICTION_FAILED',
          error_message: result.error ?? null,
          latency_ms: Date.now() - startMs,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ module: 'orchestrator', message: `Prediction hedge failed: ${message}` });
    }
  }

  private async reinvestProfits(profitUsd: number): Promise<void> {
    try {
      await this.dcaScheduler.createDcaOrders({
        inputMint: KNOWN_MINTS.USDC,
        totalAmount: String(profitUsd),
        interval: 'daily',
        totalCycles: 7,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ module: 'orchestrator', message: `DCA reinvestment failed: ${message}` });
    }
  }

  private checkExternalStatus(): void {
    const state = getEngineState(this.db);
    if (state && state.status !== this.status) {
      logger.info({
        module: 'orchestrator',
        message: `External status change: ${this.status} → ${state.status}`,
      });
      this.status = state.status as EngineStatus;
      if (this.status === 'stopped') {
        this.running = false;
      }
    }
  }

  private resetDailyLossIfNeeded(): void {
    const now = new Date();
    const resetDate = new Date(this.lossResetAt);
    if (now.getUTCDate() !== resetDate.getUTCDate() || now.getTime() - resetDate.getTime() > 86400000) {
      this.lossTodayUsd = 0;
      this.lossResetAt = now.toISOString();
      logger.info({ module: 'orchestrator', message: 'Daily loss counter reset' });
    }
  }

  private persistState(): void {
    upsertEngineState(this.db, {
      status: this.status,
      cycle_count: this.cycleCount,
      last_cycle_at: new Date().toISOString(),
      total_pnl_usd: this.totalPnlUsd,
      loss_today_usd: this.lossTodayUsd,
      loss_reset_at: this.lossResetAt,
      updated_at: new Date().toISOString(),
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
