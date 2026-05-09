import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const EMPTY_STATE = { status: 'stopped', cycle_count: 0, total_pnl_usd: 0, loss_today_usd: 0, last_cycle_at: null };

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json(EMPTY_STATE);

  try {
    const state = db.prepare('SELECT * FROM engine_state WHERE id = 1').get();
    return NextResponse.json(state ?? EMPTY_STATE);
  } catch {
    return NextResponse.json(EMPTY_STATE);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { status?: string };
    if (!body.status || !['running', 'paused', 'stopped'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    return NextResponse.json({
      message: `Status change to '${body.status}' noted. Engine reads state from DB each cycle.`,
      note: 'Dashboard DB is read-only. Use engine CLI or write directly to DB to change state.',
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
