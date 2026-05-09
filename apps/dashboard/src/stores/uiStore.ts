'use client';

import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  activeLogFilter: 'all' | 'info' | 'warn' | 'error';
  theme: 'light' | 'dark';
  setSidebarOpen: (open: boolean) => void;
  setActiveLogFilter: (filter: 'all' | 'info' | 'warn' | 'error') => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  activeLogFilter: 'all',
  theme: 'dark',
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveLogFilter: (filter) => set({ activeLogFilter: filter }),
  toggleTheme: () => set((s) => {
    const next = s.theme === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('artomik-theme', next);
    }
    return { theme: next };
  }),
  setTheme: (theme) => set(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('artomik-theme', theme);
    }
    return { theme };
  }),
}));
