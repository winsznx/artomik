'use client';

interface PriceSparklineProps {
  prices: number[];
  width?: number;
  height?: number;
}

export function PriceSparkline({ prices, width = 80, height = 24 }: PriceSparklineProps) {
  if (prices.length < 2) {
    return (
      <svg width={width} height={height} className="inline-block">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="var(--text-tertiary)" strokeWidth={1} strokeDasharray="2,2" />
      </svg>
    );
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const trending = prices[prices.length - 1]! >= prices[0]!;
  const color = trending ? 'var(--accent-success)' : 'var(--accent-danger)';

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
