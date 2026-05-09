'use client';

import { Sun, Moon } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';

export function ThemeToggle() {
  const { theme, toggleTheme } = useUiStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
