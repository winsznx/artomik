'use client';

import { TrendingUp, Target, Zap, Clock } from 'lucide-react';
import { PortfolioChart } from '@/components/overview/PortfolioChart';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useEngineState } from '@/hooks/useEngineState';
import { useTrades, usePositions } from '@/hooks/useData';
import { formatUsd, formatPnl, formatDuration, formatTime, formatAddress } from '@/lib/formatters';

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <GlassCard className="p-4">
      <div className="flex justify-between items-start">
        <span className="text-xs text-[var(--text-secondary)] font-medium">{label}</span>
        <Icon size={16} className="text-[var(--text-tertiary)]" />
      </div>
      <div className="mt-2 text-2xl font-mono font-bold">{value}</div>
      {sub && <div className={`mt-1 text-xs font-mono ${color ?? 'text-[var(--text-tertiary)]'}`}>{sub}</div>}
    </GlassCard>
  );
}

export default function OverviewPage() {
  const { data: state, isLoading: stateLoading } = useEngineState();
  const { data: tradesData, isLoading: tradesLoading } = useTrades(10);
  const { data: posData, isLoading: posLoading } = usePositions();

  if (stateLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  const pnl = state?.total_pnl_usd ?? 0;
  const activePositions = (posData?.otocoOrders?.length ?? 0) + (posData?.predictions?.length ?? 0);
  const tradesToday = tradesData?.total ?? 0;
  const startTime = state?.loss_reset_at ? new Date(state.loss_reset_at).getTime() : Date.now();
  const uptime = Date.now() - startTime;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-[var(--font-display)] font-semibold">Command Center</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total P&L" value={formatUsd(pnl)} sub={formatPnl(pnl)} icon={TrendingUp}
          color={pnl >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]'} />
        <StatCard label="Active Positions" value={String(activePositions)} icon={Target} />
        <StatCard label="Trades Today" value={String(tradesToday)} icon={Zap} />
        <StatCard label="Engine Uptime" value={formatDuration(uptime)} icon={Clock} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2 p-4" hover={false}>
          <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Portfolio Chart</h2>
          <PortfolioChart trades={(tradesData?.trades ?? []).map((t: Record<string, unknown>) => ({
            created_at: String(t.created_at),
            profit_usd: t.profit_usd != null ? Number(t.profit_usd) : null,
          }))} />
        </GlassCard>

        <GlassCard className="p-4" hover={false}>
          <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Active Positions</h2>
          {posLoading ? <SkeletonTable rows={3} /> :
           activePositions === 0 ? <EmptyState message="No active positions" /> :
           <div className="space-y-2">
            {(posData?.otocoOrders ?? []).slice(0, 3).map((o: Record<string, unknown>, i: number) => (
              <div key={i} className="p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-xs">
                <div className="flex items-center gap-2">
                  <Badge type="otoco">OTOCO</Badge>
                  <StatusDot status={String(o.status ?? 'active')} />
                </div>
              </div>
            ))}
            {(posData?.predictions ?? []).slice(0, 2).map((p: Record<string, unknown>, i: number) => (
              <div key={i} className="p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-xs">
                <Badge type="prediction">Prediction</Badge>
              </div>
            ))}
           </div>
          }
        </GlassCard>
      </div>

      <GlassCard className="p-4" hover={false}>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Recent Trades</h2>
        {tradesLoading ? <SkeletonTable rows={5} /> :
         !tradesData?.trades?.length ? <EmptyState message="No trades yet. Engine is warming up." /> :
         <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-tertiary)] border-b border-[var(--border-subtle)]">
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">P&L</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {tradesData.trades.map((t: Record<string, unknown>, i: number) => (
                <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="py-2 font-mono text-xs">{formatTime(String(t.created_at))}</td>
                  <td className="py-2"><Badge type={String(t.type)}>{String(t.type)}</Badge></td>
                  <td className={`py-2 font-mono text-xs ${Number(t.profit_usd) >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]'}`}>
                    {t.profit_usd != null ? formatPnl(Number(t.profit_usd)) : '—'}
                  </td>
                  <td className="py-2"><div className="flex items-center gap-1.5"><StatusDot status={String(t.status)} /><span className="text-xs capitalize">{String(t.status)}</span></div></td>
                  <td className="py-2 font-mono text-xs text-[var(--text-tertiary)]">{t.tx_signature ? formatAddress(String(t.tx_signature)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
         </div>
        }
      </GlassCard>
    </div>
  );
}
