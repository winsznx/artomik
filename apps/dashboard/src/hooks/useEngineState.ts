'use client';

import { useQuery } from '@tanstack/react-query';

interface EngineStateData {
  id: number;
  status: string;
  cycle_count: number;
  last_cycle_at: string | null;
  total_pnl_usd: number;
  loss_today_usd: number;
  loss_reset_at: string;
  updated_at: string;
}

async function fetchState(): Promise<EngineStateData> {
  const res = await fetch('/api/state');
  return res.json() as Promise<EngineStateData>;
}

export function useEngineState() {
  return useQuery({
    queryKey: ['engineState'],
    queryFn: fetchState,
    refetchInterval: 3000,
  });
}
