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
 * Trois principes.
 *
 * Le mur n'apparaît qu'au moment où la valeur est évidente. On laisse voir
 * depuis combien de temps l'annonceur diffuse, combien d'annonces Nexteo a
 * archivées et combien Meta en a déjà effacées. Ce qui est masqué, c'est le
 * contenu — jamais la raison de payer.
 *
 * Revoir une fiche déjà ouverte ce mois-ci ne coûte rien. Recharger une page
 * ou revenir en arrière n'est pas une nouvelle consultation, et facturer un
 * aller-retour serait un piège, pas un quota.
 *
 * Si on ne sait pas compter — ni compte, ni cookie —, on laisse passer. Mieux
 * vaut offrir une fiche de trop que bloquer quelqu'un derrière un compteur
 * qu'on ne tient pas.
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
