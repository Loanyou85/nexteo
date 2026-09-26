/**
 * Pastille de repli, dessinée quand aucun logo n'a pu être récupéré.
 *
 * Une carte sans image fait maquette. Plutôt que d'afficher un carré gris,
 * on dessine une pastille colorée portant l'initiale : la teinte dérive du
 * nom, donc elle est stable — le même annonceur garde la même couleur d'une
 * visite à l'autre, et la grille reste lisible.
 */

/** Empreinte stable et courte d'une chaîne. */
function empreinte(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Teinte dérivée du nom, en évitant la plage 100-160.
 *
 * C'est la plage des verts, et dans ce secteur le vert signifie l'argent. Une
 * pastille verte à côté d'un montant laisserait entendre exactement ce que le
 * produit se refuse à affirmer.
 */
export function teintePour(nom: string): number {
  const brute = empreinte(nom) % 300;
  return brute < 100 ? brute : brute + 60;
}

export function initialesPour(nom: string): string {
  const mots = nom
    .split(/[\s·—-]+/)
    .map((m) => m.trim())
    .filter(Boolean);
  if (mots.length === 0) return '?';
  if (mots.length === 1) return (mots[0] ?? '').slice(0, 2).toUpperCase();
  return `${mots[0]?.[0] ?? ''}${mots[1]?.[0] ?? ''}`.toUpperCase();
}

/** SVG de repli, servi tel quel : aucune dépendance, aucun appel réseau. */
export function pastilleSvg(nom: string, taille = 96): string {
  const h = teintePour(nom);
  const initiales = initialesPour(nom);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 96 96" role="img" aria-label="${nom.replace(/[<>&"]/g, '')}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${h} 62% 58%)"/>
      <stop offset="1" stop-color="hsl(${(h + 26) % 360} 58% 44%)"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="22" fill="url(#g)"/>
  <text x="48" y="49" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
        font-size="${initiales.length > 1 ? 36 : 44}" font-weight="700" fill="#fff" letter-spacing="-1">${initiales}</text>
</svg>`;
}

/** Domaine acceptable : on ne relaie pas n'importe quelle URL. */
export function domaineValide(domaine: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+$/i.test(domaine) && domaine.length <= 253;
}
