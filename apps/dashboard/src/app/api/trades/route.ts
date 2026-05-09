import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ trades: [], total: 0, limit: 0, offset: 0 });

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);
    const type = searchParams.get('type');

    let query = 'SELECT * FROM trade_logs';
    const params: (string | number)[] = [];

    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }

    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params);
    const total = db.prepare(
      type ? 'SELECT COUNT(*) as count FROM trade_logs WHERE type = ?' : 'SELECT COUNT(*) as count FROM trade_logs'
    ).get(...(type ? [type] : [])) as { count: number };

    return NextResponse.json({ trades: rows, total: total.count, limit, offset });
  } catch {
    return NextResponse.json({ trades: [], total: 0, limit: 0, offset: 0 });
  }
}
