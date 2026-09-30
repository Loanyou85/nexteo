import type { MetadataRoute } from 'next';
import { urlPublique } from '@/config/url';

/** Les pages publiques sont indexables ; tout ce qui demande un compte, jamais. */
export default function robots(): MetadataRoute.Robots {
  const base = urlPublique().origin;
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/compte', '/dashboard', '/projet/', '/creer', '/connexion-uefn', '/tarifs/paiement', '/reparation'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
