'use client';

import { cn } from '@/lib/cn';

const STATUS_COLORS: Record<string, string> = {
  running: 'text-[var(--accent-success)]',
  paused: 'text-[var(--accent-warning)]',
  stopped: 'text-[var(--text-tertiary)]',
  error: 'text-[var(--accent-danger)]',
  confirmed: 'text-[var(--accent-success)]',
  failed: 'text-[var(--accent-danger)]',
  active: 'text-[var(--accent-info)]',
  broadcast: 'text-[var(--accent-warning)]',
  simulated: 'text-[var(--text-tertiary)]',
};

interface StatusDotProps {
  status: string;
  className?: string;
}

export function StatusDot({ status, className }: StatusDotProps) {
  const color = STATUS_COLORS[status] ?? 'text-[var(--text-tertiary)]';
  const shouldPulse = status === 'running' || status === 'error';

  return (
    <span className={cn(
      'inline-block w-2 h-2 rounded-full',
      shouldPulse && 'status-pulse',
      color,
      className,
    )} style={{ backgroundColor: 'currentColor' }} />
  );
}
