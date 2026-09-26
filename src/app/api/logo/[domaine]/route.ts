import { NextResponse } from 'next/server';
import { domaineValide, pastilleSvg } from '@/lib/logo';

/**
 * Logo d'un annonceur, servi par Nexteo.
 *
 * Le navigateur du visiteur n'appelle jamais que ce domaine. C'est délibéré :
 * pointer les balises `img` directement sur le site de l'annonceur ou sur un
 * service de favicons tiers ferait fuiter l'adresse IP de chaque visiteur vers
 * autant de tiers, ce que la politique de confidentialité promet de ne pas
 * faire.
 *
 * Trois sources essayées dans l'ordre, puis un repli dessiné. La route rend
 * TOUJOURS une image : une carte avec un logo cassé est pire qu'une carte avec
 * une pastille.
 */

export const runtime = 'nodejs';
/** Un logo bouge rarement. Un jour côté navigateur, une semaine côté CDN. */
const CACHE = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000';

const DELAI_MS = 4000;
const TAILLE_MAX = 512 * 1024;

function sources(domaine: string): string[] {
  return [
    `https://${domaine}/apple-touch-icon.png`,
    `https://${domaine}/favicon.ico`,
    // Dernier recours : un service de favicons. Appelé depuis le serveur, il
    // ne voit que Nexteo, jamais les visiteurs.
    `https://icons.duckduckgo.com/ip3/${domaine}.ico`,
  ];
}

function repli(nom: string): NextResponse {
  return new NextResponse(pastilleSvg(nom), {
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': CACHE },
  });
}

export async function GET(
  requete: Request,
  { params }: { params: Promise<{ domaine: string }> },
) {
  const { domaine } = await params;
  const nom = new URL(requete.url).searchParams.get('nom')?.slice(0, 60) || domaine;

  if (!domaineValide(domaine)) return repli(nom);

  for (const url of sources(domaine)) {
    try {
      const abandon = AbortSignal.timeout(DELAI_MS);
      const r = await fetch(url, { signal: abandon, redirect: 'follow' });
      if (!r.ok) continue;

      const type = r.headers.get('content-type') ?? '';
      if (!type.startsWith('image/')) continue;

      const octets = new Uint8Array(await r.arrayBuffer());
      // Un fichier vide ou minuscule est un favicon de remplissage, pas un
      // logo ; un fichier énorme n'a rien à faire dans une carte.
      if (octets.byteLength < 200 || octets.byteLength > TAILLE_MAX) continue;

      return new NextResponse(octets, {
        headers: { 'content-type': type, 'cache-control': CACHE },
      });
    } catch {
      // Domaine injoignable, délai dépassé, certificat refusé : on essaie la
      // source suivante. Un logo manquant ne doit jamais casser une page.
    }
  }

  return repli(nom);
}
