import 'server-only';
import { cookies } from 'next/headers';
import type { Plan } from '@prisma/client';
import { db } from '@/server/db';
import { DROITS, FICHES_GRATUITES_PAR_MOIS } from '@/lib/plans';
import { sessionOuNull } from '@/server/auth';
import { COOKIE_VISITEUR } from '@/middleware';

/**
 * Quotas et mur payant (section 9).
 *
 * Il n'y a pas d'offre gratuite : une fiche complète demande un abonnement.
 *
 * Le mur n'apparaît qu'au moment où la valeur est évidente, et il commence par
 * dire ce qu'il y a derrière — depuis combien de temps l'annonceur diffuse,
 * combien d'annonces sont archivées, combien Meta en a effacées. Ce qui est
 * réservé est annoncé, pas flouté : flouter laisse croire qu'on cache peu de
 * chose, et personne ne paie pour lever un flou.
 *
 * Le compteur reste en place pour les offres qui en auraient un un jour, et
 * parce qu'il sert au tableau de bord. Aujourd'hui, toutes les offres payantes
 * donnent les fiches sans limite.
 */

export type Acces = {
  plan: Plan;
  connecte: boolean;
  /** `false` : la fiche s'affiche floutée, ses compteurs restent en clair. */
  autorise: boolean;
  fichesVues: number;
  fichesIncluses: number;
  restantes: number;
};

function periodeCourante(maintenant = new Date()): string {
  return `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
}

type Identite = { userId: string } | { visitorId: string } | null;

async function identite(): Promise<Identite> {
  const session = await sessionOuNull();
  if (session?.user?.id) return { userId: session.user.id };

  const visiteur = (await cookies()).get(COOKIE_VISITEUR)?.value;
  return visiteur ? { visitorId: visiteur } : null;
}

async function planActif(userId: string | undefined): Promise<Plan> {
  if (!userId) return 'free';

  const abo = await db.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, currentPeriodEnd: true },
  });
  if (!abo || abo.status !== 'active') return 'free';
  // Une période échue ne donne plus rien, même si le statut est resté actif :
  // l'accès suit le paiement réel, jamais l'intention.
  if (abo.currentPeriodEnd && abo.currentPeriodEnd < new Date()) return 'free';
  return abo.plan;
}

/** Compteur du mois pour cette identité, créé au besoin. */
async function compteurDuMois(qui: NonNullable<Identite>, periode: string) {
  const champs = { id: true, viewedProfiles: true } as const;

  if ('userId' in qui) {
    return db.usageCounter.upsert({
      where: { userId_period: { userId: qui.userId, period: periode } },
      update: {},
      create: { userId: qui.userId, period: periode },
      select: champs,
    });
  }

  return db.usageCounter.upsert({
    where: { visitorId_period: { visitorId: qui.visitorId, period: periode } },
    update: {},
    create: { visitorId: qui.visitorId, period: periode },
    select: champs,
  });
}

/**
 * Consomme une consultation de fiche et rend les droits.
 *
 * `advertiserId` sert de clé : une même fiche revue dans le mois ne consomme
 * rien de plus.
 *
 * Deux requêtes simultanées peuvent laisser passer une fiche de trop. C'est
 * assumé : verrouiller la ligne à chaque affichage coûterait plus cher que la
 * fiche offerte, et l'erreur est toujours dans le sens du visiteur.
 */
export async function consulterFiche(advertiserId: string): Promise<Acces> {
  const qui = await identite();
  const userId = qui && 'userId' in qui ? qui.userId : undefined;
  const plan = await planActif(userId);
  const incluses = DROITS[plan].fichesParMois;

  const illimite: Acces = {
    plan,
    connecte: Boolean(userId),
    autorise: true,
    fichesVues: 0,
    fichesIncluses: incluses,
    restantes: incluses,
  };

  if (incluses === Infinity || !qui) return illimite;

  const compteur = await compteurDuMois(qui, periodeCourante());
  const dejaVue = compteur.viewedProfiles.includes(advertiserId);
  const vues = compteur.viewedProfiles.length;

  if (dejaVue) {
    return {
      plan,
      connecte: Boolean(userId),
      autorise: true,
      fichesVues: vues,
      fichesIncluses: incluses,
      restantes: Math.max(0, incluses - vues),
    };
  }

  if (vues >= incluses) {
    return {
      plan,
      connecte: Boolean(userId),
      autorise: false,
      fichesVues: vues,
      fichesIncluses: incluses,
      restantes: 0,
    };
  }

  await db.usageCounter.update({
    where: { id: compteur.id },
    data: {
      viewedProfiles: { push: advertiserId },
      profileViews: { increment: 1 },
    },
  });

  return {
    plan,
    connecte: Boolean(userId),
    autorise: true,
    fichesVues: vues + 1,
    fichesIncluses: incluses,
    restantes: Math.max(0, incluses - (vues + 1)),
  };
}

export { FICHES_GRATUITES_PAR_MOIS };
