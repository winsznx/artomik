'use client';

import { cn } from '@/lib/cn';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className, hover = true }: GlassCardProps) {
  return (
    <div className={cn(
      'rounded-[var(--radius-lg)] border border-[var(--glass-border)]',
      'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]',
      'shadow-[var(--glass-shadow)] transition-all duration-200',
      hover && 'hover:bg-[var(--bg-surface-hover)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5',
      className,
    )}>
      {children}
    </div>
  );
}
