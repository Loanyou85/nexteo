import type { Prisma, PrismaClient } from '@prisma/client';
import type { Couverture } from '@/lib/signal/score';

/**
 * Couverture de diffusion d'un annonceur, lue dans l'historique d'observations.
 *
 * `joursObserves` compte les jours où Nexteo a effectivement regardé, pas la
 * longueur de la fenêtre calendaire. Si le pipeline saute une journée, cette
 * journée n'est pas comptée — une panne de notre côté ne doit pas se traduire
 * par une interruption attribuée à l'annonceur.
 */
export async function couverturePour(
  db: PrismaClient | Prisma.TransactionClient,
  advertiserId: string,
): Promise<Couverture> {
  const [ligne] = await db.$queryRaw<{ observes: number; couverts: number }[]>`
    SELECT
      count(DISTINCT date_trunc('day', o."observedAt"))::int AS observes,
      count(DISTINCT date_trunc('day', o."observedAt")) FILTER (WHERE o."isActive")::int AS couverts
    FROM "AdObservation" o
    JOIN "Ad" a ON a."id" = o."adId"
    WHERE a."advertiserId" = ${advertiserId}
  `;
  return {
    joursObserves: ligne?.observes ?? 0,
    joursCouverts: ligne?.couverts ?? 0,
  };
}
