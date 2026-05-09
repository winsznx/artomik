'use client';

import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, Pause, Play } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useSSE } from '@/hooks/useSSE';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/cn';

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-cyan-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
  debug: 'text-gray-500',
};

const FILTER_OPTIONS = ['all', 'info', 'warn', 'error', 'debug'] as const;

export default function LogsPage() {
  const { logs, connected } = useSSE();
  const { activeLogFilter, setActiveLogFilter } = useUiStore();
  const terminalRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const filtered = activeLogFilter === 'all'
    ? logs
    : logs.filter(l => l.level === activeLogFilter);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-[var(--font-display)] font-semibold">Live Terminal</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors',
              autoScroll ? 'text-[var(--accent-success)] bg-emerald-500/10' : 'text-[var(--accent-warning)] bg-amber-500/10',
            )}
          >
            {autoScroll ? <><Play size={12} /> Auto-scroll</> : <><Pause size={12} /> Paused</>}
          </button>
          {connected
            ? <span className="flex items-center gap-1.5 text-xs text-[var(--accent-success)]"><Wifi size={14} /> Connected</span>
            : <span className="flex items-center gap-1.5 text-xs text-[var(--accent-danger)]"><WifiOff size={14} /> Disconnected</span>
          }
        </div>
      </div>

      <div className="flex items-center gap-1">
        {FILTER_OPTIONS.map(f => (
          <button
            key={f}
            onClick={() => setActiveLogFilter(f as 'all' | 'info' | 'warn' | 'error')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
              activeLogFilter === f
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]',
            )}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-[var(--text-tertiary)]">{filtered.length} entries</span>
      </div>

      <GlassCard className="overflow-hidden" hover={false}>
        <div
          ref={terminalRef}
          className="h-[calc(100vh-260px)] overflow-y-auto p-4 bg-[var(--bg-terminal)] rounded-[var(--radius-lg)] font-mono text-[11px] leading-6"
        >
          {filtered.length === 0 ? (
            <div className="text-gray-600 text-center py-8">Waiting for log entries...</div>
          ) : (
            filtered.map((entry) => (
              <div
                key={entry.id}
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                className="py-px cursor-pointer hover:bg-white/5 px-2 rounded break-all"
              >
                <span className="text-gray-600 select-none">{entry.created_at?.split('T')[1]?.slice(0, 8) ?? ''} </span>
                <span className={cn('uppercase font-bold', LEVEL_COLORS[entry.level] ?? 'text-gray-500')}>
                  {entry.level.padEnd(5)}
                </span>
                <span className="text-indigo-400"> {entry.module} </span>
                <span className="text-[var(--text-on-dark)] break-words">{entry.message}</span>
                {expandedId === entry.id && entry.data && (
                  <pre className="mt-1 ml-4 p-2 bg-white/5 rounded text-gray-400 whitespace-pre-wrap text-[10px] max-h-40 overflow-y-auto break-all">
                    {typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
          <div className="inline-block w-2 h-4 bg-[var(--accent-primary)] animate-pulse" />
        </div>
      </GlassCard>
    </div>
  );
}
