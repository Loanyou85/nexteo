import type { PrismaClient } from '@prisma/client';
import { db as dbParDefaut } from '@/server/db';
import {
  AnnonceInvalide,
  ErreurDebit,
  normaliser,
  sourceAnnonces,
  type AdSource,
  type AnnonceNormalisee,
} from '@/server/source';
import { stockageObjet, type StockageObjet } from '@/server/stockage';
import { assurerAnnonceur } from './annonceurs';
import { empreinteCreation } from './empreinte';
import { recalculerSignal } from './signal';

/**
 * Pipeline d'ingestion (section 8).
 *
 * Ce que ce code protège : **chaque jour sans ingestion est de la donnée
 * perdue définitivement.** L'archive Meta efface une annonce commerciale
 * environ douze mois après sa dernière impression, et personne — pas même un
 * concurrent mieux financé — ne pourra la reconstituer. Toutes les décisions
 * ci-dessous découlent de là : on reprend au curseur, on temporise plutôt que
 * d'abandonner, on saute une annonce illisible plutôt que de perdre le lot,
 * et on n'interrompt jamais une exécution pour une raison annexe comme un
 * stockage mal configuré.
 */

const JOUR_MS = 86_400_000;

/** Au-delà, une annonce qu'on ne revoit plus est considérée retirée par Meta. */
const JOURS_AVANT_DISPARITION = 30;

export type OptionsIngestion = {
  db?: PrismaClient;
  source?: AdSource;
  stockage?: StockageObjet;
  pays?: string[];
  termes?: string[];
  maintenant?: Date;
  /** Taille de page demandée à la source. */
  taille?: number;
  /** Nombre maximal de pages par couple pays/terme. Garde-fou anti-boucle. */
  pagesMax?: number;
  /** Tentatives sur dépassement de débit avant d'abandonner ce couple. */
  tentativesMax?: number;
  /** Injectable pour que les tests ne dorment pas réellement. */
  attendre?: (ms: number) => Promise<void>;
  journal?: (message: string) => void;
};

export type ResumeIngestion = {
  demarreA: Date;
  termineA: Date;
  lots: number;
  annoncesVues: number;
  annoncesNouvelles: number;
  annoncesIgnorees: number;
  annonceursCrees: number;
  annonceursRecalcules: number;
  visuelsCopies: number;
  marqueesDisparues: number;
  echecs: { pays: string; terme: string; erreur: string }[];
};

function listeEnv(nom: string, defaut: string[]): string[] {
  const brut = process.env[nom]?.trim();
  if (!brut) return defaut;
  const valeurs = brut
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return valeurs.length > 0 ? valeurs : defaut;
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * URL de visuels présentes dans la charge brute.
 *
 * Écrit défensivement : l'endpoint `ads_archive` ne documente pas de champ
 * média, et l'instantané est une page HTML, pas un fichier. On prend ce qui
 * est exposé quand ça l'est, sans jamais en dépendre.
 */
function urlsVisuels(charge: Record<string, unknown>): string[] {
  const trouvees: string[] = [];
  const candidats = ['ad_creative_images', 'ad_creative_videos', 'images', 'videos'];
  for (const cle of candidats) {
    const valeur = charge[cle];
    if (!Array.isArray(valeur)) continue;
    for (const v of valeur) {
      if (typeof v === 'string' && /^https?:\/\//.test(v)) trouvees.push(v);
      else if (v && typeof v === 'object') {
        for (const sous of Object.values(v as Record<string, unknown>)) {
          if (typeof sous === 'string' && /^https?:\/\//.test(sous)) trouvees.push(sous);
        }
      }
    }
  }
  return [...new Set(trouvees)];
}

/** Crée la partition du mois courant et du suivant. */
async function assurerPartitions(db: PrismaClient, maintenant: Date): Promise<void> {
  const moisSuivant = new Date(maintenant.getTime() + 31 * JOUR_MS);
  for (const d of [maintenant, moisSuivant]) {
    const jour = d.toISOString().slice(0, 10);
    await db.$executeRawUnsafe(`SELECT nexteo_partition_observation($1::date)`, jour);
  }
}

async function enregistrerAnnonce(
  db: PrismaClient,
  stockage: StockageObjet,
  annonce: AnnonceNormalisee,
  contexte: { advertiserId: string; estDemo: boolean; maintenant: Date },
): Promise<{ nouvelle: boolean; visuelsCopies: number }> {
  let visuelsCopies = 0;
  const checksums: string[] = [];

  // Les visuels d'abord : leur somme de contrôle entre dans l'empreinte.
  const urls = stockage.configure ? urlsVisuels(annonce.rawPayload as Record<string, unknown>) : [];
  const copies: { url: string; storageKey: string | null; checksum: string | null }[] = [];
  for (const url of urls) {
    const r = await stockage.copier(url, 'visuels');
    if (r.copie) {
      checksums.push(r.checksum);
      copies.push({ url, storageKey: r.storageKey, checksum: r.checksum });
      visuelsCopies += 1;
    } else if (r.checksum) {
      checksums.push(r.checksum);
      copies.push({ url, storageKey: null, checksum: r.checksum });
    }
  }

  const creativeHash = empreinteCreation(annonce, checksums);

  const existante = await db.ad.findUnique({
    where: { metaAdId: annonce.metaAdId },
    select: { id: true, firstSeenAt: true },
  });

  const communs = {
    advertiserId: contexte.advertiserId,
    bodyText: annonce.bodyText,
    linkTitle: annonce.linkTitle,
    linkDescription: annonce.linkDescription,
    linkCaption: annonce.linkCaption,
    landingUrl: annonce.landingUrl,
    landingDomain: annonce.landingDomain,
    snapshotUrl: annonce.snapshotUrl,
    deliveryStartTime: annonce.deliveryStartTime,
    deliveryStopTime: annonce.deliveryStopTime,
    publisherPlatforms: annonce.publisherPlatforms,
    languages: annonce.languages,
    reachedCountries: annonce.reachedCountries,
    isActive: annonce.isActive,
    creativeHash,
    lastSeenAt: contexte.maintenant,
    // On la revoit : elle n'a pas disparu de l'archive.
    goneFromMeta: false,
    isDemo: contexte.estDemo,
  };

  const ad = existante
    ? await db.ad.update({ where: { id: existante.id }, data: communs, select: { id: true } })
    : await db.ad.create({
        data: { ...communs, metaAdId: annonce.metaAdId, firstSeenAt: contexte.maintenant },
        select: { id: true },
      });

  for (const c of copies) {
    if (!c.checksum) continue;
    await db.adCreative.upsert({
      where: { adId_checksum: { adId: ad.id, checksum: c.checksum } },
      update: c.storageKey ? { storageKey: c.storageKey, copiedAt: contexte.maintenant } : {},
      create: {
        adId: ad.id,
        type: /\.(mp4|mov|webm)(\?|$)/i.test(c.url) ? 'video' : 'image',
        storageKey: c.storageKey,
        copiedAt: c.storageKey ? contexte.maintenant : null,
        sourceUrl: c.url,
        checksum: c.checksum,
      },
    });
  }

  // L'observation est écrite systématiquement, même quand rien n'a changé.
  // C'est elle qui porte la valeur du produit : on n'écrase pas une ligne, on
  // empile des observations horodatées.
  await db.adObservation.create({
    data: {
      adId: ad.id,
      observedAt: contexte.maintenant,
      isActive: annonce.isActive,
      rawPayload: annonce.rawPayload as object,
    },
  });

  return { nouvelle: !existante, visuelsCopies };
}

export async function executerIngestion(options: OptionsIngestion = {}): Promise<ResumeIngestion> {
  const db = options.db ?? dbParDefaut;
  const source = options.source ?? sourceAnnonces();
  const stockage = options.stockage ?? stockageObjet();
  const maintenant = options.maintenant ?? new Date();
  const attendre = options.attendre ?? dormir;
  const journal = options.journal ?? ((m: string) => console.log(m));

  const pays = options.pays ?? listeEnv('META_COUNTRIES', ['FR']);
  const termes = options.termes ?? listeEnv('META_SEARCH_TERMS', ['saas']);
  const taille = options.taille ?? 100;
  const pagesMax = options.pagesMax ?? 200;
  const tentativesMax = options.tentativesMax ?? 5;

  const resume: ResumeIngestion = {
    demarreA: maintenant,
    termineA: maintenant,
    lots: 0,
    annoncesVues: 0,
    annoncesNouvelles: 0,
    annoncesIgnorees: 0,
    annonceursCrees: 0,
    annonceursRecalcules: 0,
    visuelsCopies: 0,
    marqueesDisparues: 0,
    echecs: [],
  };

  await assurerPartitions(db, maintenant);

  if (!stockage.configure) {
    journal(
      '[ingestion] Stockage objet non configuré : les visuels ne sont pas copiés. ' +
        "L'ingestion continue — perdre une journée d'annonces pour un bucket manquant " +
        'coûterait bien plus cher.',
    );
  }

  const categories = new Map(
    (await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );

  const annonceursTouches = new Set<string>();

  for (const unPays of pays) {
    for (const terme of termes) {
      resume.lots += 1;

      // Reprise. Deux états laissent un curseur exploitable : un lot « failed »,
      // qui a échoué en cours de route, et un lot resté « running », dont le
      // processus a été tué sans jamais conclure. Ne regarder que le second
      // rendait le curseur inutile — il était écrit, jamais relu — et une
      // coupure à la page 180 sur 200 faisait repayer 180 pages de quota.
      const dernier = await db.ingestJob.findFirst({
        where: { countryCode: unPays, searchTerm: terme },
        orderBy: { createdAt: 'desc' },
      });

      const inacheve = dernier?.status === 'running' || dernier?.status === 'pending';
      const curseurHerite = dernier && dernier.status !== 'succeeded' ? dernier.cursor : null;

      // Un lot en échec donne son curseur à un lot NEUF plutôt que d'être
      // ressuscité : `lotsEnSouffrance` compte les deux derniers états, et
      // réécrire la ligne effacerait la trace de l'échec.
      const job = inacheve
        ? await db.ingestJob.update({
            where: { id: dernier.id },
            data: { status: 'running', startedAt: maintenant, error: null },
          })
        : await db.ingestJob.create({
            data: {
              countryCode: unPays,
              searchTerm: terme,
              status: 'running',
              startedAt: maintenant,
              cursor: curseurHerite,
            },
          });

      if (job.cursor) {
        journal(`[ingestion] ${unPays}/${terme} : reprise au curseur enregistré.`);
      }

      let curseur = job.cursor;
      let pages = 0;
      let vues = job.adsFetched;
      let nouvelles = job.adsNew;

      try {
        for (;;) {
          if (pages >= pagesMax) {
            journal(`[ingestion] ${unPays}/${terme} : ${pagesMax} pages atteintes, on s'arrête là.`);
            break;
          }

          let page;
          let tentative = 0;

          for (;;) {
            try {
              page = await source.recuperer({ pays: unPays, terme, curseur, taille });
              break;
            } catch (e) {
              if (!(e instanceof ErreurDebit)) throw e;
              tentative += 1;
              if (tentative > tentativesMax) throw e;
              // Repli exponentiel plafonné, avec une part aléatoire : plusieurs
              // lots repartis exactement en même temps se retrouveraient à
              // nouveau tous devant le même quota.
              const attente =
                e.attendreMs ?? Math.min(60_000, 2 ** tentative * 1000) * (0.5 + Math.random());
              journal(
                `[ingestion] ${unPays}/${terme} : débit dépassé, nouvelle tentative ${tentative}/${tentativesMax} dans ${Math.round(attente)} ms.`,
              );
              await attendre(attente);
            }
          }

          for (const brute of page.annonces) {
            vues += 1;
            resume.annoncesVues += 1;

            let annonce: AnnonceNormalisee;
            try {
              annonce = normaliser(brute, maintenant);
            } catch (e) {
              // Une annonce illisible est sautée, jamais fatale : perdre une
              // ligne vaut mieux que perdre l'exécution du jour.
              if (e instanceof AnnonceInvalide) {
                resume.annoncesIgnorees += 1;
                continue;
              }
              throw e;
            }

            const annonceur = await assurerAnnonceur(db, annonce, {
              estDemo: source.estDemo,
              maintenant,
              categories,
            });
            if (annonceur.cree) resume.annonceursCrees += 1;
            annonceursTouches.add(annonceur.id);

            const r = await enregistrerAnnonce(db, stockage, annonce, {
              advertiserId: annonceur.id,
              estDemo: source.estDemo,
              maintenant,
            });
            if (r.nouvelle) {
              nouvelles += 1;
              resume.annoncesNouvelles += 1;
            }
            resume.visuelsCopies += r.visuelsCopies;
          }

          pages += 1;
          curseur = page.curseurSuivant;

          // Le curseur n'est enregistré qu'une fois la page entièrement
          // traitée. Une panne en plein milieu rejoue la page : tout y est
          // idempotent, et une observation en double ne fausse rien puisque
          // la couverture compte des jours distincts, pas des lignes.
          await db.ingestJob.update({
            where: { id: job.id },
            data: { cursor: curseur, adsFetched: vues, adsNew: nouvelles },
          });

          if (!curseur) break;
        }

        await db.ingestJob.update({
          where: { id: job.id },
          data: {
            status: 'succeeded',
            finishedAt: new Date(),
            cursor: null,
            adsFetched: vues,
            adsNew: nouvelles,
          },
        });
      } catch (e) {
        const message = (e as Error).message.slice(0, 500);
        resume.echecs.push({ pays: unPays, terme, erreur: message });
        await db.ingestJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            finishedAt: new Date(),
            // Le curseur est conservé : la prochaine exécution reprend ici.
            cursor: curseur,
            adsFetched: vues,
            adsNew: nouvelles,
            error: message,
          },
        });
        journal(`[ingestion] ${unPays}/${terme} a échoué : ${message}`);
      }
    }
  }

  // Annonces qu'on ne revoit plus depuis un mois : Meta les a retirées de son
  // archive. Nexteo les garde — c'est précisément ce qu'aucun concurrent ne
  // pourra reconstituer — mais les marque pour pouvoir les mettre en avant.
  const disparues = await db.ad.updateMany({
    where: {
      goneFromMeta: false,
      lastSeenAt: { lt: new Date(maintenant.getTime() - JOURS_AVANT_DISPARITION * JOUR_MS) },
    },
    data: { goneFromMeta: true, isActive: false },
  });
  resume.marqueesDisparues = disparues.count;

  resume.annonceursRecalcules = await recalculerSignal(db, [...annonceursTouches], maintenant);
  resume.termineA = new Date();

  return resume;
}

/**
 * Deux exécutions ratées d'affilée sur un même couple pays/terme.
 *
 * Ce n'est pas un incident technique de plus : ce sont deux jours de données
 * que personne ne pourra jamais rattraper. /admin le remonte, et le
 * planificateur le signale.
 */
export async function lotsEnSouffrance(
  db: PrismaClient,
): Promise<{ pays: string; terme: string | null; echecs: number }[]> {
  const lignes = await db.$queryRaw<{ pays: string; terme: string | null; echecs: number }[]>`
    WITH derniers AS (
      SELECT "countryCode", "searchTerm", "status",
             row_number() OVER (PARTITION BY "countryCode", "searchTerm" ORDER BY "createdAt" DESC) AS rang
      FROM "IngestJob"
      WHERE "status" IN ('succeeded', 'failed')
    )
    SELECT "countryCode" AS pays, "searchTerm" AS terme, count(*)::int AS echecs
    FROM derniers
    WHERE rang <= 2 AND "status" = 'failed'
    GROUP BY "countryCode", "searchTerm"
    HAVING count(*) >= 2
  `;
  return lignes;
}
