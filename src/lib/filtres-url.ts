import type { Bande } from '@/lib/signal/score';
import type { Filtres, Tri } from '@/server/annonceurs';

/**
 * Lecture des filtres depuis l'URL.
 *
 * Partagé par la recherche et la liste : les deux écrans lisent les mêmes
 * paramètres, et on passe de l'un à l'autre en gardant ses filtres. Dupliquer
 * cette fonction ferait que « signal installé » veut dire deux choses
 * différentes selon la page où on est arrivé.
 *
 * Rien n'est cru sur parole : une valeur inconnue est ignorée plutôt que
 * transmise à SQL.
 */

export type ParamsUrl = Record<string, string | string[] | undefined>;

const BANDES_VALIDES = new Set<Bande>(['test', 'validation', 'installe', 'eprouve']);
const TRIS_VALIDES = new Set<Tri>(['signal', 'anciennete', 'volume', 'nouveaute']);

export function lireParam(params: ParamsUrl, cle: string): string | undefined {
  const v = params[cle];
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

export function filtresDepuisUrl(params: ParamsUrl): Filtres {
  const bande = lireParam(params, 'bande');
  const tri = lireParam(params, 'tri');
  const anciennete = Number(lireParam(params, 'anciennete'));
  const diffusion = lireParam(params, 'diffusion');

  return {
    q: lireParam(params, 'q'),
    bande: bande && BANDES_VALIDES.has(bande as Bande) ? (bande as Bande) : undefined,
    categorie: lireParam(params, 'categorie'),
    pays: lireParam(params, 'pays'),
    plateforme: lireParam(params, 'plateforme'),
    ancienneteMin: Number.isFinite(anciennete) && anciennete > 0 ? anciennete : undefined,
    enDiffusion: diffusion === '1' ? true : diffusion === '0' ? false : undefined,
    tri: tri && TRIS_VALIDES.has(tri as Tri) ? (tri as Tri) : 'signal',
  };
}

/** Un filtre est posé : l'écran doit annoncer un nombre de résultats, pas un total. */
export function filtreActif(f: Filtres): boolean {
  return Boolean(
    f.q || f.bande || f.categorie || f.pays || f.plateforme || f.ancienneteMin || f.enDiffusion !== undefined,
  );
}

/** Reconstruit la chaîne de requête en remplaçant le curseur. */
export function avecCurseur(params: ParamsUrl, curseur: string | null): string {
  const sortie = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === 'curseur') continue;
    const s = Array.isArray(v) ? v[0] : v;
    if (s) sortie.set(k, s);
  }
  if (curseur) sortie.set('curseur', curseur);
  return sortie.toString();
}
