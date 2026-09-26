import 'server-only';
import { db } from '@/server/db';
import { lotsEnSouffrance } from '@/server/ingestion/pipeline';
import { sourceAnnonces } from '@/server/source';
import { stockageObjet } from '@/server/stockage';
import { offresSansTarif } from '@/server/stripe';

/**
 * État du pipeline et de la configuration (section 6.8).
 *
 * Cet écran existe pour qu'on n'ait jamais à lire les journaux de
 * l'hébergeur pour savoir si le produit va bien. La seule panne qui coûte
 * quelque chose d'irrécupérable — l'ingestion qui s'arrête — doit se voir
 * d'un coup d'œil.
 */

export type Supervision = {
  base: { annonceurs: number; annonces: number; observations: number; retirees: number };
  ingestion: {
    derniereReussite: Date | null;
    heuresDepuis: number | null;
    enRetard: boolean;
    lots: {
      id: string;
      pays: string;
      terme: string | null;
      statut: string;
      demarre: Date | null;
      fini: Date | null;
      vues: number;
      nouvelles: number;
      erreur: string | null;
    }[];
    souffrance: { pays: string; terme: string | null; echecs: number }[];
  };
  partitions: { total: number; defautNonVide: number };
  configuration: {
    source: string;
    sourceEstDemo: boolean;
    stockageConfigure: boolean;
    tarifsManquants: string[];
  };
  revue: { annonceurs: number };
};

/** Au-delà, deux jours d'ingestion sont perdus et personne ne les rattrapera. */
const SEUIL_RETARD_H = 48;

export async function supervision(): Promise<Supervision> {
  const source = sourceAnnonces();
  const stockage = stockageObjet();

  const [annonceurs, annonces, observations, retirees, derniere, lots, souffrance, revue] =
    await Promise.all([
      db.advertiser.count({ where: { excluded: false } }),
      db.ad.count(),
      db.adObservation.count(),
      db.ad.count({ where: { goneFromMeta: true } }),
      db.ingestJob.findFirst({
        where: { status: 'succeeded' },
        orderBy: { finishedAt: 'desc' },
        select: { finishedAt: true },
      }),
      db.ingestJob.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
      lotsEnSouffrance(db),
      db.advertiser.count({ where: { needsReview: true, excluded: false } }),
    ]);

  const heuresDepuis = derniere?.finishedAt
    ? Math.round((Date.now() - derniere.finishedAt.getTime()) / 3_600_000)
    : null;

  // La partition par défaut doit rester vide : on ne peut pas rattacher une
  // partition dont la plage recouvre des lignes déjà tombées dedans.
  const [partitions] = await db.$queryRaw<{ total: number; defaut: number }[]>`
    SELECT
      (SELECT count(*)::int FROM pg_inherits i
         JOIN pg_class p ON p.oid = i.inhparent
        WHERE p.relname = 'AdObservation') AS total,
      (SELECT count(*)::int FROM "AdObservation_defaut") AS defaut
  `;

  return {
    base: { annonceurs, annonces, observations, retirees },
    ingestion: {
      derniereReussite: derniere?.finishedAt ?? null,
      heuresDepuis,
      enRetard: heuresDepuis === null || heuresDepuis > SEUIL_RETARD_H,
      lots: lots.map((l) => ({
        id: l.id,
        pays: l.countryCode,
        terme: l.searchTerm,
        statut: l.status,
        demarre: l.startedAt,
        fini: l.finishedAt,
        vues: l.adsFetched,
        nouvelles: l.adsNew,
        erreur: l.error,
      })),
      souffrance,
    },
    partitions: { total: partitions?.total ?? 0, defautNonVide: partitions?.defaut ?? 0 },
    configuration: {
      source: source.nom,
      sourceEstDemo: source.estDemo,
      stockageConfigure: stockage.configure,
      tarifsManquants: offresSansTarif().flatMap((o) => o.manquantes),
    },
    revue: { annonceurs: revue },
  };
}
