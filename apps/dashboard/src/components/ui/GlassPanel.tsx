'use client';

import { cn } from '@/lib/cn';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div className={cn(
      'rounded-[var(--radius-xl)] border border-[var(--glass-border)]',
      'bg-[var(--glass-bg)] backdrop-blur-[calc(var(--glass-blur)*1.25)]',
      'shadow-[var(--glass-shadow)]',
      className,
    )}>
      {children}
    </div>
  );
}
