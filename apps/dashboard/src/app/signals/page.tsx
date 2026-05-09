'use client';

import { useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSignals } from '@/hooks/useData';
import { formatUsd, formatAddress } from '@/lib/formatters';

function OrganicScoreBar({ score }: { score: number }) {
  const color = score < 40 ? 'bg-red-500' : score < 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = score < 40 ? 'text-red-500' : score < 70 ? 'text-amber-500' : 'text-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-[var(--bg-surface)] max-w-[100px]">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className={`text-xs font-mono font-semibold ${textColor}`}>{Math.round(score)}</span>
    </div>
  );
}

function TokenLogo({ iconUrl, symbol }: { iconUrl: string | null; symbol: string }) {
  const [failed, setFailed] = useState(false);
  const fallback = symbol.slice(0, 2).toUpperCase();

  if (iconUrl && !failed) {
    return (
      <img
        src={iconUrl}
        alt={symbol}
        width={32}
        height={32}
        className="w-8 h-8 rounded-full shrink-0 bg-[var(--bg-surface)]"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-secondary)] text-[10px] font-bold shrink-0">
      {fallback}
    </div>
  );
}

function PriceCategory({ price }: { price: number }) {
  if (price >= 0.99 && price <= 1.01) {
    return <span className="text-emerald-500 inline-flex items-center gap-1 text-xs"><Minus size={12} /> Stablecoin</span>;
  }
  if (price > 10) {
    return <span className="text-[var(--accent-info)] inline-flex items-center gap-1 text-xs"><TrendingUp size={12} /> Large cap</span>;
  }
  if (price > 0.1) {
    return <span className="text-[var(--accent-primary)] inline-flex items-center gap-1 text-xs"><TrendingUp size={12} /> Mid cap</span>;
  }
  return <span className="text-[var(--accent-warning)] inline-flex items-center gap-1 text-xs"><TrendingDown size={12} /> Micro cap</span>;
}

export default function SignalsPage() {
  const { data, isLoading } = useSignals();
  const tokens = (data?.tokens ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-[var(--font-display)] font-semibold">Token Watchlist</h1>
        <span className="text-xs text-[var(--text-tertiary)] font-mono">{tokens.length} tokens tracked</span>
      </div>

      <GlassCard className="p-0 overflow-hidden" hover={false}>
        {isLoading ? <div className="p-4"><SkeletonTable rows={8} /></div> :
         tokens.length === 0 ? <div className="p-8"><EmptyState message="No tokens in watchlist" /></div> :
         <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/50">
                <th className="px-4 py-3 font-semibold">Token</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Organic Score</th>
                <th className="px-4 py-3 font-semibold">Volatility</th>
                <th className="px-4 py-3 font-semibold">Mint</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t, i) => (
                <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-surface-hover)] transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <TokenLogo iconUrl={t.icon_url as string | null} symbol={String(t.symbol)} />
                      <div>
                        <div className="font-semibold text-[var(--text-primary)]">{String(t.symbol)}</div>
                        <div className="text-[11px] text-[var(--text-tertiary)] max-w-[120px] truncate">{String(t.name)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium text-[var(--text-primary)]">
                      {t.current_price_usd != null ? formatUsd(Number(t.current_price_usd)) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.current_price_usd != null ? <PriceCategory price={Number(t.current_price_usd)} /> : '—'}
                  </td>
                  <td className="px-4 py-3"><OrganicScoreBar score={Number(t.organic_score)} /></td>
                  <td className="px-4 py-3">
                    {Number(t.volatility_flag) === 1
                      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium status-pulse"><Zap size={12} /> Active</span>
                      : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] text-[var(--text-tertiary)] text-xs">Normal</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://solscan.io/token/${String(t.mint)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:underline transition-colors"
                    >
                      {formatAddress(String(t.mint))}
                    </a>
                  </td>
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
