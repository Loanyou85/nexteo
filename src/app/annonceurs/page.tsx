import Link from 'next/link';
import { Suspense } from 'react';
import { Coque, EnTetePage, EtatVide } from '@/components/shell/coque';
import { BaseAbsente } from '@/components/shell/base-absente';
import { BarreFiltres } from '@/components/explore/barre-filtres';
import { TableauAnnonceurs } from '@/components/explore/tableau';
import { Button } from '@/components/ui/button';
import { avecCurseur, filtreActif, filtresDepuisUrl, lireParam, type ParamsUrl } from '@/lib/filtres-url';
import { MENTION_SOURCE } from '@/lib/guardrails';
import { facettes, rechercherAnnonceurs } from '@/server/annonceurs';
import { proprietesCoque } from '@/server/coque';
import { etatBase } from '@/server/etat';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Annonceurs — Nexteo',
  description:
    'Toutes les entreprises que Nexteo a vues payer pour de la publicité, en tableau comparable.',
};

/**
 * La même donnée que la recherche, en tableau.
 *
 * Les filtres et l'URL sont partagés avec /explore : on bascule d'une vue à
 * l'autre sans reposer ses filtres. Cinquante lignes par page ici contre
 * vingt-quatre cartes là-bas — un tableau dense supporte le défilement, une
 * grille de cartes non.
 */
const PAR_PAGE = 50;

export default async function AnnonceursPage({
  searchParams,
}: {
  searchParams: Promise<ParamsUrl>;
}) {
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

  const [resultat, listes, coque] = await Promise.all([
    rechercherAnnonceurs(filtres, curseur, PAR_PAGE),
    facettes(),
    proprietesCoque(),
  ]);

  const { annonceurs: total, annonces } = coque.compteurs;
  const filtre = filtreActif(filtres);

  return (
    <Coque compteurs={coque.compteurs} admin={coque.admin} compte={coque.compte}>
      <EnTetePage
        titre="Annonceurs"
        compteur={
          filtre
            ? `${resultat.lignes.length} ligne${resultat.lignes.length > 1 ? 's' : ''} sur ${total.toLocaleString('fr-FR')} annonceurs archivés`
            : `${total.toLocaleString('fr-FR')} annonceurs, ${annonces.toLocaleString('fr-FR')} annonces archivées`
        }
        sous="Chaque ligne est une entreprise qui a payé pour être vue. La colonne Diffusion est la seule mesure vérifiable ici : combien de temps elle paie sans s’arrêter."
        actions={
          <Button asChild taille="sm" variant="secondaire">
            <Link href={`/explore?${avecCurseur(params, null)}`}>Vue cartes</Link>
          </Button>
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
                  <Link href="/annonceurs">Réinitialiser les filtres</Link>
                </Button>
              }
            />
          ) : (
            <TableauAnnonceurs lignes={resultat.lignes} />
          )}

          {resultat.curseurSuivant ? (
            <div className="mt-6 flex justify-center">
              <Button asChild variant="secondaire" taille="md">
                <Link href={`/annonceurs?${avecCurseur(params, resultat.curseurSuivant)}`}>
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
