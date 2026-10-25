import type { Metadata } from 'next';
import { Instrument_Sans, Nunito } from 'next/font/google';
import { cookies } from 'next/headers';
import { themeChoices, type ThemeChoice } from '@/config/brand';
import { brandStyleSheet } from '@/config/generateCssVars';
import './globals.css';

// Font families must match config/brand.ts `fonts` (next/font needs static imports).
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' });
const instrumentSans = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument-sans' });

export const metadata: Metadata = {
  title: 'Perspectives',
  description: 'Track what people say about a business, brand, or handle.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const saved = (await cookies()).get('theme')?.value as ThemeChoice | undefined;
  const theme = saved && themeChoices.includes(saved) ? saved : 'system';

  return (
    <html lang="en" data-theme={theme} className={`${nunito.variable} ${instrumentSans.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandStyleSheet() }} />
      </head>
      <body className="min-h-screen bg-background font-body text-base text-text antialiased">
        {children}
      </body>
    </html>
  );
}
