'use client';

import { useQuery } from '@tanstack/react-query';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return res.json() as Promise<T>;
}

export function useSignals() {
  return useQuery({
    queryKey: ['signals'],
    queryFn: () => fetchJson<{ tokens: Array<Record<string, unknown>> }>('/api/signals'),
    refetchInterval: 5000,
  });
}

export function useTrades(limit = 20, offset = 0) {
  return useQuery({
    queryKey: ['trades', limit, offset],
    queryFn: () => fetchJson<{ trades: Array<Record<string, unknown>>; total: number }>(`/api/trades?limit=${limit}&offset=${offset}`),
    refetchInterval: 5000,
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: () => fetchJson<{ otocoOrders: Array<Record<string, unknown>>; predictions: Array<Record<string, unknown>> }>('/api/positions'),
    refetchInterval: 5000,
  });
}

export function useMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: () => fetchJson<{ totalCalls: number; rateLimitedCount: number; successRate: number; byEndpoint: Array<Record<string, unknown>> }>('/api/metrics'),
    refetchInterval: 10000,
  });
}
