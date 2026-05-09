'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { StatusDot } from '@/components/ui/StatusDot';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useEngineState } from '@/hooks/useEngineState';
import { useMetrics } from '@/hooks/useData';
import { formatUsd, formatDuration, formatNumber } from '@/lib/formatters';

export default function SettingsPage() {
  const { data: state, isLoading: stateLoading } = useEngineState();
  const { data: metrics, isLoading: metricsLoading } = useMetrics();

  if (stateLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-[var(--font-display)] font-semibold">Settings</h1>
        <SkeletonCard /><SkeletonCard />
      </div>
    );
  }

  const startTime = state?.loss_reset_at ? new Date(state.loss_reset_at).getTime() : Date.now();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-[var(--font-display)] font-semibold">Settings</h1>

      <GlassCard className="p-4" hover={false}>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Engine Controls</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-secondary)]">Status:</span>
            <StatusDot status={state?.status ?? 'stopped'} />
            <span className="capitalize font-medium">{state?.status ?? 'stopped'}</span>
          </div>
          <div><span className="text-[var(--text-secondary)]">Uptime:</span> <span className="font-mono">{formatDuration(Date.now() - startTime)}</span></div>
          <div><span className="text-[var(--text-secondary)]">Cycles:</span> <span className="font-mono">{state?.cycle_count ?? 0}</span></div>
          <div>
            <span className="text-[var(--text-secondary)]">Loss today:</span>{' '}
            <span className="font-mono">{formatUsd(state?.loss_today_usd ?? 0)}</span>
            <span className="text-[var(--text-tertiary)]"> / $5.00 cap</span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="px-4 py-2 text-xs font-medium rounded-[var(--radius-md)] bg-[var(--accent-warning)]/10 text-[var(--accent-warning)] hover:bg-[var(--accent-warning)]/20 transition-colors">
            Pause
          </button>
          <button className="px-4 py-2 text-xs font-medium rounded-[var(--radius-md)] bg-[var(--accent-danger)]/10 text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/20 transition-colors">
            Stop
          </button>
        </div>
      </GlassCard>

      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard className="p-4" hover={false}>
          <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Wallet Info</h2>
          <div className="space-y-2 text-sm">
            <div className="font-mono text-xs text-[var(--text-tertiary)]">
              Address: connected via engine
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4" hover={false}>
          <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">API Status</h2>
          {metricsLoading ? <SkeletonCard /> :
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><StatusDot status="running" /> Jupiter API</div>
              <span className="text-xs text-[var(--text-tertiary)]">{formatNumber(metrics?.totalCalls ?? 0, 0)} calls</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Success rate</span>
              <span className="text-xs font-mono">{metrics?.successRate ?? 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">429s</span>
              <span className="text-xs font-mono">{metrics?.rateLimitedCount ?? 0}</span>
            </div>
          </div>
          }
        </GlassCard>
      </div>

      <GlassCard className="p-4" hover={false}>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Engine Parameters</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: 'Volatility Threshold (σ)', value: '2.0' },
            { label: 'Min Organic Score', value: '60' },
            { label: 'SL Slippage (bps)', value: '300' },
            { label: 'Max Daily Loss ($)', value: '5.00' },
            { label: 'Poll Interval (ms)', value: '5000' },
            { label: 'Circuit Breaker', value: '3 failures' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface)]">
              <span className="text-xs text-[var(--text-secondary)]">{label}</span>
              <span className="text-xs font-mono">{value}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
