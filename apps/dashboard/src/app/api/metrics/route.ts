import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const EMPTY_METRICS = { totalCalls: 0, rateLimitedCount: 0, successRate: 0, byEndpoint: [] };

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json(EMPTY_METRICS);

  try {
    const totalCalls = db.prepare('SELECT COUNT(*) as count FROM api_metrics').get() as { count: number };

    const avgLatency = db.prepare(
      'SELECT endpoint, AVG(latency_ms) as avg_latency, COUNT(*) as calls FROM api_metrics GROUP BY endpoint ORDER BY calls DESC LIMIT 20'
    ).all();

    const rateLimited = db.prepare(
      'SELECT COUNT(*) as count FROM api_metrics WHERE rate_limited = 1'
    ).get() as { count: number };

    const successRate = db.prepare(
      'SELECT ROUND(100.0 * SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) / COUNT(*), 1) as rate FROM api_metrics'
    ).get() as { rate: number | null };

    return NextResponse.json({
      totalCalls: totalCalls.count,
      rateLimitedCount: rateLimited.count,
      successRate: successRate.rate ?? 0,
      byEndpoint: avgLatency,
    });
  } catch {
    return NextResponse.json(EMPTY_METRICS);
  }
}
