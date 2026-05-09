'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePositions } from '@/hooks/useData';
import { formatUsd, formatAddress } from '@/lib/formatters';

function DeltaGauge({ value }: { value: number }) {
  const pct = ((value + 1) / 2) * 100;
  return (
    <GlassCard className="p-4" hover={false}>
      <div className="text-center text-xs text-[var(--text-secondary)] mb-2">Net Portfolio Delta: {value.toFixed(2)}</div>
      <div className="relative h-3 rounded-full bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-amber-500/20">
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[var(--accent-primary)] border-2 border-white shadow-md"
          style={{ left: `${Math.min(Math.max(pct, 2), 98)}%`, transform: 'translate(-50%, -50%)' }} />
      </div>
      <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-1">
        <span>-1.0 (hedged)</span>
        <span>0 (neutral)</span>
        <span>+1.0 (exposed)</span>
      </div>
    </GlassCard>
  );
}

export default function PositionsPage() {
  const { data, isLoading } = usePositions();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-[var(--font-display)] font-semibold">Active Positions</h1>
        <SkeletonCard />
        <div className="grid lg:grid-cols-2 gap-6">
          <SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  const orders = (data?.otocoOrders ?? []) as Array<Record<string, unknown>>;
  const predictions = (data?.predictions ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-[var(--font-display)] font-semibold">Active Positions</h1>

      <DeltaGauge value={-0.03} />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">OTOCO Orders</h2>
          {orders.length === 0 ? <GlassCard className="p-4" hover={false}><EmptyState message="No active orders" /></GlassCard> :
           orders.map((o, i) => (
            <GlassCard key={i} className="p-4" hover={false}>
              <div className="flex items-center justify-between mb-3">
                <Badge type="otoco">OTOCO</Badge>
                <div className="flex items-center gap-1.5"><StatusDot status={String(o.status)} /><span className="text-xs capitalize">{String(o.status)}</span></div>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between"><span className="text-[var(--accent-success)]">TP</span><span>{formatUsd(Number(o.tp_price_usd))}</span></div>
                <div className="h-px bg-[var(--border-subtle)]" />
                <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Entry</span><span>{formatUsd(Number(o.trigger_price_usd))}</span></div>
                <div className="h-px bg-[var(--border-subtle)]" />
                <div className="flex justify-between"><span className="text-[var(--accent-danger)]">SL</span><span>{formatUsd(Number(o.sl_price_usd))}</span></div>
              </div>
              <div className="mt-2 text-xs text-[var(--text-tertiary)]">Slippage: {Number(o.sl_slippage_bps)} bps</div>
              {Number(o.sl_slippage_bps) > 500 && <div className="mt-1 text-xs text-[var(--accent-warning)]">⚠ High slippage</div>}
            </GlassCard>
           ))
          }
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">Prediction Positions</h2>
          {predictions.length === 0 ? <GlassCard className="p-4" hover={false}><EmptyState message="No prediction positions" /></GlassCard> :
           predictions.map((p, i) => (
            <GlassCard key={i} className="p-4" hover={false}>
              <div className="font-medium text-sm mb-2">{String(p.event_title)}</div>
              <div className="flex items-center gap-2">
                <Badge variant={Number(p.is_yes) === 1 ? 'success' : 'danger'}>{Number(p.is_yes) === 1 ? 'YES' : 'NO'}</Badge>
                <StatusDot status={String(p.status)} />
                <span className="text-xs capitalize text-[var(--text-secondary)]">{String(p.status)}</span>
              </div>
              <div className="mt-2 text-xs text-[var(--text-secondary)]">
                Deposited: {formatUsd(Number(p.deposit_amount) / 1_000_000)}
                {p.current_odds ? ` · Odds: ${Number(p.current_odds).toFixed(2)}` : null}
              </div>
            </GlassCard>
           ))
          }
        </div>
      </div>
    </div>
  );
}
