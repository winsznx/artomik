'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { AllocationPie } from '@/components/reinvest/AllocationPie';
import { useTrades } from '@/hooks/useData';
import { formatUsd } from '@/lib/formatters';

export default function ReinvestPage() {
  const { data, isLoading } = useTrades(50);
  const dcaTrades = ((data?.trades ?? []) as Array<Record<string, unknown>>).filter(t => t.type === 'dca');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-[var(--font-display)] font-semibold">DCA Manager</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard className="p-4" hover={false}>
          <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Token Allocation</h2>
          <AllocationPie entries={[]} total={0} />
        </GlassCard>

        <GlassCard className="p-4" hover={false}>
          <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Performance</h2>
          <div className="h-48 flex items-center justify-center text-[var(--text-tertiary)] text-sm">
            Performance chart renders with DCA history
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4" hover={false}>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">DCA Schedules</h2>
        {isLoading ? <SkeletonTable rows={3} /> :
         dcaTrades.length === 0 ? <EmptyState message="No DCA schedules active. Profits will be reinvested automatically." /> :
         <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-tertiary)] border-b border-[var(--border-subtle)]">
                <th className="pb-2 font-medium">Token</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {dcaTrades.map((t, i) => (
                <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="py-2 font-mono text-xs">{String(t.output_mint ?? '').slice(0, 8)}...</td>
                  <td className="py-2 font-mono text-xs">{t.input_amount ? formatUsd(Number(t.input_amount) / 1e6) : '—'}</td>
                  <td className="py-2"><Badge type={String(t.status)}>{String(t.status)}</Badge></td>
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
