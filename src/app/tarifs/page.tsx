import Link from 'next/link';
import { Coque, EnTetePage } from '@/components/shell/coque';
import { CartesTarifs } from '@/components/tarifs/cartes';
import { offresSansTarif } from '@/server/stripe';
import { proprietesCoque } from '@/server/coque';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Tarifs — Nexteo',
  description: 'Pro, Pro Plus et Agence. Mensuel ou annuel, résiliable en deux clics.',
};

export default async function TarifsPage() {
  const [coque, manquants] = await Promise.all([
    proprietesCoque(),
    Promise.resolve(offresSansTarif()),
  ]);
  const tarifsManquants = manquants.flatMap((m) => m.manquantes);

  return (
    <Coque compteurs={coque.compteurs} admin={coque.admin} compte={coque.compte}>
      <EnTetePage
        titre="Tarifs"
        sous="Pas d’offre gratuite. La recherche et la liste des annonceurs sont ouvertes pour que tu puisses juger, les fiches complètes demandent un abonnement."
      />

      <div className="px-5 pb-10 pt-6 lg:px-8">
        <CartesTarifs tarifsManquants={tarifsManquants} />

        {tarifsManquants.length > 0 ? (
          <p className="mt-6 rounded-card border border-alerte/30 bg-alerte/5 p-carte text-sm text-encre">
            Les tarifs Stripe ne sont pas encore configurés, donc aucun abonnement ne peut être
            souscrit. On préfère le dire que d’ouvrir un paiement qui échouerait.
            <span className="mt-1 block text-xs text-encre-2">
              Variables manquantes : {tarifsManquants.join(', ')}.
            </span>
          </p>
        ) : null}

        <section className="mt-12 border-t border-bordure pt-8">
          <h2 className="text-lg">Ce qui reste vrai quelle que soit l’offre</h2>
          <ul className="mt-4 space-y-2 text-sm text-encre-2">
            <li>
              Résiliation en deux clics depuis le portail Stripe. Aucun compte à rebours, aucune
              rareté artificielle.
            </li>
            <li>
              Un revenu mensuel déclaré est repris tel que l’entreprise l’a publié, avec le lien
              vers sa source et sa date. Une estimation reste une fourchette, et le chemin de
              calcul est affiché à côté. Aucune offre ne donne accès à des recettes vérifiées :
              cette donnée n’existe pas pour une entreprise privée.
            </li>
            <li>
              Les annonces conservées après leur retrait par Meta restent consultables tant que ton
              abonnement est actif.
            </li>
            <li>
              Export et suppression de compte disponibles à tout moment,{' '}
              <Link href="/legal/confidentialite" className="underline underline-offset-4">
                comme décrit ici
              </Link>
              .
            </li>
          </ul>
        </section>
      </div>
    </Coque>
  );
}
