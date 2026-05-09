import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ tokens: [] });

  try {
    const tokens = db.prepare('SELECT * FROM watched_tokens ORDER BY organic_score DESC').all();
    return NextResponse.json({ tokens });
  } catch {
    return NextResponse.json({ tokens: [] });
  }
}
