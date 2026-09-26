import 'server-only';
import { Prisma } from '@prisma/client';
import { requetePrefixe } from '@/lib/plein-texte';
import { db } from '@/server/db';

/**
 * Lecture des annonces, une par une.
 *
 * La recherche d'annonceurs répond à « qui paie ? ». Celle-ci répond à
 * « qu'est-ce qui est écrit ? » : on vient y chercher une accroche, une
 * promesse, une façon de nommer un problème. Ce ne sont pas les mêmes
 * questions, donc pas la même liste.
 *
 * Le plein texte passe par la colonne `tsv` générée à l'écriture, pas par un
 * `ILIKE` : sur deux cent mille annonces, un balayage séquentiel prend des
 * secondes là où l'index GIN prend des millisecondes.
 */

export type FiltresAnnonces = {
  q?: string;
  /** `true` = encore diffusée, `false` = arrêtée. */
  enDiffusion?: boolean;
  /** Retirées de l'archive Meta mais conservées ici. */
  retirees?: boolean;
  pays?: string;
  plateforme?: string;
  categorie?: string;
  /** Durée de diffusion minimale, en jours. */
  joursMin?: number;
  tri?: TriAnnonces;
};

export type TriAnnonces = 'duree' | 'recentes' | 'anciennes';

export type LigneAnnonce = {
  id: string;
  metaAdId: string;
  snapshotUrl: string;
  bodyText: string | null;
  linkTitle: string | null;
  landingDomain: string | null;
  deliveryStartTime: Date;
  deliveryStopTime: Date | null;
  isActive: boolean;
  goneFromMeta: boolean;
  reachedCountries: string[];
  publisherPlatforms: string[];
  jours: number;
  annonceurId: string;
  annonceurNom: string;
  annonceurSlug: string;
  annonceurSite: string | null;
  annonceurSignal: number;
  isDemo: boolean;
};

const PAR_PAGE = 36;

const COLONNE_TRI: Record<TriAnnonces, Prisma.Sql> = {
  duree: Prisma.sql`EXTRACT(EPOCH FROM (COALESCE(d."deliveryStopTime", now()) - d."deliveryStartTime"))::bigint`,
  recentes: Prisma.sql`EXTRACT(EPOCH FROM d."deliveryStartTime")::bigint`,
  anciennes: Prisma.sql`-EXTRACT(EPOCH FROM d."deliveryStartTime")::bigint`,
};

function encoder(valeur: number, id: string) {
  return Buffer.from(`${valeur}:${id}`, 'utf8').toString('base64url');
}

function decoder(curseur?: string): { valeur: number; id: string } | null {
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

type Brut = Omit<LigneAnnonce, 'jours'> & { jours: bigint | number };

export async function rechercherAnnonces(
  filtres: FiltresAnnonces = {},
  curseur?: string,
  taille = PAR_PAGE,
): Promise<{ lignes: LigneAnnonce[]; curseurSuivant: string | null }> {
  const tri = filtres.tri ?? 'duree';
  const limite = Math.min(Math.max(taille, 1), 100);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`a."excluded" = false`,
    Prisma.sql`a."mergedIntoId" IS NULL`,
  ];

  if (filtres.q) {
    // Préfixes plutôt que mots entiers, et repli sur le titre du lien quand la
    // saisie est trop courte pour l'index — sinon taper « ai » ne renverrait
    // rien du tout, ce qui se lit comme une panne.
    const requete = requetePrefixe(filtres.q);
    conditions.push(
      requete
        ? Prisma.sql`(
            d."searchVector" @@ to_tsquery('simple', ${requete})
            OR a."name" ILIKE ${'%' + filtres.q + '%'}
          )`
        : Prisma.sql`(
            d."linkTitle" ILIKE ${'%' + filtres.q + '%'}
            OR a."name" ILIKE ${'%' + filtres.q + '%'}
          )`,
    );
  }
  if (filtres.enDiffusion !== undefined) {
    conditions.push(Prisma.sql`d."isActive" = ${filtres.enDiffusion}`);
  }
  if (filtres.retirees) {
    conditions.push(Prisma.sql`d."goneFromMeta" = true`);
  }
  if (filtres.pays) {
    conditions.push(Prisma.sql`${filtres.pays} = ANY(d."reachedCountries")`);
  }
  if (filtres.plateforme) {
    conditions.push(Prisma.sql`${filtres.plateforme} = ANY(d."publisherPlatforms")`);
  }
  if (filtres.categorie) {
    conditions.push(
      Prisma.sql`a."categoryId" IN (SELECT c."id" FROM "Category" c WHERE c."slug" = ${filtres.categorie})`,
    );
  }
  if (filtres.joursMin) {
    conditions.push(
      Prisma.sql`COALESCE(d."deliveryStopTime", now()) - d."deliveryStartTime" >= ${`${filtres.joursMin} days`}::interval`,
    );
  }

  const position = decoder(curseur);
  const colonne = COLONNE_TRI[tri];
  if (position) {
    conditions.push(Prisma.sql`(${colonne}, d."id") < (${position.valeur}, ${position.id})`);
  }

  const ou = Prisma.join(conditions, ' AND ');

  const lignes = await db.$queryRaw<Brut[]>`
    SELECT
      d."id",
      d."metaAdId",
      d."snapshotUrl",
      d."bodyText",
      d."linkTitle",
      d."landingDomain",
      d."deliveryStartTime",
      d."deliveryStopTime",
      d."isActive",
      d."goneFromMeta",
      d."reachedCountries",
      d."publisherPlatforms",
      GREATEST(
        1,
        FLOOR(
          EXTRACT(EPOCH FROM (COALESCE(d."deliveryStopTime", now()) - d."deliveryStartTime")) / 86400
        )
      )::bigint AS "jours",
      a."id"           AS "annonceurId",
      a."name"         AS "annonceurNom",
      a."slug"         AS "annonceurSlug",
      a."websiteUrl"   AS "annonceurSite",
      a."signalScore"  AS "annonceurSignal",
      a."isDemo"       AS "isDemo"
    FROM "Ad" d
    JOIN "Advertiser" a ON a."id" = d."advertiserId"
    WHERE ${ou}
    ORDER BY ${colonne} DESC, d."id" DESC
    LIMIT ${limite + 1}
  `;

  const page = lignes.slice(0, limite).map((l) => ({ ...l, jours: Number(l.jours) }));
  const dernier = lignes.length > limite ? page[page.length - 1] : undefined;

  // Le curseur porte la valeur de tri, pas un numéro de page : une annonce
  // ingérée entre deux clics ne décale plus la suite.
  const valeurTri = (l: LigneAnnonce) =>
    tri === 'duree'
      ? Math.floor((+(l.deliveryStopTime ?? new Date()) - +l.deliveryStartTime) / 1000)
      : tri === 'recentes'
        ? Math.floor(+l.deliveryStartTime / 1000)
        : -Math.floor(+l.deliveryStartTime / 1000);

  return {
    lignes: page,
    curseurSuivant: dernier ? encoder(valeurTri(dernier), dernier.id) : null,
  };
}

/** Quelques chiffres d'en-tête, pour que la page annonce son ampleur. */
export async function chiffresAnnonces() {
  const [total, actives, retirees] = await Promise.all([
    db.ad.count(),
    db.ad.count({ where: { isActive: true } }),
    db.ad.count({ where: { goneFromMeta: true } }),
  ]);
  return { total, actives, retirees };
}
