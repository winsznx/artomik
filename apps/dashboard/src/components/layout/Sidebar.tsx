'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Radio, Zap, Target, RefreshCw, Terminal, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { StatusDot } from '@/components/ui/StatusDot';
import { useEngineState } from '@/hooks/useEngineState';
import { formatUsd, formatDuration } from '@/lib/formatters';

const NAV_ITEMS = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/signals', label: 'Signals', icon: Radio },
  { href: '/arbitrage', label: 'Arbitrage', icon: Zap },
  { href: '/positions', label: 'Positions', icon: Target },
  { href: '/reinvest', label: 'Reinvest', icon: RefreshCw },
  { href: '/logs', label: 'Logs', icon: Terminal },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: state } = useEngineState();

  return (
    <GlassPanel className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30 pt-16">
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href === '/overview' && pathname === '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors',
                active
                  ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]',
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <StatusDot status={state?.status ?? 'stopped'} />
          <span className="capitalize">{state?.status ?? 'stopped'}</span>
        </div>
        <div className="mt-1 text-xs font-mono text-[var(--text-tertiary)]">
          P&L: {formatUsd(state?.total_pnl_usd ?? 0)}
        </div>
        {state?.updated_at && (
          <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">
            Cycles: {state.cycle_count}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
