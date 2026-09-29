import 'server-only';
import type { Plan, Subscription } from '@prisma/client';
import { db } from '@/server/db';

/**
 * L'offre en vigueur pour un utilisateur, lue en base.
 *
 * L'accès suit le paiement réel, jamais l'intention : un abonnement impayé ou
 * dont la période est échue ne donne plus que la Découverte.
 */

export type OffreEnVigueur = {
  plan: Plan & { budget: { maxAgentSteps: number; maxRetries: number; maxBuildMinutes: number; maxPlaytestMinutes: number; maxCreditsPerBuild: number } | null };
  abonnement: Subscription | null;
  actif: boolean;
};

export async function offreDe(userId: string): Promise<OffreEnVigueur> {
  const abonnement = await db.subscription.findUnique({ where: { userId } });
  const actif =
    !!abonnement &&
    (abonnement.status === 'active' || abonnement.status === 'trialing') &&
    (!abonnement.currentPeriodEnd || abonnement.currentPeriodEnd > new Date());

  const plan = actif
    ? await db.plan.findUnique({ where: { id: abonnement.planId }, include: { budget: true } })
    : await db.plan.findUnique({ where: { slug: 'decouverte' }, include: { budget: true } });

  if (!plan) throw new Error('Aucune offre en base : la base n’a pas été semée.');
  return { plan, abonnement, actif };
}

export function periodeCourante(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Plans de jeu déjà générés ce mois-ci. */
export async function plansDuMois(userId: string): Promise<number> {
  const c = await db.usageCounter.findUnique({
    where: { userId_period: { userId, period: periodeCourante() } },
  });
  return c?.plans ?? 0;
}
