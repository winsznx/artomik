import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import { getDbWithDebug } from '@/lib/db';

export async function GET() {
  const { db, path: dbPath, error } = getDbWithDebug();

  if (!db) {
    let dataDir: string[] | string = 'unreadable';
    try { dataDir = fs.readdirSync('/data'); } catch (e) { dataDir = String(e); }
    let rootDir: string[] | string = 'unreadable';
    try { rootDir = fs.readdirSync('/').filter(n => !n.startsWith('.')); } catch (e) { rootDir = String(e); }
    return NextResponse.json({
      tokens: [],
      _debug: {
        dbPath,
        error,
        envDbPath: process.env.DB_PATH,
        cwd: process.cwd(),
        dataDir,
        rootDir,
      },
    });
  }

  try {
    const tokens = db.prepare('SELECT * FROM watched_tokens ORDER BY organic_score DESC').all();
    return NextResponse.json({ tokens });
  } catch (err) {
    return NextResponse.json({ tokens: [], _debug: { dbPath, queryError: String(err) } }, { status: 500 });
  }
}
