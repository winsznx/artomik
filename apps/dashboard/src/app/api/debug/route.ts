import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface FsEntry {
  name: string;
  size: number;
  mtime: string;
  isDir: boolean;
}

function listDir(dir: string): FsEntry[] | string {
  try {
    return fs.readdirSync(dir).map(name => {
      try {
        const stat = fs.statSync(path.join(dir, name));
        return { name, size: stat.size, mtime: stat.mtime.toISOString(), isDir: stat.isDirectory() };
      } catch (e) {
        return { name, size: 0, mtime: '', isDir: false, statError: String(e) } as FsEntry & { statError: string };
      }
    });
  } catch (e) {
    return String(e);
  }
}

export async function GET() {
  const dbPath = process.env.DB_PATH ?? '/app/data/engine.sqlite';
  const db = getDb();

  const result: Record<string, unknown> = {
    cwd: process.cwd(),
    dbPath,
    dbPathExists: fs.existsSync(dbPath),
    dbConnection: db ? 'open' : 'null',
    appDataDir: listDir('/app/data'),
  };
  const appDir = listDir('/app');
  result.appDir = Array.isArray(appDir) ? appDir.slice(0, 30) : appDir;

  if (db) {
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      result.tables = tables;
    } catch (e) {
      result.tablesError = String(e);
    }
    for (const table of ['engine_state', 'watched_tokens', 'trade_logs', 'execution_log', 'api_metrics']) {
      try {
        const count = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
        result[`count_${table}`] = count.c;
      } catch (e) {
        result[`count_${table}`] = String(e);
      }
    }
  }

  return NextResponse.json(result);
}
