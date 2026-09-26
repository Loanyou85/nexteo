import 'server-only';
import { db } from '@/server/db';

/**
 * Signaux de marché : ce que l'archive dit du mouvement, pas de l'instant.
 *
 * Un classement d'annonceurs répond à « qui paie le plus longtemps ». Cet écran
 * répond à « qu'est-ce qui bouge » — et il n'y a que l'historique qui puisse le
 * dire. C'est la seule page dont la valeur augmente mécaniquement avec l'âge de
 * la base, et c'est pour ça que le pipeline tourne dès le premier jour.
 *
 * Chaque bloc est une requête distincte. Croiser ces agrégats dans une seule
 * requête multiplierait les lignes avant le comptage — la même erreur qui avait
 * fait afficher des totaux faux sur la liste.
 */

export type CategorieEnMouvement = {
  slug: string;
  label: string;
  annonceursActifs: number;
  /** Annonceurs dont la première annonce est apparue dans les 90 derniers jours. */
  entrants: number;
  /** Annonceurs qui ont tout arrêté dans les 90 derniers jours. */
  sortants: number;
  medianeJours: number;
};

export type NouvelEntrant = {
  slug: string;
  nom: string;
  site: string | null;
  categorie: string | null;
  signalScore: number;
  premiereVue: Date;
  annoncesActives: number;
  joursDiffusion: number;
};

export type SortieRecente = {
  slug: string;
  nom: string;
  site: string | null;
  categorie: string | null;
  signalScore: number;
  /** Dernier jour où une annonce tournait encore. */
  arretLe: Date;
  joursTenus: number;
  annoncesTotal: number;
};

export type AccrocheMontante = {
  texte: string;
  occurrences: number;
  annonceurs: number;
  premiereVue: Date;
};

const JOURS_RECENT = 90;

/** Catégories, avec ce qui y entre et ce qui en sort. */
export async function categoriesEnMouvement(): Promise<CategorieEnMouvement[]> {
  return db.$queryRaw<CategorieEnMouvement[]>`
    WITH base AS (
      SELECT
        c."slug",
        c."label",
        a."id"            AS "annonceurId",
        a."firstSeenAt",
        count(d."id") FILTER (WHERE d."isActive")                      AS "actives",
        max(COALESCE(d."deliveryStopTime", now()))                     AS "derniereActivite",
        FLOOR(EXTRACT(EPOCH FROM (now() - min(d."deliveryStartTime"))) / 86400) AS "joursDepuisDebut"
      FROM "Category" c
      JOIN "Advertiser" a ON a."categoryId" = c."id" AND a."excluded" = false AND a."mergedIntoId" IS NULL
      LEFT JOIN "Ad" d ON d."advertiserId" = a."id"
      GROUP BY c."slug", c."label", a."id", a."firstSeenAt"
    )
    SELECT
      "slug",
      "label",
      count(*) FILTER (WHERE "actives" > 0)::int AS "annonceursActifs",
      count(*) FILTER (
        WHERE "firstSeenAt" > now() - ${`${JOURS_RECENT} days`}::interval
      )::int AS "entrants",
      count(*) FILTER (
        WHERE "actives" = 0
          AND "derniereActivite" > now() - ${`${JOURS_RECENT} days`}::interval
      )::int AS "sortants",
      COALESCE(
        percentile_cont(0.5) WITHIN GROUP (ORDER BY "joursDepuisDebut"),
        0
      )::int AS "medianeJours"
    FROM base
    GROUP BY "slug", "label"
    HAVING count(*) > 0
    ORDER BY count(*) FILTER (WHERE "actives" > 0) DESC, "label" ASC
  `;
}

/**
 * Annonceurs apparus récemment et toujours en diffusion.
 *
 * On exige au moins une annonce active : une page vue une fois puis disparue
 * n'est pas une entrée sur le marché, c'est un test annulé.
 */
export async function nouveauxEntrants(limite = 12): Promise<NouvelEntrant[]> {
  return db.$queryRaw<NouvelEntrant[]>`
    SELECT
      a."slug",
      a."name"       AS "nom",
      a."websiteUrl" AS "site",
      c."label"      AS "categorie",
      a."signalScore",
      a."firstSeenAt" AS "premiereVue",
      count(d."id") FILTER (WHERE d."isActive")::int AS "annoncesActives",
      COALESCE(
        FLOOR(
          EXTRACT(EPOCH FROM (now() - min(d."deliveryStartTime") FILTER (WHERE d."isActive"))) / 86400
        ),
        0
      )::int AS "joursDiffusion"
    FROM "Advertiser" a
    LEFT JOIN "Category" c ON c."id" = a."categoryId"
    JOIN "Ad" d ON d."advertiserId" = a."id"
    WHERE a."excluded" = false
      AND a."mergedIntoId" IS NULL
      AND a."firstSeenAt" > now() - ${`${JOURS_RECENT} days`}::interval
    GROUP BY a."slug", a."name", a."websiteUrl", c."label", a."signalScore", a."firstSeenAt"
    HAVING count(d."id") FILTER (WHERE d."isActive") > 0
    ORDER BY a."firstSeenAt" DESC
    LIMIT ${limite}
  `;
}

/**
 * Annonceurs qui viennent de tout couper.
 *
 * C'est une information et non un échec à constater : une entreprise qui a payé
 * huit mois puis s'arrête net a appris quelque chose. Savoir laquelle, et dans
 * quelle catégorie, vaut autant que la liste de ceux qui continuent.
 */
export async function sortiesRecentes(limite = 12): Promise<SortieRecente[]> {
  return db.$queryRaw<SortieRecente[]>`
    SELECT
      a."slug",
      a."name"       AS "nom",
      a."websiteUrl" AS "site",
      c."label"      AS "categorie",
      a."signalScore",
      max(d."deliveryStopTime") AS "arretLe",
      FLOOR(
        EXTRACT(EPOCH FROM (max(d."deliveryStopTime") - min(d."deliveryStartTime"))) / 86400
      )::int AS "joursTenus",
      count(d."id")::int AS "annoncesTotal"
    FROM "Advertiser" a
    LEFT JOIN "Category" c ON c."id" = a."categoryId"
    JOIN "Ad" d ON d."advertiserId" = a."id"
    WHERE a."excluded" = false
      AND a."mergedIntoId" IS NULL
    GROUP BY a."slug", a."name", a."websiteUrl", c."label", a."signalScore"
    HAVING count(d."id") FILTER (WHERE d."isActive") = 0
       AND max(d."deliveryStopTime") > now() - ${`${JOURS_RECENT} days`}::interval
    ORDER BY max(d."deliveryStopTime") DESC
    LIMIT ${limite}
  `;
}

/**
 * Accroches qui gagnent du terrain.
 *
 * Une phrase reprise par plusieurs annonceurs différents pèse plus lourd que la
 * même phrase répétée par un seul : le tri met donc le nombre d'annonceurs
 * avant le nombre d'occurrences.
 */
export async function accrochesMontantes(limite = 15): Promise<AccrocheMontante[]> {
  return db.$queryRaw<AccrocheMontante[]>`
    SELECT
      d."bodyText"                         AS "texte",
      count(*)::int                        AS "occurrences",
      count(DISTINCT d."advertiserId")::int AS "annonceurs",
      min(d."deliveryStartTime")           AS "premiereVue"
    FROM "Ad" d
    JOIN "Advertiser" a ON a."id" = d."advertiserId"
    WHERE a."excluded" = false
      AND a."mergedIntoId" IS NULL
      AND d."bodyText" IS NOT NULL
      AND length(d."bodyText") BETWEEN 12 AND 200
      AND d."deliveryStartTime" > now() - ${`${JOURS_RECENT * 2} days`}::interval
    GROUP BY d."bodyText"
    HAVING count(*) > 1
    ORDER BY count(DISTINCT d."advertiserId") DESC, count(*) DESC
    LIMIT ${limite}
  `;
}
