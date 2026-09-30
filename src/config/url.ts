import { MARQUE } from '@/config/brand';

/**
 * Adresse publique du site.
 *
 * `AUTH_URL` est l'adresse que le propriétaire a déclarée ; à défaut, celles
 * que Vercel fournit ; à défaut, le domaine de la marque. Une valeur mal
 * saisie (guillemets, faute de frappe) ne doit pas faire tomber le site :
 * `new URL()` lève une exception, et elle se produirait au chargement du
 * layout, donc sur TOUTES les pages. On essaie donc chaque candidat.
 */
export function urlPublique(env: Record<string, string | undefined> = process.env): URL {
  const candidats = [
    env.AUTH_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined,
  ];
  for (const brut of candidats) {
    if (!brut) continue;
    try {
      const u = new URL(brut.trim().replace(/^["']|["']$/g, ''));
      if (u.protocol === 'http:' || u.protocol === 'https:') return new URL(u.origin);
    } catch {
      /* candidat illisible : on passe au suivant */
    }
  }
  return new URL(`https://${MARQUE.domaine}`);
}
