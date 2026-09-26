import type { Metadata, Viewport } from 'next';
import { Onest } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { siteUrl } from '@/lib/site';
import './globals.css';

// Titres (section 5.3). `swap` et préchargement : le premier écran ne doit
// jamais attendre une police pour s'afficher.
const onest = Onest({
  subsets: ['latin'],
  variable: '--font-onest',
  display: 'swap',
  weight: ['700', '800'],
  preload: true,
});

export const metadata: Metadata = {
  title: 'Nexteo — Arrête de chercher des idées. Regarde qui paie déjà pour vendre.',
  description:
    'Découvre les SaaS et applications qui dépensent en publicité depuis des mois, lis leurs ' +
    'annonces, leurs accroches et leurs pages de vente, et comprends ce qui fonctionne avant de construire.',
  metadataBase: new URL(siteUrl()),
};

export const viewport: Viewport = {
  // Le premier écran est l'accueil, en territoire sombre.
  themeColor: '#08080F',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${onest.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
