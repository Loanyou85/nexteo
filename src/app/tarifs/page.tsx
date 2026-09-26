import Link from 'next/link';
import { TopBar } from '@/components/shell/top-bar';
import { NavMobile } from '@/components/shell/nav-mobile';
import { CartesTarifs } from '@/components/tarifs/cartes';
import { offresSansTarif } from '@/server/stripe';
import { sessionOuNull } from '@/server/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Tarifs — Nexteo',
  description: 'Pro, Pro Plus et Agence. Mensuel ou annuel, résiliable en deux clics.',
};

export default async function TarifsPage() {
  const [session, manquants] = await Promise.all([sessionOuNull(), Promise.resolve(offresSansTarif())]);
  const tarifsManquants = manquants.flatMap((m) => m.manquantes);

  return (
    <>
      <TopBar connecte={Boolean(session)} />

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 md:pb-16">
        <div className="text-center">
          <h1 className="text-xl">Tarifs</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-encre-2">
            Pas d’offre gratuite. La recherche et la liste des annonceurs sont ouvertes pour que tu
            puisses juger, les fiches complètes demandent un abonnement.
          </p>
        </div>

        <div className="mt-10">
          <CartesTarifs tarifsManquants={tarifsManquants} />
        </div>

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
              Aucune donnée de recettes n’est publiée, sur aucune offre. Ce n’est pas une
              fonctionnalité réservée : cette donnée n’existe pas publiquement.
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
      </main>

      <NavMobile />
    </>
  );
}
