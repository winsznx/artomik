import { NextResponse } from 'next/server';
import { getDbWithDebug } from '@/lib/db';

export async function GET() {
  const { db, path: dbPath, error } = getDbWithDebug();
  if (!db) return NextResponse.json({ tokens: [], _debug: { dbPath, error } });

  try {
    const tokens = db.prepare('SELECT * FROM watched_tokens ORDER BY organic_score DESC').all();
    return NextResponse.json({ tokens });
  } catch (err) {
    return NextResponse.json({ tokens: [], _debug: { dbPath, queryError: String(err) } }, { status: 500 });
  }
}
