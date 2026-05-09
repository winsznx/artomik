'use client';

import { cn } from '@/lib/cn';

const VARIANT_STYLES: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  danger: 'bg-red-500/10 text-red-500 border-red-500/20',
  warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  info: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  primary: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  neutral: 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]',
};

const TYPE_VARIANT: Record<string, string> = {
  flashloan_arb: 'primary',
  otoco: 'info',
  prediction: 'warning',
  dca: 'success',
  confirmed: 'success',
  failed: 'danger',
  active: 'info',
  broadcast: 'warning',
  simulated: 'neutral',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: string;
  type?: string;
  className?: string;
}

export function Badge({ children, variant, type, className }: BadgeProps) {
  const v = variant ?? (type ? TYPE_VARIANT[type] : undefined) ?? 'neutral';
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border',
      VARIANT_STYLES[v] ?? VARIANT_STYLES.neutral,
      className,
    )}>
      {children}
    </span>
  );
}
