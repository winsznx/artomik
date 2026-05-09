import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';

let _db: Database.Database | null = null;

function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')) as { name?: string };
      if (pkg.name === 'artomik') return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function resolveDbPath(): string {
  if (process.env.DB_PATH) {
    return path.resolve(process.env.DB_PATH);
  }
  const root = findProjectRoot();
  return path.join(root, 'data', 'engine.sqlite');
}

export function getDb(): Database.Database | null {
  if (_db) return _db;

  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) return null;

  try {
    _db = new Database(dbPath, { readonly: true });
    _db.pragma('journal_mode = WAL');
    return _db;
  } catch {
    return null;
  }
}
