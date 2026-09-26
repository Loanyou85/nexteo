import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/server/db';

/**
 * Liste de travail pour la saisie des MRR déclarés.
 *
 * Deux listes, pas une : ce qui est déjà renseigné (pour relire et corriger)
 * et ce qui reste à chercher. Sans la seconde, on ne saurait jamais où on en
 * est — et la seule chose qui compte dans un travail manuel, c'est de savoir
 * ce qui reste.
 *
 * L'ordre du reste-à-faire n'est pas alphabétique mais par signal décroissant :
 * chercher le MRR d'un annonceur qui diffuse depuis deux ans a de la valeur,
 * celui d'une entreprise qui a testé trois jours n'en a aucune.
 */

export type LigneSaisie = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  categorie: string | null;
  signalScore: number;
  declareCents: number | null;
  declareSource: string | null;
  declareLe: Date | null;
  estimeBasCents: number | null;
  estimeHautCents: number | null;
};

const CHAMPS = Prisma.validator<Prisma.AdvertiserSelect>()({
  id: true,
  slug: true,
  name: true,
  websiteUrl: true,
  signalScore: true,
  mrrDeclaredCents: true,
  mrrDeclaredSource: true,
  mrrDeclaredAt: true,
  mrrEstimatedLowCents: true,
  mrrEstimatedHighCents: true,
  category: { select: { label: true } },
});

type Brut = Prisma.AdvertiserGetPayload<{ select: typeof CHAMPS }>;

const ligne = (a: Brut): LigneSaisie => ({
  id: a.id,
  slug: a.slug,
  name: a.name,
  websiteUrl: a.websiteUrl,
  categorie: a.category?.label ?? null,
  signalScore: a.signalScore,
  declareCents: a.mrrDeclaredCents,
  declareSource: a.mrrDeclaredSource,
  declareLe: a.mrrDeclaredAt,
  estimeBasCents: a.mrrEstimatedLowCents,
  estimeHautCents: a.mrrEstimatedHighCents,
});

export async function listeSaisieMrr(recherche?: string) {
  const q = recherche?.trim();

  // Une recherche cherche partout : quand on a le nom en tête, on ne veut pas
  // avoir à deviner dans laquelle des deux listes il tombe.
  if (q) {
    const trouves = await db.advertiser.findMany({
      where: {
        excluded: false,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { websiteUrl: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: CHAMPS,
      orderBy: [{ signalScore: 'desc' }, { name: 'asc' }],
      take: 40,
    });
    return { renseignes: [] as LigneSaisie[], trouves: trouves.map(ligne), recherche: q };
  }

  const [renseignes, aFaire] = await Promise.all([
    db.advertiser.findMany({
      where: { excluded: false, mrrDeclaredCents: { not: null } },
      select: CHAMPS,
      orderBy: { mrrDeclaredAt: 'desc' },
      take: 60,
    }),
    db.advertiser.findMany({
      where: { excluded: false, mrrDeclaredCents: null },
      select: CHAMPS,
      orderBy: [{ signalScore: 'desc' }, { name: 'asc' }],
      take: 30,
    }),
  ]);

  return {
    renseignes: renseignes.map(ligne),
    trouves: aFaire.map(ligne),
    recherche: undefined,
  };
}

/** Combien reste-t-il à chercher, pour que l'écran ne mente pas sur l'ampleur. */
export async function resteASaisir() {
  const [avec, total] = await Promise.all([
    db.advertiser.count({ where: { excluded: false, mrrDeclaredCents: { not: null } } }),
    db.advertiser.count({ where: { excluded: false } }),
  ]);
  return { avec, total };
}
