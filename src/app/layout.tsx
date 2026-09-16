import type { Metadata, Viewport } from 'next';
import { Onest } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Analytics } from '@vercel/analytics/next';
import { siteUrl } from '@/lib/site';
import './globals.css';

// Display (section 4.2). `swap` + préchargement : le premier écran ne doit
// jamais attendre une police pour s'afficher.
const onest = Onest({
  subsets: ['latin'],
  variable: '--font-onest',
  display: 'swap',
  weight: ['700', '800'],
  preload: true,
});

export const metadata: Metadata = {
  title: 'Nexteo — Crée ton SaaS de A à Z, étape par étape.',
  description:
    'Trouve ton idée, mets ton site en ligne, encaisse tes premiers paiements. Sans coder.',
  metadataBase: new URL(siteUrl()),
};

export const viewport: Viewport = {
  themeColor: '#08080F',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${onest.variable} ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
