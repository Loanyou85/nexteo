import type { NextConfig } from 'next';

/**
 * Origines autorisées pour les Server Actions. Derrière un domaine
 * personnalisé, l'origine et l'hôte diffèrent et Next rejette l'action en
 * silence : le formulaire part, rien ne revient. Panne qui n'apparaît qu'en
 * production, d'où cette liste explicite.
 */
const origines = ['nexteo.app', 'www.nexteo.app', '*.vercel.app', 'localhost:3000'];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
      allowedOrigins: origines,
    },
  },
};

export default nextConfig;
