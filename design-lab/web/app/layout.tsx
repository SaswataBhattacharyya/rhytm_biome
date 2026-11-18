import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { PrefsProvider } from '../components/PrefsProvider';
import { THEME_BOOT_SCRIPT } from '../lib/themeBoot';
import './globals.css';

// Supplied brand fonts (assets/fonts), copied byte-for-byte. No substitution.
const hanken = localFont({
  src: [{ path: './fonts/HankenGrotesk-Variable.ttf', weight: '100 900', style: 'normal' }],
  variable: '--font-ui',
  display: 'swap',
});

const plexMono = localFont({
  src: [
    { path: './fonts/IBMPlexMono-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexMono-Medium.ttf', weight: '500', style: 'normal' },
  ],
  variable: '--font-data',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Rhythm Biome — D0 design specimen',
  description: 'Synthetic design specimen. Not a live service.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2E9E5' },
    { media: '(prefers-color-scheme: dark)', color: '#16282D' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved/system theme before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
