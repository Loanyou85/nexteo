import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TopBar } from '@/components/shell/top-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FREE_FEATURES, OFFERS, formatPrice } from '@/lib/offers';
import { GUARANTEE_DAYS, GUARANTEE_HEADLINE } from '@/lib/guarantee';
import { sessionOuNull } from '@/server/auth';
import { db } from '@/server/db';
import { choisirOffre } from '@/server/actions/plan';
import { stripeEnabled } from '@/server/stripe';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Les offres — Nexteo' };

export default async function OffresPage({
  searchParams,
}: {
  searchParams: Promise<{ paiement?: string; retour?: string }>;
}) {
  const { paiement, retour } = await searchParams;
  const session = await sessionOuNull();
  if (!session?.user?.id) redirect(`/connexion?suite=${encodeURIComponent('/offres')}`);

  const idee = await db.idea.findFirst({
    where: { userId: session.user.id, status: 'selected' },
    select: { title: true },
  });

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 pb-16 pt-6">
        <h1 className="text-xl font-extrabold text-white">
          {idee ? `Construis « ${idee.title} ».` : 'Choisis ce dont tu as besoin.'}
        </h1>
        <p className="mt-2 text-sm text-gris-300">
          Tu peux arrêter quand tu veux, depuis ton compte, en deux clics.
        </p>

        <Link
          href="/garantie"
          className="mt-5 flex items-center justify-between gap-3 rounded-card border border-gris-700 bg-nuit-800 px-4 py-3"
        >
          <span>
            <span className="block text-sm font-medium text-white">{GUARANTEE_HEADLINE}</span>
            <span className="mt-0.5 block text-xs text-gris-300">
              Lire les conditions des {GUARANTEE_DAYS} jours
            </span>
          </span>
          <span aria-hidden className="text-gris-300">
            →
          </span>
        </Link>

        {paiement === 'indisponible' ? (
          <p className="mt-5 rounded-card border border-gris-700 bg-nuit-800 p-4 text-sm text-gris-300">
            Le paiement n’est pas encore branché sur ce site. Ton choix est enregistré,{' '}
            <strong className="text-white">aucun montant ne t’a été débité</strong> et aucun accès
            payant n’a été ouvert.
          </p>
        ) : null}
        {retour ? (
          <p className="mt-5 rounded-card border border-gris-700 bg-nuit-800 p-4 text-sm text-gris-300">
            Tu as quitté le paiement. Rien n’a été débité.
          </p>
        ) : null}

        <div className="mt-6 space-y-4">
          {OFFERS.map((offre) => (
            <Card key={offre.plan} actif={offre.highlighted} className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-extrabold text-white">{offre.name}</h2>
                {offre.highlighted ? <Badge ton="neo">Le plus choisi</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-gris-300">{offre.tagline}</p>

              <p className="mt-4 font-display text-2xl font-extrabold tabular text-white">
                {formatPrice(offre.price)}
                <span className="ml-1 text-sm font-medium text-gris-300">par mois</span>
              </p>

              <ul className="mt-4 space-y-2">
                {offre.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm text-gris-300">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neo-500" />
                    {feature}
                  </li>
                ))}
              </ul>

              <form action={choisirOffre} className="mt-5">
                <input type="hidden" name="plan" value={offre.plan} />
                <Button
                  type="submit"
                  taille="bloc"
                  variant={offre.highlighted ? 'principal' : 'secondaire'}
                  className={cn(!offre.highlighted && 'font-medium')}
                >
                  Prendre {offre.name}
                </Button>
              </form>
            </Card>
          ))}
        </div>

        <section className="mt-8 rounded-card border border-dashed border-gris-700 p-5">
          <h2 className="text-sm font-bold text-white">Si tu ne prends rien, tu gardes</h2>
          <ul className="mt-3 space-y-1.5">
            {FREE_FEATURES.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-gris-300">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gris-700" />
                {item}
              </li>
            ))}
          </ul>
          <Button asChild variant="fantome" taille="sm" className="mt-4 w-full">
            <Link href="/app">Continuer sans payer</Link>
          </Button>
        </section>

        {!stripeEnabled() ? (
          <p className="mt-6 text-center text-xs text-gris-300">
            Le paiement n’est pas encore actif sur ce site.
          </p>
        ) : null}
      </main>
    </>
  );
}
