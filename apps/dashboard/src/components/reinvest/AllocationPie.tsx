'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatUsd } from '@/lib/formatters';

interface AllocationEntry {
  symbol: string;
  amount: number;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#8b5cf6'];

interface AllocationPieProps {
  entries: AllocationEntry[];
  total: number;
}

export function AllocationPie({ entries, total }: AllocationPieProps) {
  if (entries.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-[var(--text-tertiary)] text-sm">
        No DCA allocations
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={entries} dataKey="amount" nameKey="symbol" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
            {entries.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}
            formatter={(value) => [formatUsd(Number(value)), '']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-lg font-mono font-bold">{formatUsd(total)}</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">Total</div>
        </div>
      </div>
    </div>
  );
}
