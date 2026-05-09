import type Database from 'better-sqlite3';
import type { LogLevel, LogEntry } from '@artomik/shared';

let _db: Database.Database | null = null;
let _minLevel: LogLevel = 'debug';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function initLogger(db: Database.Database, minLevel: LogLevel = 'debug'): void {
  _db = db;
  _minLevel = minLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[_minLevel];
}

function writeLog(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return;

  const json = JSON.stringify(entry);
  process.stdout.write(json + '\n');

  if (_db) {
    try {
      _db.prepare(
        'INSERT INTO execution_log (level, module, message, data) VALUES (?, ?, ?, ?)'
      ).run(
        entry.level,
        entry.module,
        entry.message,
        entry.data ? JSON.stringify(entry.data) : null,
      );
    } catch {
      process.stderr.write(`Failed to write log to database: ${json}\n`);
    }
  }
}

function createEntry(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...(data !== undefined ? { data } : {}),
  };
}

export const logger = {
  debug(params: { module: string; message: string; data?: Record<string, unknown> }): void {
    writeLog(createEntry('debug', params.module, params.message, params.data));
  },
  info(params: { module: string; message: string; data?: Record<string, unknown> }): void {
    writeLog(createEntry('info', params.module, params.message, params.data));
  },
  warn(params: { module: string; message: string; data?: Record<string, unknown> }): void {
    writeLog(createEntry('warn', params.module, params.message, params.data));
  },
  error(params: { module: string; message: string; data?: Record<string, unknown> }): void {
    writeLog(createEntry('error', params.module, params.message, params.data));
  },
};
