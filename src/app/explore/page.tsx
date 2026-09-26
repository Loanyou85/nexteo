import Link from 'next/link';
import { Suspense } from 'react';
import { Coque, EnTetePage, EtatVide } from '@/components/shell/coque';
import { BaseAbsente } from '@/components/shell/base-absente';
import { Button } from '@/components/ui/button';
import { CarteAnnonceur } from '@/components/annonce/carte-annonceur';
import { BarreFiltres } from '@/components/explore/barre-filtres';
import { MENTION_SOURCE } from '@/lib/guardrails';
import type { Bande } from '@/lib/signal/score';
import {
  facettes,
  rechercherAnnonceurs,
  type Filtres as TFiltres,
  type Tri,
} from '@/server/annonceurs';
import { proprietesCoque } from '@/server/coque';
import { etatBase } from '@/server/etat';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Recherche — Nexteo',
  description: 'Filtre les annonceurs par signal, durée de diffusion, catégorie et pays.',
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
  const etat = await etatBase();

  if (!etat.pret) {
    return (
      <Coque>
        <BaseAbsente etat={etat} />
      </Coque>
    );
  }

  const filtres = filtresDepuisUrl(params);
  const curseur = lire(params, 'curseur');

  const [resultat, listes, coque] = await Promise.all([
    rechercherAnnonceurs(filtres, curseur),
    facettes(),
    proprietesCoque(),
  ]);
  const { annonceurs: totalAnnonceurs, annonces: totalAnnonces } = coque.compteurs;

  const suivante = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      typeof v === 'string' && k !== 'curseur' ? [[k, v] as [string, string]] : [],
    ),
  );
  if (resultat.curseurSuivant) suivante.set('curseur', resultat.curseurSuivant);

  const filtre = Boolean(
    filtres.q || filtres.bande || filtres.categorie || filtres.pays || filtres.ancienneteMin,
  );

  return (
    <Coque compteurs={coque.compteurs} admin={coque.admin} compte={coque.compte}>
      <EnTetePage
        titre="Recherche"
        compteur={
          filtre
            ? `${resultat.lignes.length} résultat${resultat.lignes.length > 1 ? 's' : ''} sur ${totalAnnonceurs.toLocaleString('fr-FR')} annonceurs archivés`
            : `${totalAnnonceurs.toLocaleString('fr-FR')} annonceurs, ${totalAnnonces.toLocaleString('fr-FR')} annonces archivées`
        }
      />

      <div className="px-5 py-5 lg:px-8">
        <Suspense fallback={<div className="squelette h-11 w-full" />}>
          <BarreFiltres facettes={listes} />
        </Suspense>

        <div className="mt-5">
          {resultat.lignes.length === 0 ? (
            <EtatVide
              titre="Aucun annonceur ne correspond"
              explication="Élargis les filtres, ou attends la prochaine exécution du pipeline : l’archive s’enrichit chaque jour et ne perd jamais ce qu’elle a vu."
              action={
                <Button asChild taille="sm" variant="secondaire">
                  <Link href="/explore">Réinitialiser les filtres</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
        </div>

        <p className="mt-10 border-t border-bordure pt-5 text-2xs text-encre-2">{MENTION_SOURCE}</p>
      </div>
    </Coque>
  );
}
