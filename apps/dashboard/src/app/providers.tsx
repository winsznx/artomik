'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 2000, retry: 1 } },
  }));
  const { setTheme } = useUiStore();

  useEffect(() => {
    const saved = localStorage.getItem('artomik-theme') as 'light' | 'dark' | null;
    const theme = saved ?? 'dark';
    setTheme(theme);
  }, [setTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
