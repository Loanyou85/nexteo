import 'server-only';
import { SavedItemType } from '@prisma/client';
import { db } from '@/server/db';

/**
 * Ce qu'un compte a mis de côté : collections, éléments, annonceurs suivis.
 *
 * Les éléments enregistrés ne stockent qu'un type et un identifiant, jamais une
 * copie de l'annonce. Une annonce évolue — elle s'arrête, Meta l'efface — et
 * une copie figée mentirait quelques semaines plus tard. On relit donc la
 * source à chaque affichage, et on assume qu'un élément puisse avoir disparu :
 * le dire est plus utile que d'afficher un souvenir.
 */

export type ElementAnnonceur = {
  type: 'advertiser';
  itemId: string;
  savedItemId: string;
  note: string | null;
  ajouteLe: Date;
  slug: string;
  nom: string;
  site: string | null;
  categorie: string | null;
  signalScore: number;
  annoncesActives: number;
  declareCents: number | null;
  declareSource: string | null;
  declareLe: Date | null;
  estimeBasCents: number | null;
  estimeHautCents: number | null;
  estimeMethode: string | null;
  estimeFiabilite: string | null;
};

export type ElementAnnonce = {
  type: 'ad';
  itemId: string;
  savedItemId: string;
  note: string | null;
  ajouteLe: Date;
  linkTitle: string | null;
  bodyText: string | null;
  isActive: boolean;
  goneFromMeta: boolean;
  snapshotUrl: string;
  annonceurNom: string;
  annonceurSlug: string;
  annonceurSite: string | null;
};

export type ElementPerdu = {
  type: 'perdu';
  itemId: string;
  savedItemId: string;
  note: string | null;
  ajouteLe: Date;
  itemType: SavedItemType;
};

export type Element = ElementAnnonceur | ElementAnnonce | ElementPerdu;

export type CollectionRemplie = {
  id: string | null;
  nom: string;
  creeeLe: Date | null;
  elements: Element[];
};

async function hydrater(
  items: {
    id: string;
    itemType: SavedItemType;
    itemId: string;
    note: string | null;
    createdAt: Date;
  }[],
): Promise<Element[]> {
  const idsAnnonceurs = items.filter((i) => i.itemType === 'advertiser').map((i) => i.itemId);
  const idsAnnonces = items.filter((i) => i.itemType === 'ad').map((i) => i.itemId);

  // Deux requêtes pour tous les éléments, pas deux par élément : une collection
  // de cinquante entrées ferait cent allers-retours.
  const [annonceurs, annonces] = await Promise.all([
    idsAnnonceurs.length
      ? db.advertiser.findMany({
          where: { id: { in: idsAnnonceurs } },
          select: {
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
            mrrEstimatedMethod: true,
            mrrEstimatedTrust: true,
            category: { select: { label: true } },
            _count: { select: { ads: { where: { isActive: true } } } },
          },
        })
      : [],
    idsAnnonces.length
      ? db.ad.findMany({
          where: { id: { in: idsAnnonces } },
          select: {
            id: true,
            linkTitle: true,
            bodyText: true,
            isActive: true,
            goneFromMeta: true,
            snapshotUrl: true,
            advertiser: { select: { name: true, slug: true, websiteUrl: true } },
          },
        })
      : [],
  ]);

  const parAnnonceur = new Map(annonceurs.map((a) => [a.id, a]));
  const parAnnonce = new Map(annonces.map((a) => [a.id, a]));

  return items.map((i): Element => {
    const commun = {
      itemId: i.itemId,
      savedItemId: i.id,
      note: i.note,
      ajouteLe: i.createdAt,
    };

    if (i.itemType === 'advertiser') {
      const a = parAnnonceur.get(i.itemId);
      if (!a) return { ...commun, type: 'perdu', itemType: i.itemType };
      return {
        ...commun,
        type: 'advertiser',
        slug: a.slug,
        nom: a.name,
        site: a.websiteUrl,
        categorie: a.category?.label ?? null,
        signalScore: a.signalScore,
        annoncesActives: a._count.ads,
        declareCents: a.mrrDeclaredCents,
        declareSource: a.mrrDeclaredSource,
        declareLe: a.mrrDeclaredAt,
        estimeBasCents: a.mrrEstimatedLowCents,
        estimeHautCents: a.mrrEstimatedHighCents,
        estimeMethode: a.mrrEstimatedMethod,
        estimeFiabilite: a.mrrEstimatedTrust,
      };
    }

    const d = parAnnonce.get(i.itemId);
    if (!d) return { ...commun, type: 'perdu', itemType: i.itemType };
    return {
      ...commun,
      type: 'ad',
      linkTitle: d.linkTitle,
      bodyText: d.bodyText,
      isActive: d.isActive,
      goneFromMeta: d.goneFromMeta,
      snapshotUrl: d.snapshotUrl,
      annonceurNom: d.advertiser?.name ?? 'Annonceur retiré',
      annonceurSlug: d.advertiser?.slug ?? '',
      annonceurSite: d.advertiser?.websiteUrl ?? null,
    };
  });
}

export async function collectionsDe(userId: string): Promise<{
  collections: CollectionRemplie[];
  total: number;
}> {
  const [collections, items] = await Promise.all([
    db.collection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, createdAt: true },
    }),
    db.savedItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, itemType: true, itemId: true, note: true, createdAt: true, collectionId: true },
    }),
  ]);

  const hydrates = await hydrater(items);
  const parId = new Map(items.map((i, index) => [i.id, { collectionId: i.collectionId, index }]));

  const groupe = (collectionId: string | null) =>
    hydrates.filter((e) => parId.get(e.savedItemId)?.collectionId === collectionId);

  const remplies: CollectionRemplie[] = collections.map((c) => ({
    id: c.id,
    nom: c.name,
    creeeLe: c.createdAt,
    elements: groupe(c.id),
  }));

  // Les éléments sans collection ne sont pas cachés : on les met dans une
  // pseudo-collection en tête. Enregistrer sans ranger doit rester possible.
  const libres = groupe(null);
  if (libres.length > 0) {
    remplies.unshift({ id: null, nom: 'Sans collection', creeeLe: null, elements: libres });
  }

  return { collections: remplies, total: items.length };
}

export type AnnonceurSuivi = {
  advertiserId: string;
  slug: string;
  nom: string;
  site: string | null;
  categorie: string | null;
  signalScore: number;
  suiviDepuis: Date;
  annoncesActives: number;
  /** Annonces apparues depuis la mise sous surveillance. */
  nouvellesDepuis: number;
  derniereNouveaute: Date | null;
};

export async function suivisDe(userId: string): Promise<AnnonceurSuivi[]> {
  const suivis = await db.watch.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      advertiserId: true,
      createdAt: true,
      advertiser: {
        select: {
          slug: true,
          name: true,
          websiteUrl: true,
          signalScore: true,
          category: { select: { label: true } },
        },
      },
    },
  });

  if (suivis.length === 0) return [];

  // Le comptage se fait en une passe pour tous les suivis, groupé côté base.
  const actifs = await db.ad.groupBy({
    by: ['advertiserId'],
    where: { advertiserId: { in: suivis.map((s) => s.advertiserId) }, isActive: true },
    _count: { _all: true },
  });

  const parActifs = new Map(actifs.map((c) => [c.advertiserId, c._count._all]));

  // « Nouveau » se compte depuis la mise sous surveillance, annonceur par
  // annonceur : suivre quelqu'un hier ne doit pas afficher deux ans d'archive
  // comme des nouveautés.
  const nouvelles = await Promise.all(
    suivis.map(async (s) => {
      const [n, derniere] = await Promise.all([
        db.ad.count({ where: { advertiserId: s.advertiserId, firstSeenAt: { gt: s.createdAt } } }),
        db.ad.findFirst({
          where: { advertiserId: s.advertiserId, firstSeenAt: { gt: s.createdAt } },
          orderBy: { firstSeenAt: 'desc' },
          select: { firstSeenAt: true },
        }),
      ]);
      return { id: s.advertiserId, n, derniere: derniere?.firstSeenAt ?? null };
    }),
  );
  const parNouvelles = new Map(nouvelles.map((x) => [x.id, x]));

  return suivis.flatMap((s) => {
    if (!s.advertiser) return [];
    const nouveau = parNouvelles.get(s.advertiserId);
    return [
      {
        advertiserId: s.advertiserId,
        slug: s.advertiser.slug,
        nom: s.advertiser.name,
        site: s.advertiser.websiteUrl,
        categorie: s.advertiser.category?.label ?? null,
        signalScore: s.advertiser.signalScore,
        suiviDepuis: s.createdAt,
        annoncesActives: parActifs.get(s.advertiserId) ?? 0,
        nouvellesDepuis: nouveau?.n ?? 0,
        derniereNouveaute: nouveau?.derniere ?? null,
      },
    ];
  });
}

export async function recherchesDe(userId: string) {
  return db.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, filters: true, createdAt: true },
  });
}
