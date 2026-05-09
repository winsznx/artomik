'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Radio, Zap, Target, Terminal } from 'lucide-react';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/signals', label: 'Signals', icon: Radio },
  { href: '/arbitrage', label: 'Arb', icon: Zap },
  { href: '/positions', label: 'Positions', icon: Target },
  { href: '/logs', label: 'Logs', icon: Terminal },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] backdrop-blur-xl">
      <div className="flex items-center justify-around h-full">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href === '/overview' && pathname === '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors',
                active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]',
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
