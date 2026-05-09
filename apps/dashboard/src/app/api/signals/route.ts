import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ tokens: [], _debug: 'no db' });

  try {
    const tokens = db.prepare('SELECT * FROM watched_tokens ORDER BY organic_score DESC').all();
    return NextResponse.json({ tokens });
  } catch (err) {
    return NextResponse.json({ tokens: [], _debug: String(err) }, { status: 500 });
  }
}
