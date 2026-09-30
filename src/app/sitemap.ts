import type { MetadataRoute } from 'next';
import { urlPublique } from '@/config/url';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = urlPublique().origin;
  const maintenant = new Date();
  const pages: [string, number][] = [
    ['/', 1],
    ['/tarifs', 0.9],
    ['/inscription', 0.6],
    ['/connexion', 0.4],
    ['/legal/confidentialite', 0.3],
    ['/legal/mentions', 0.3],
  ];
  return pages.map(([chemin, priority]) => ({ url: `${base}${chemin}`, lastModified: maintenant, priority }));
}
