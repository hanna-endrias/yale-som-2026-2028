import type { Metadata } from 'next';
import { Instrument_Sans, Nunito } from 'next/font/google';
import { brandStyleSheet } from '@/config/generateCssVars';
import './globals.css';

// Font families must match config/brand.ts `fonts` (next/font needs static imports).
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' });
const instrumentSans = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument-sans' });

export const metadata: Metadata = {
  title: 'Perspectives',
  description: 'Track what people say about a business, brand, or handle.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${instrumentSans.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandStyleSheet() }} />
      </head>
      <body className="min-h-screen bg-background font-body text-base text-text antialiased">
        {children}
      </body>
    </html>
  );
}
