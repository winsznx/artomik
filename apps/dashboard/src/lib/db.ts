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

function resolveDbPath(): string | null {
  if (process.env.DB_PATH) {
    const explicit = path.resolve(process.env.DB_PATH);
    return fs.existsSync(explicit) ? explicit : null;
  }

  const root = findProjectRoot();
  const candidates = [
    path.join(root, 'data', 'engine.sqlite'),
    path.join(root, 'data', 'demo.sqlite'),
    path.join(root, 'apps', 'dashboard', 'data', 'demo.sqlite'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function getDb(): Database.Database | null {
  if (_db) return _db;

  const dbPath = resolveDbPath();
  if (!dbPath) return null;

  try {
    _db = new Database(dbPath, { readonly: true, fileMustExist: true });
    _db.pragma('journal_mode = WAL');
    return _db;
  } catch {
    return null;
  }
}
