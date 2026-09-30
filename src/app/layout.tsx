import type { Metadata, Viewport } from 'next';
// Polices auto-hébergées : aucune requête vers Google au chargement, donc
// aucune adresse IP de visiteur transmise à un tiers (hébergement UE, RGPD).
import '@fontsource/anton/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/jetbrains-mono/400.css';
import './globals.css';
import { MARQUE } from '@/config/brand';
import { urlPublique } from '@/config/url';

const DESCRIPTION =
  'Décris ta map. L’agent écrit le Verse, place les devices, compile, lance le playtest, lit les erreurs et les corrige — dans ton UEFN, sur ton PC.';

export const metadata: Metadata = {
  metadataBase: urlPublique(),
  title: { default: `${MARQUE.nom} — ${MARQUE.promesse}`, template: `%s — ${MARQUE.nom}` },
  description: DESCRIPTION,
  // Aperçu quand on partage le lien (messageries, réseaux). L'image est
  // générée par `opengraph-image.tsx`.
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: MARQUE.nom,
    title: `${MARQUE.nom} — ${MARQUE.promesse}`,
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#070B18',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
