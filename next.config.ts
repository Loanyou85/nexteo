import type { NextConfig } from 'next';

/**
 * Origines autorisées pour les Server Actions. Derrière un domaine
 * personnalisé, l'origine et l'hôte diffèrent et Next rejette l'action en
 * silence : le formulaire part, rien ne revient. Panne qui n'apparaît qu'en
 * production, d'où cette liste explicite. L'hôte de AUTH_URL y est ajouté :
 * c'est l'adresse publique que le propriétaire a déclarée.
 */
function hoteDe(url: string | undefined): string[] {
  try {
    return url ? [new URL(url).host] : [];
  } catch {
    return [];
  }
}
const origines = ['nexteo.app', 'www.nexteo.app', '*.vercel.app', 'localhost:3000', ...hoteDe(process.env.AUTH_URL)];

/**
 * En-têtes de sécurité. Pas de Content-Security-Policy stricte : Next injecte
 * des scripts en ligne, et une politique trop serrée casserait le site sans
 * rien protéger de plus. À ajouter avec des nonces si le besoin se présente.
 */
const enTetes = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: enTetes }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
      allowedOrigins: origines,
    },
  },
};

export default nextConfig;
