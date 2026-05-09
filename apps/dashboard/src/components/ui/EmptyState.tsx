'use client';

import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[var(--text-tertiary)]">
      <div className="mb-4 opacity-40">
        {icon ?? <Inbox size={48} />}
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
