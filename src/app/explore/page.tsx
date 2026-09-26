import Link from 'next/link';
import { Suspense } from 'react';
import { TopBar } from '@/components/shell/top-bar';
import { NavMobile } from '@/components/shell/nav-mobile';
import { Button } from '@/components/ui/button';
import { CarteAnnonceur } from '@/components/annonce/carte-annonceur';
import { Filtres } from '@/components/explore/filtres';
import { TableauAnnonceurs } from '@/components/explore/tableau';
import { MENTION_SOURCE } from '@/lib/guardrails';
import type { Bande } from '@/lib/signal/score';
import { facettes, rechercherAnnonceurs, type Filtres as TFiltres, type Tri } from '@/server/annonceurs';
import { sessionOuNull } from '@/server/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Explorer les annonceurs — Nexteo',
  description:
    'Filtre les annonceurs par signal, durée de diffusion, catégorie, pays et plateforme.',
};

type Params = Record<string, string | string[] | undefined>;

const BANDES_VALIDES = new Set<Bande>(['test', 'validation', 'installe', 'eprouve']);
const TRIS_VALIDES = new Set<Tri>(['signal', 'anciennete', 'volume', 'nouveaute']);

function lire(params: Params, cle: string): string | undefined {
  const v = params[cle];
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

/** Les paramètres d'URL sont saisis par l'utilisateur : rien n'est cru sur parole. */
function filtresDepuisUrl(params: Params): TFiltres {
  const bande = lire(params, 'bande');
  const tri = lire(params, 'tri');
  const anciennete = Number(lire(params, 'anciennete'));
  const diffusion = lire(params, 'diffusion');

  return {
    q: lire(params, 'q'),
    bande: bande && BANDES_VALIDES.has(bande as Bande) ? (bande as Bande) : undefined,
    categorie: lire(params, 'categorie'),
    pays: lire(params, 'pays'),
    plateforme: lire(params, 'plateforme'),
    ancienneteMin: Number.isFinite(anciennete) && anciennete > 0 ? anciennete : undefined,
    enDiffusion: diffusion === '1' ? true : diffusion === '0' ? false : undefined,
    tri: tri && TRIS_VALIDES.has(tri as Tri) ? (tri as Tri) : 'signal',
  };
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filtres = filtresDepuisUrl(params);
  const vue = lire(params, 'vue') === 'tableau' ? 'tableau' : 'cartes';
  const curseur = lire(params, 'curseur');

  const [resultat, listes, session] = await Promise.all([
    rechercherAnnonceurs(filtres, curseur),
    facettes(),
    sessionOuNull(),
  ]);

  const suivante = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      typeof v === 'string' && k !== 'curseur' ? [[k, v] as [string, string]] : [],
    ),
  );
  if (resultat.curseurSuivant) suivante.set('curseur', resultat.curseurSuivant);

  return (
    <>
      <TopBar connecte={Boolean(session)} />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pb-12">
        <h1 className="text-xl">Explorer les annonceurs</h1>
        <p className="mt-1.5 text-sm text-encre-2">{MENTION_SOURCE}</p>

        <div className="mt-8 grid gap-8 md:grid-cols-[260px_1fr]">
          <aside className="md:sticky md:top-20 md:self-start">
            <Suspense fallback={<div className="squelette h-96 w-full" />}>
              <Filtres facettes={listes} vue={vue} />
            </Suspense>
          </aside>

          <section>
            {resultat.lignes.length === 0 ? (
              <div className="rounded-card border border-bordure bg-surface p-8 text-center">
                <p className="text-base font-medium text-encre">Aucun annonceur ne correspond.</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-encre-2">
                  Élargis les filtres, ou attends la prochaine exécution du pipeline : l’archive
                  s’enrichit chaque jour et ne perd jamais ce qu’elle a vu.
                </p>
                <Button asChild taille="sm" variant="secondaire" className="mt-5">
                  <Link href="/explore">Réinitialiser les filtres</Link>
                </Button>
              </div>
            ) : vue === 'tableau' ? (
              <TableauAnnonceurs lignes={resultat.lignes} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {resultat.lignes.map((a) => (
                  <CarteAnnonceur key={a.id} a={a} />
                ))}
              </div>
            )}

            {resultat.curseurSuivant ? (
              <div className="mt-6 flex justify-center">
                <Button asChild variant="secondaire" taille="md">
                  <Link href={`/explore?${suivante.toString()}`}>Charger la suite</Link>
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <NavMobile />
    </>
  );
}
