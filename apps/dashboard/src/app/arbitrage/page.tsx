'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTrades } from '@/hooks/useData';
import { formatUsd, formatPnl, formatTime, formatAddress, formatNumber } from '@/lib/formatters';

export default function ArbitragePage() {
  const { data, isLoading } = useTrades(50);
  const allTrades = (data?.trades ?? []) as Array<Record<string, unknown>>;

  const totalTrades = allTrades.length;
  const successCount = allTrades.filter(t => t.status === 'confirmed' || t.status === 'broadcast').length;
  const successPct = totalTrades > 0 ? Math.round((successCount / totalTrades) * 100) : 0;
  const netProfit = allTrades.reduce((sum, t) => sum + (Number(t.profit_usd) || 0), 0);
  const avgCu = allTrades.filter(t => t.compute_units).reduce((sum, t, _, arr) => sum + Number(t.compute_units) / arr.length, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-[var(--font-display)] font-semibold">Execution History</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-[var(--font-display)] font-semibold">Execution History</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4"><div className="text-xs text-[var(--text-secondary)]">Total Trades</div><div className="mt-1 text-2xl font-mono font-bold">{totalTrades}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-xs text-[var(--text-secondary)]">Success Rate</div><div className="mt-1 text-2xl font-mono font-bold">{successPct}%</div></GlassCard>
        <GlassCard className="p-4"><div className="text-xs text-[var(--text-secondary)]">Net Profit</div><div className={`mt-1 text-2xl font-mono font-bold ${netProfit >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]'}`}>{formatPnl(netProfit)}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-xs text-[var(--text-secondary)]">Avg CU</div><div className="mt-1 text-2xl font-mono font-bold">{formatNumber(avgCu, 0)}</div></GlassCard>
      </div>

      {allTrades.length === 0 ? (
        <GlassCard className="p-4" hover={false}><EmptyState message="No arbitrage trades yet" /></GlassCard>
      ) : (
        <div className="space-y-3">
          {allTrades.map((t, i) => (
            <GlassCard key={i} className="p-4 flex items-start gap-4" hover={false}>
              <div className="flex flex-col items-center mt-1">
                <StatusDot status={String(t.status)} className="w-3 h-3" />
                {i < allTrades.length - 1 && <div className="w-px h-full bg-[var(--border-subtle)] mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-[var(--text-tertiary)]">{formatTime(String(t.created_at))}</span>
                  <Badge type={String(t.type)}>{String(t.type)}</Badge>
                  <Badge type={String(t.status)}>{String(t.status)}</Badge>
                </div>
                <div className="mt-1 text-sm">
                  {t.input_mint ? <span className="font-mono text-xs">{formatAddress(String(t.input_mint))}</span> : null}
                  {t.output_mint ? <span className="text-[var(--text-tertiary)]"> → </span> : null}
                  {t.output_mint ? <span className="font-mono text-xs">{formatAddress(String(t.output_mint))}</span> : null}
                </div>
                <div className="mt-1 flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                  {t.profit_usd != null ? <span className={Number(t.profit_usd) >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]'}>{formatPnl(Number(t.profit_usd))}</span> : null}
                  {t.compute_units ? <span>CU: {formatNumber(Number(t.compute_units), 0)}</span> : null}
                  {t.latency_ms ? <span>{Number(t.latency_ms)}ms</span> : null}
                  {t.tx_signature ? <span className="font-mono">{formatAddress(String(t.tx_signature))}</span> : null}
                </div>
                {t.error_message ? <div className="mt-1 text-xs text-[var(--accent-danger)]">{String(t.error_message)}</div> : null}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
