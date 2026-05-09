'use client';

import { Menu } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { StatusDot } from '@/components/ui/StatusDot';
import { useEngineState } from '@/hooks/useEngineState';
import { useUiStore } from '@/stores/uiStore';

export function TopBar() {
  const { data: state } = useEngineState();
  const { setSidebarOpen } = useUiStore();

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-14 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] backdrop-blur-xl">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Artomik
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] text-xs">
            <StatusDot status={state?.status ?? 'stopped'} />
            <span className="capitalize text-[var(--text-secondary)]">{state?.status ?? 'stopped'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
