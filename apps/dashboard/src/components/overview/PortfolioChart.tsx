'use client';

import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/cn';
import { formatUsd } from '@/lib/formatters';

interface TradePoint {
  created_at: string;
  profit_usd: number | null;
}

interface PortfolioChartProps {
  trades: TradePoint[];
}

const RANGES = ['1H', '6H', '24H', '7D', 'ALL'] as const;
const RANGE_MS: Record<string, number> = {
  '1H': 3600000,
  '6H': 21600000,
  '24H': 86400000,
  '7D': 604800000,
  'ALL': Infinity,
};

export function PortfolioChart({ trades }: PortfolioChartProps) {
  const [range, setRange] = useState<string>('24H');

  const data = useMemo(() => {
    const cutoff = range === 'ALL' ? 0 : Date.now() - RANGE_MS[range]!;
    let cumulative = 0;
    return trades
      .filter(t => new Date(t.created_at).getTime() > cutoff)
      .map(t => {
        cumulative += t.profit_usd ?? 0;
        return {
          time: new Date(t.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          value: cumulative,
        };
      });
  }, [trades, range]);

  const rangeButtons = (
    <div className="flex gap-1 mb-3">
      {RANGES.map(r => (
        <button
          key={r}
          onClick={() => setRange(r)}
          className={cn(
            'px-2 py-1 text-[10px] font-medium rounded-md transition-colors',
            range === r ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]',
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );

  if (data.length === 0) {
    return (
      <div>
        {trades.length > 0 && rangeButtons}
        <div className="h-40 flex items-center justify-center text-[var(--text-tertiary)] text-sm">
          {trades.length === 0 ? 'No trade data yet' : `No trades in ${range} range`}
        </div>
      </div>
    );
  }

  return (
    <div>
      {rangeButtons}
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-success)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent-success)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}
            labelStyle={{ color: 'var(--text-secondary)' }}
            formatter={(value) => [formatUsd(Number(value)), 'P&L']}
          />
          <Area type="monotone" dataKey="value" stroke="var(--accent-success)" fill="url(#pnlGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
