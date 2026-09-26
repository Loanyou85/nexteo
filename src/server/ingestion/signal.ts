import type { PrismaClient } from '@prisma/client';
import { calculerSignal, type Composante } from '@/lib/signal/score';
import { estimerMrr } from '@/lib/mrr/estimer';
import { couverturePour } from './couverture';

/**
 * Recalcule et enregistre le signal des annonceurs touchés par une exécution.
 *
 * Les poids sont relus à chaque lot plutôt qu'une fois pour toutes : ils sont
 * réglables depuis /admin, et un worker de longue durée continuerait sinon à
 * scorer avec des poids périmés.
 */
export async function recalculerSignal(
  db: PrismaClient,
  advertiserIds: string[],
  maintenant: Date = new Date(),
): Promise<number> {
  if (advertiserIds.length === 0) return 0;

  const poids = Object.fromEntries(
    (await db.signalWeight.findMany()).map((p) => [p.key as Composante, p.weight]),
  ) as Partial<Record<Composante, number>>;

  let traites = 0;

  for (const advertiserId of advertiserIds) {
    const annonces = await db.ad.findMany({
      where: { advertiserId },
      select: {
        deliveryStartTime: true,
        deliveryStopTime: true,
        isActive: true,
        reachedCountries: true,
        publisherPlatforms: true,
        creativeHash: true,
        firstSeenAt: true,
        euTotalReach: true,
      },
    });

    const signal = calculerSignal(
      {
        annonces: annonces.map((a) => ({
          deliveryStartTime: a.deliveryStartTime,
          deliveryStopTime: a.deliveryStopTime,
          isActive: a.isActive,
          reachedCountries: a.reachedCountries,
          publisherPlatforms: a.publisherPlatforms,
          checksums: [a.creativeHash],
          firstSeenAt: a.firstSeenAt,
        })),
        couverture: await couverturePour(db, advertiserId),
        maintenant,
      },
      poids,
    );

    // L'estimation de revenu se recalcule au même moment que le signal : elle
    // dépend des mêmes annonces, et deux chiffres calculés à des instants
    // différents finiraient par se contredire sur la même fiche.
    const actives = annonces.filter((a) => a.isActive);
    const portee = actives.reduce((s, a) => s + (a.euTotalReach ?? 0), 0);
    const persistance = signal.detail.find((d) => d.cle === 'persistance')?.valeur ?? 0;
    const estimation = estimerMrr({
      porteeTotale: portee > 0 ? portee : null,
      joursDiffusion: persistance,
    });

    await db.advertiser.update({
      where: { id: advertiserId },
      data: {
        mrrEstimatedLowCents: estimation?.basCents ?? null,
        mrrEstimatedHighCents: estimation?.hautCents ?? null,
        mrrEstimatedMethod: estimation?.methode ?? null,
        mrrEstimatedTrust: estimation?.fiabilite ?? null,
        mrrEstimatedAt: estimation ? maintenant : null,
        signalScore: signal.score,
        // Le détail est stocké tel qu'il sera affiché : la fiche ne recalcule
        // rien, donc ce qu'on montre est exactement ce qui a produit le score.
        signalBreakdown: {
          bande: signal.bande,
          libelleBande: signal.libelleBande,
          detail: signal.detail,
        },
        signalComputedAt: maintenant,
      },
    });
    traites += 1;
  }

  return traites;
}
