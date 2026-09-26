import { offrePour } from '@/lib/plans';
import { sessionOuNull } from '@/server/auth';
import { db } from '@/server/db';

/**
 * Ce que la barre latérale a besoin de savoir, sur toutes les pages.
 *
 * Les compteurs et le bloc de compte apparaissent sur chaque écran : sans ce
 * point unique, chaque page recopierait les quatre mêmes requêtes et finirait
 * par en oublier une — c'est exactement comme ça qu'un compteur se met à
 * mentir sur un écran et pas sur l'autre.
 *
 * Les quatre requêtes partent ensemble : elles ne dépendent pas les unes des
 * autres, les enchaîner ajouterait trois allers-retours à chaque affichage.
 */
export async function proprietesCoque() {
  const [session, annonceurs, annonces] = await Promise.all([
    sessionOuNull(),
    db.advertiser.count({ where: { excluded: false } }),
    db.ad.count(),
  ]);

  const abonnement = session?.user?.id
    ? await db.subscription.findUnique({
        where: { userId: session.user.id },
        select: { plan: true },
      })
    : null;

  return {
    session,
    compteurs: { annonceurs, annonces },
    admin: session?.user?.role === 'admin',
    compte: session?.user?.email
      ? {
          email: session.user.email,
          plan: abonnement ? (offrePour(abonnement.plan)?.nom ?? 'Sans abonnement') : 'Sans abonnement',
        }
      : null,
  };
}

export type ProprietesCoque = Awaited<ReturnType<typeof proprietesCoque>>;
