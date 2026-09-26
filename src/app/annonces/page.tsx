import Link from 'next/link';
import { Suspense } from 'react';
import { Coque, EnTetePage, EtatVide } from '@/components/shell/coque';
import { BaseAbsente } from '@/components/shell/base-absente';
import { BarreFiltresAnnonces } from '@/components/annonce/barre-filtres-annonces';
import { CarteAnnonceListe } from '@/components/annonce/carte-annonce-liste';
import { Button } from '@/components/ui/button';
import { avecCurseur, lireParam, type ParamsUrl } from '@/lib/filtres-url';
import { MENTION_SOURCE } from '@/lib/guardrails';
import { facettes } from '@/server/annonceurs';
import {
  chiffresAnnonces,
  rechercherAnnonces,
  type FiltresAnnonces,
  type TriAnnonces,
} from '@/server/annonces';
import { proprietesCoque } from '@/server/coque';
import { etatBase } from '@/server/etat';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Annonces — Nexteo',
  description:
    'Toutes les annonces archivées, texte compris, y compris celles que Meta a effacées de sa bibliothèque.',
};

const TRIS = new Set<TriAnnonces>(['duree', 'recentes', 'anciennes']);

function filtresDepuisUrl(params: ParamsUrl): FiltresAnnonces {
  const tri = lireParam(params, 'tri');
  const jours = Number(lireParam(params, 'jours'));
  const diffusion = lireParam(params, 'diffusion');

  return {
    q: lireParam(params, 'q'),
    enDiffusion: diffusion === '1' ? true : diffusion === '0' ? false : undefined,
    retirees: lireParam(params, 'retirees') === '1' || undefined,
    pays: lireParam(params, 'pays'),
    plateforme: lireParam(params, 'plateforme'),
    categorie: lireParam(params, 'categorie'),
    joursMin: Number.isFinite(jours) && jours > 0 ? jours : undefined,
    tri: tri && TRIS.has(tri as TriAnnonces) ? (tri as TriAnnonces) : 'duree',
  };
}

export default async function AnnoncesPage({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
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
  const curseur = lireParam(params, 'curseur');

  const [resultat, listes, chiffres, coque] = await Promise.all([
    rechercherAnnonces(filtres, curseur),
    facettes(),
    chiffresAnnonces(),
    proprietesCoque(),
  ]);

  const nb = (n: number) => n.toLocaleString('fr-FR');

  return (
    <Coque compteurs={coque.compteurs} admin={coque.admin} compte={coque.compte}>
      <EnTetePage
        titre="Annonces"
        compteur={`${nb(chiffres.total)} archivées · ${nb(chiffres.actives)} encore en diffusion · ${nb(chiffres.retirees)} effacées par Meta et conservées ici`}
        sous="Triées par durée de diffusion par défaut. Une annonce qu’une entreprise laisse tourner un an a fait ses preuves ; une qui a duré trois jours a été coupée, et c’est une information aussi."
      />

      <div className="px-5 py-5 lg:px-8">
        <Suspense fallback={<div className="squelette h-11 w-full" />}>
          <BarreFiltresAnnonces facettes={listes} />
        </Suspense>

        <div className="mt-5">
          {resultat.lignes.length === 0 ? (
            <EtatVide
              titre="Aucune annonce ne correspond"
              explication="Les mots de moins de trois lettres sont ignorés par l’index plein texte. Essaie un terme plus long, ou retire un filtre."
              action={
                <Button asChild taille="sm" variant="secondaire">
                  <Link href="/annonces">Réinitialiser les filtres</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {resultat.lignes.map((a) => (
                <CarteAnnonceListe key={a.id} a={a} />
              ))}
            </div>
          )}

          {resultat.curseurSuivant ? (
            <div className="mt-6 flex justify-center">
              <Button asChild variant="secondaire" taille="md">
                <Link href={`/annonces?${avecCurseur(params, resultat.curseurSuivant)}`}>
                  Charger la suite
                </Link>
              </Button>
            </div>
          ) : null}
        </div>

        <p className="mt-10 border-t border-bordure pt-5 text-2xs text-encre-2">{MENTION_SOURCE}</p>
      </div>
    </Coque>
  );
}
