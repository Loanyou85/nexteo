import 'server-only';
import { Prisma } from '@prisma/client';
import { requetePrefixe } from '@/lib/plein-texte';
import { db } from '@/server/db';
import { bandePour, type Bande } from '@/lib/signal/score';

/**
 * Lecture des annonceurs : recherche, filtres, pagination par curseur.
 *
 * Écrit en SQL plutôt qu'en requêtes Prisma composées, pour trois raisons :
 * le plein texte passe par un index GIN que Prisma ne sait pas exprimer, la
 * pagination par curseur a besoin d'une comparaison de n-uplets, et les
 * agrégats par annonceur (annonces actives, plus ancienne diffusion) doivent
 * se calculer en une passe. Trois allers-retours par ligne de tableau
 * rendraient la liste inutilisable.
 */

export type Tri = 'signal' | 'anciennete' | 'volume' | 'nouveaute';

export type Filtres = {
  q?: string;
  bande?: Bande;
  categorie?: string;
  pays?: string;
  plateforme?: string;
  langue?: string;
  /** Diffusion de la plus ancienne annonce active, en jours. */
  ancienneteMin?: number;
  /** Nombre minimal d'annonces actives simultanément. */
  actifMin?: number;
  /** `true` = au moins une annonce en cours, `false` = plus rien ne tourne. */
  enDiffusion?: boolean;
  /** Première apparition dans l'archive, au plus tard. */
  vuAvant?: Date;
  tri?: Tri;
};

export type LigneAnnonceur = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  categorie: string | null;
  categorieSlug: string | null;
  signalScore: number;
  bande: Bande;
  libelleBande: string;
  isDemo: boolean;
  firstSeenAt: Date;
  annoncesActives: number;
  annoncesTotal: number;
  annoncesRetirees: number;
  /** Jours depuis le début de la plus ancienne annonce encore diffusée. */
  joursDiffusion: number;
  pays: string[];
  plateformes: string[];
  /** Annonces actives mois par mois sur douze mois, du plus ancien au plus récent. */
  activiteMensuelle: number[];
  /** Accroche de l'annonce active la plus ancienne : celle qui tient le plus longtemps. */
  accroche: string | null;
  declareCents: number | null;
  declareSource: string | null;
  declareLe: Date | null;
  estimeBasCents: number | null;
  estimeHautCents: number | null;
  estimeMethode: string | null;
  estimeFiabilite: string | null;
};

const TAILLE_PAR_DEFAUT = 24;

/** Bornes de score des bandes, pour filtrer sans recalculer le signal. */
const BORNES: Record<Bande, [number, number]> = {
  test: [0, 29],
  validation: [30, 59],
  installe: [60, 84],
  eprouve: [85, 100],
};

function encoderCurseur(valeurTri: number, id: string): string {
  return Buffer.from(`${valeurTri}:${id}`, 'utf8').toString('base64url');
}

function decoderCurseur(curseur: string | undefined): { valeur: number; id: string } | null {
  if (!curseur) return null;
  try {
    const [valeur, id] = Buffer.from(curseur, 'base64url').toString('utf8').split(':');
    if (!id || valeur === undefined) return null;
    const n = Number(valeur);
    return Number.isFinite(n) ? { valeur: n, id } : null;
  } catch {
    return null;
  }
}

/**
 * Expression de tri, et colonne portant la valeur du curseur.
 *
 * Toujours complétée par `id` : deux annonceurs au même score doivent
 * s'ordonner de façon stable, sinon la pagination en saute ou en répète.
 */
const COLONNE_TRI: Record<Tri, Prisma.Sql> = {
  signal: Prisma.sql`a."signalScore"`,
  anciennete: Prisma.sql`COALESCE(g."joursDiffusion", 0)`,
  volume: Prisma.sql`COALESCE(g."annoncesActives", 0)`,
  nouveaute: Prisma.sql`EXTRACT(EPOCH FROM a."firstSeenAt")::bigint`,
};

export async function rechercherAnnonceurs(
  filtres: Filtres = {},
  curseur?: string,
  taille = TAILLE_PAR_DEFAUT,
): Promise<{ lignes: LigneAnnonceur[]; curseurSuivant: string | null }> {
  const tri = filtres.tri ?? 'signal';
  const limite = Math.min(Math.max(taille, 1), 100);

  const conditions: Prisma.Sql[] = [
    // Une page exclue par un administrateur reste en base mais ne s'affiche
    // plus, et une page fusionnée s'efface derrière celle qui la remplace.
    Prisma.sql`a."excluded" = false`,
    Prisma.sql`a."mergedIntoId" IS NULL`,
  ];

  const q = filtres.q?.trim();
  if (q) {
    // Plein texte par préfixe sur les annonces, plus recherche par fragment
    // sur le nom : « stri » doit trouver « Stripe », que le plein texte seul
    // ne rattrape pas.
    const requete = requetePrefixe(q);

    conditions.push(
      requete
        ? Prisma.sql`(
            a."name" ILIKE ${'%' + q + '%'}
            OR a."searchVector" @@ to_tsquery('simple', ${requete})
            OR EXISTS (
              SELECT 1 FROM "Ad" d
              WHERE d."advertiserId" = a."id"
                AND d."searchVector" @@ to_tsquery('simple', ${requete})
            )
          )`
        : Prisma.sql`a."name" ILIKE ${'%' + q + '%'}`,
    );
  }

  if (filtres.bande) {
    const [min, max] = BORNES[filtres.bande];
    conditions.push(Prisma.sql`a."signalScore" BETWEEN ${min} AND ${max}`);
  }
  if (filtres.categorie) conditions.push(Prisma.sql`c."slug" = ${filtres.categorie}`);
  if (filtres.vuAvant) conditions.push(Prisma.sql`a."firstSeenAt" <= ${filtres.vuAvant}`);
  if (filtres.pays) conditions.push(Prisma.sql`${filtres.pays} = ANY(g."pays")`);
  if (filtres.plateforme) conditions.push(Prisma.sql`${filtres.plateforme} = ANY(g."plateformes")`);
  if (filtres.langue) conditions.push(Prisma.sql`${filtres.langue} = ANY(g."langues")`);
  if (filtres.ancienneteMin !== undefined) {
    conditions.push(Prisma.sql`COALESCE(g."joursDiffusion", 0) >= ${filtres.ancienneteMin}`);
  }
  if (filtres.actifMin !== undefined) {
    conditions.push(Prisma.sql`COALESCE(g."annoncesActives", 0) >= ${filtres.actifMin}`);
  }
  if (filtres.enDiffusion !== undefined) {
    conditions.push(
      filtres.enDiffusion
        ? Prisma.sql`COALESCE(g."annoncesActives", 0) > 0`
        : Prisma.sql`COALESCE(g."annoncesActives", 0) = 0`,
    );
  }

  const position = decoderCurseur(curseur);
  if (position) {
    conditions.push(
      Prisma.sql`(${COLONNE_TRI[tri]}, a."id") < (${position.valeur}, ${position.id})`,
    );
  }

  // Une ligne de plus que demandé : sa présence dit qu'il reste une page,
  // sans avoir à compter l'ensemble du résultat.
  const lignes = await db.$queryRaw<
    (Omit<LigneAnnonceur, 'bande' | 'libelleBande'> & { valeurTri: number })[]
  >`
    -- Deux agrégats séparés, et c'est indispensable.
    --
    -- Déplier trois tableaux (pays, plateformes, langues) dans la même requête
    -- multiplie chaque annonce par le produit de leurs cardinalités : une
    -- annonce diffusée dans 8 pays sur 4 plateformes comptait pour 32. La
    -- liste affichait « 373 archivées » là où la fiche en montrait 23.
    -- Les comptages se font donc sur les annonces, les tableaux à part.
    WITH comptes AS (
      SELECT
        d."advertiserId" AS "advertiserId",
        count(*) FILTER (WHERE d."isActive")::int AS "annoncesActives",
        count(*)::int AS "annoncesTotal",
        count(*) FILTER (WHERE d."goneFromMeta")::int AS "annoncesRetirees",
        COALESCE(
          EXTRACT(DAY FROM now() - min(d."deliveryStartTime") FILTER (WHERE d."isActive"))::int,
          0
        ) AS "joursDiffusion"
      FROM "Ad" d
      GROUP BY d."advertiserId"
    ),
    listes AS (
      SELECT
        d."advertiserId" AS "advertiserId",
        COALESCE(array_agg(DISTINCT p) FILTER (WHERE p IS NOT NULL), '{}') AS "pays",
        COALESCE(array_agg(DISTINCT pl) FILTER (WHERE pl IS NOT NULL), '{}') AS "plateformes",
        COALESCE(array_agg(DISTINCT lg) FILTER (WHERE lg IS NOT NULL), '{}') AS "langues"
      FROM "Ad" d
      LEFT JOIN LATERAL unnest(d."reachedCountries") AS p ON true
      LEFT JOIN LATERAL unnest(d."publisherPlatforms") AS pl ON true
      LEFT JOIN LATERAL unnest(d."languages") AS lg ON true
      GROUP BY d."advertiserId"
    ),
    agregats AS (
      SELECT
        c."advertiserId",
        c."annoncesActives", c."annoncesTotal", c."annoncesRetirees", c."joursDiffusion",
        COALESCE(l."pays", '{}') AS "pays",
        COALESCE(l."plateformes", '{}') AS "plateformes",
        COALESCE(l."langues", '{}') AS "langues"
      FROM comptes c
      LEFT JOIN listes l ON l."advertiserId" = c."advertiserId"
    )
    SELECT
      a."id", a."slug", a."name", a."websiteUrl", a."signalScore", a."isDemo", a."firstSeenAt",
      a."mrrDeclaredCents" AS "declareCents",
      a."mrrDeclaredSource" AS "declareSource",
      a."mrrDeclaredAt" AS "declareLe",
      a."mrrEstimatedLowCents" AS "estimeBasCents",
      a."mrrEstimatedHighCents" AS "estimeHautCents",
      a."mrrEstimatedMethod" AS "estimeMethode",
      a."mrrEstimatedTrust" AS "estimeFiabilite",
      c."label" AS "categorie", c."slug" AS "categorieSlug",
      COALESCE(g."annoncesActives", 0) AS "annoncesActives",
      COALESCE(g."annoncesTotal", 0) AS "annoncesTotal",
      COALESCE(g."annoncesRetirees", 0) AS "annoncesRetirees",
      COALESCE(g."joursDiffusion", 0) AS "joursDiffusion",
      COALESCE(g."pays", '{}') AS "pays",
      COALESCE(g."plateformes", '{}') AS "plateformes",
      -- Activité mois par mois : combien d'annonces tournaient simultanément
      -- à chacun des douze derniers mois. C'est la place qu'un concurrent
      -- remplit avec une courbe de recettes estimées ; ici c'est un fait
      -- observé, et c'est tout l'écart entre les deux produits.
      COALESCE((
        SELECT array_agg(s.c ORDER BY s.m DESC)
        FROM generate_series(0, 11) AS m,
        LATERAL (
          SELECT m AS m, count(*)::int AS c
          FROM "Ad" d2
          WHERE d2."advertiserId" = a."id"
            AND d2."deliveryStartTime" < now() - make_interval(months => m)
            AND (
              d2."deliveryStopTime" IS NULL
              OR d2."deliveryStopTime" > now() - make_interval(months => m + 1)
            )
        ) AS s
      ), '{}') AS "activiteMensuelle",
      -- L'accroche de l'annonce active la plus ancienne. Pas la plus récente :
      -- celle qui tourne depuis le plus longtemps est celle que l'annonceur
      -- continue de payer, donc celle qui marche.
      (
        SELECT left(split_part(d3."bodyText", E'\n', 1), 150)
        FROM "Ad" d3
        WHERE d3."advertiserId" = a."id" AND d3."isActive" AND d3."bodyText" IS NOT NULL
        ORDER BY d3."deliveryStartTime" ASC
        LIMIT 1
      ) AS "accroche",
      ${COLONNE_TRI[tri]} AS "valeurTri"
    FROM "Advertiser" a
    LEFT JOIN "Category" c ON c."id" = a."categoryId"
    LEFT JOIN agregats g ON g."advertiserId" = a."id"
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY ${COLONNE_TRI[tri]} DESC, a."id" DESC
    LIMIT ${limite + 1}
  `;

  const page = lignes.slice(0, limite);
  const derniere = page[page.length - 1];

  return {
    lignes: page.map((l) => {
      const { bande, libelle } = bandePour(l.signalScore);
      return { ...l, bande, libelleBande: libelle };
    }),
    curseurSuivant:
      lignes.length > limite && derniere ? encoderCurseur(derniere.valeurTri, derniere.id) : null,
  };
}

/** Référentiels d'affichage des filtres, lus depuis ce qui existe réellement. */
export async function facettes() {
  const [categories, pays, plateformes] = await Promise.all([
    db.category.findMany({
      where: { advertisers: { some: { excluded: false } } },
      select: { slug: true, label: true },
      orderBy: { label: 'asc' },
    }),
    db.$queryRaw<{ code: string; n: number }[]>`
      SELECT p AS code, count(DISTINCT d."advertiserId")::int AS n
      FROM "Ad" d, unnest(d."reachedCountries") AS p
      GROUP BY p ORDER BY n DESC LIMIT 30
    `,
    db.$queryRaw<{ code: string; n: number }[]>`
      SELECT pl AS code, count(DISTINCT d."advertiserId")::int AS n
      FROM "Ad" d, unnest(d."publisherPlatforms") AS pl
      GROUP BY pl ORDER BY n DESC LIMIT 12
    `,
  ]);
  return { categories, pays, plateformes };
}
