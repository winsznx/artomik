import type { Metadata, Viewport } from 'next';
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

const SITE_URL = 'https://artomik.xyz';
const SITE_NAME = 'Artomik';
const SITE_DESCRIPTION = 'Autonomous Jupiter DeFi engine — chains 7 Jupiter APIs into a single execution loop: token filtering, volatility detection, flashloan arbitrage, OTOCO hedging, prediction markets, and DCA reinvestment.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Autonomous Jupiter DeFi Engine`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'winsznx', url: 'https://github.com/winsznx' }],
  generator: 'Next.js',
  keywords: [
    'Jupiter',
    'Solana',
    'DeFi',
    'flashloan',
    'arbitrage',
    'autonomous trading',
    'OTOCO',
    'prediction markets',
    'DCA',
  ],
  creator: 'winsznx',
  publisher: 'Artomik',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Autonomous Jupiter DeFi Engine`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Artomik — Autonomous Jupiter DeFi Engine',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Autonomous Jupiter DeFi Engine`,
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
    creator: '@winsznx',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9fc' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0d12' },
  ],
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
