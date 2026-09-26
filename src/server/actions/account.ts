'use server';

import { db } from '@/server/db';
import { requireUser } from '@/server/auth';

/**
 * Export et suppression du compte (garde-fou n° 5, RGPD).
 *
 * L'export rend tout ce que Nexteo détient sur la personne. Il ne contient
 * aucune annonce ni aucun annonceur : ce sont des données publiques d'entreprises,
 * pas des données personnelles, et les inclure noierait l'utile.
 */
export async function exporterMonCompte() {
  const user = await requireUser();

  const donnees = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      email: true,
      name: true,
      createdAt: true,
      consentAcceptedAt: true,
      consentVersion: true,
      dataRetentionMonths: true,
      subscription: {
        select: { plan: true, interval: true, status: true, currentPeriodEnd: true },
      },
      usage: { select: { period: true, searches: true, profileViews: true, exports: true } },
      collections: { select: { name: true, createdAt: true } },
      savedItems: { select: { itemType: true, itemId: true, note: true, createdAt: true } },
      savedSearch: { select: { name: true, filters: true, createdAt: true } },
      watches: { select: { advertiserId: true, createdAt: true } },
    },
  });

  return { exporteLe: new Date().toISOString(), compte: donnees };
}

/**
 * Suppression définitive.
 *
 * Les suppressions en cascade du schéma emportent sessions, abonnement,
 * collections, suivis et compteurs. Rien n'est conservé « au cas où ».
 */
export async function supprimerMonCompte(): Promise<void> {
  const user = await requireUser();
  await db.user.delete({ where: { id: user.id } });
}
