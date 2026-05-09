import type { Metadata } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { TopBar } from '@/components/layout/TopBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700'],
});

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Artomik Dashboard',
  description: 'Jupiter DeFi autonomous yield & hedging engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-[var(--font-body)] antialiased`}>
        <Providers>
          <TopBar />
          <Sidebar />
          <main className="pt-14 lg:pl-64 pb-20 lg:pb-4">
            <div className="max-w-[1440px] mx-auto px-4 py-6">
              {children}
            </div>
          </main>
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
