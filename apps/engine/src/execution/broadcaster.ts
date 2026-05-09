import {
  Connection,
  VersionedTransaction,
} from '@solana/web3.js';
import { classifyError, type ClassifiedError } from '../infra/errorHandler.js';
import { logger } from '../infra/logger.js';

export interface SimulationResult {
  success: boolean;
  computeUnits?: number;
  error?: ClassifiedError;
  logs?: string[];
}

export interface BroadcastResult {
  success: boolean;
  signature?: string;
  path?: 'helius' | 'rpc_fallback';
  latencyMs?: number;
  computeUnits?: number;
  error?: ClassifiedError;
}

export async function simulateTransaction(
  tx: VersionedTransaction,
  connection: Connection,
): Promise<SimulationResult> {
  try {
    const sim = await connection.simulateTransaction(tx, {
      replaceRecentBlockhash: true,
    });

    if (sim.value.err) {
      const classified = classifyError(sim.value.err, 'simulation');
      logger.error({
        module: 'broadcaster',
        message: 'Simulation failed',
        data: {
          category: classified.category,
          code: classified.code,
          errorMessage: classified.message,
          logs: sim.value.logs?.slice(-5),
        },
      });
      return { success: false, error: classified, logs: sim.value.logs ?? undefined };
    }

    logger.info({
      module: 'broadcaster',
      message: 'Simulation passed',
      data: { computeUnits: sim.value.unitsConsumed },
    });

    return {
      success: true,
      computeUnits: sim.value.unitsConsumed ?? undefined,
      logs: sim.value.logs ?? undefined,
    };
  } catch (err) {
    const classified = classifyError(err, 'simulation');
    logger.error({
      module: 'broadcaster',
      message: 'Simulation RPC error',
      data: { category: classified.category, errorMessage: classified.message },
    });
    return { success: false, error: classified };
  }
}

export async function broadcastTransaction(
  tx: VersionedTransaction,
  connection: Connection,
  heliusSenderUrl?: string,
): Promise<BroadcastResult> {
  const simResult = await simulateTransaction(tx, connection);
  if (!simResult.success) {
    return {
      success: false,
      computeUnits: simResult.computeUnits,
      error: simResult.error,
    };
  }

  const serialized = tx.serialize();

  if (heliusSenderUrl) {
    const heliusResult = await tryHelius(serialized, heliusSenderUrl);
    if (heliusResult) {
      return {
        ...heliusResult,
        computeUnits: simResult.computeUnits,
      };
    }
  }

  return tryRpcFallback(serialized, connection, simResult.computeUnits);
}

async function tryHelius(
  serializedTx: Uint8Array,
  heliusSenderUrl: string,
): Promise<BroadcastResult | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const startMs = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const txBase64 = Buffer.from(serializedTx).toString('base64');

      const response = await fetch(heliusSenderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendTransaction',
          params: [
            txBase64,
            { encoding: 'base64', skipPreflight: true, maxRetries: 0 },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - startMs;

      if (response.ok) {
        const data = await response.json() as { result?: string; error?: unknown };
        if (data.result) {
          logger.info({
            module: 'broadcaster',
            message: 'Helius broadcast succeeded',
            data: { signature: data.result, latencyMs, attempt },
          });
          return {
            success: true,
            signature: data.result,
            path: 'helius',
            latencyMs,
          };
        }
      }

      logger.warn({
        module: 'broadcaster',
        message: `Helius attempt ${attempt + 1} failed`,
        data: { status: response.status, latencyMs },
      });
    } catch (err) {
      clearTimeout(timeout);
      const latencyMs = Date.now() - startMs;
      logger.warn({
        module: 'broadcaster',
        message: `Helius attempt ${attempt + 1} error`,
        data: { error: err instanceof Error ? err.message : String(err), latencyMs },
      });
    }
  }

  return null;
}

async function tryRpcFallback(
  serializedTx: Uint8Array,
  connection: Connection,
  computeUnits?: number,
): Promise<BroadcastResult> {
  const startMs = Date.now();

  try {
    const signature = await connection.sendRawTransaction(serializedTx, {
      skipPreflight: true,
      maxRetries: 2,
    });

    const latencyMs = Date.now() - startMs;

    logger.info({
      module: 'broadcaster',
      message: 'RPC fallback broadcast succeeded',
      data: { signature, latencyMs },
    });

    return {
      success: true,
      signature,
      path: 'rpc_fallback',
      latencyMs,
      computeUnits,
    };
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    const classified = classifyError(err, 'broadcast');

    logger.error({
      module: 'broadcaster',
      message: 'RPC fallback broadcast failed',
      data: { category: classified.category, latencyMs },
    });

    return {
      success: false,
      error: classified,
      computeUnits,
    };
  }
}
