import 'server-only';
import { db } from '@/server/db';
import { bandePour, type Bande, type DetailComposante } from '@/lib/signal/score';

/**
 * Tout ce qu'affiche une fiche annonceur, en une passe.
 *
 * La fiche ne recalcule rien : le signal et son détail sont lus tels qu'ils
 * ont été enregistrés par le pipeline. Ce qu'on montre est donc exactement ce
 * qui a produit le score, et deux visites d'affilée donnent le même chiffre.
 */

export type BandeChronologie = {
  id: string;
  titre: string;
  debut: Date;
  fin: Date | null;
  active: boolean;
  retiree: boolean;
  /** Position et largeur en pourcentage de la fenêtre observée. */
  gauche: number;
  largeur: number;
};

export type AnnonceFiche = {
  id: string;
  metaAdId: string;
  bodyText: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  landingDomain: string | null;
  snapshotUrl: string;
  deliveryStartTime: Date;
  deliveryStopTime: Date | null;
  isActive: boolean;
  goneFromMeta: boolean;
  reachedCountries: string[];
  publisherPlatforms: string[];
  jours: number;
};

export type FicheAnnonceur = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  categorie: string | null;
  categorieSlug: string | null;
  countryCode: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isDemo: boolean;
  signalScore: number;
  bande: Bande;
  libelleBande: string;
  detail: DetailComposante[];
  signalComputedAt: Date | null;
  mrr: {
    declareCents: number | null;
    declareSource: string | null;
    declareLe: Date | null;
    estimeBasCents: number | null;
    estimeHautCents: number | null;
    estimeMethode: string | null;
    estimeFiabilite: string | null;
  };
  actives: AnnonceFiche[];
  archivees: AnnonceFiche[];
  retirees: AnnonceFiche[];
  chronologie: { bandes: BandeChronologie[]; debut: Date; fin: Date };
  accroches: { texte: string; occurrences: number; premiereVue: Date }[];
  destinations: { domaine: string; annonces: number; premiereVue: Date; derniereVue: Date }[];
  pays: { code: string; annonces: number }[];
  plateformes: { code: string; annonces: number }[];
  proches: { slug: string; name: string; score: number; raisons: string[]; signalScore: number }[];
};

const JOUR_MS = 86_400_000;

/** Première ligne d'une accroche, c'est ce qu'un lecteur retient. */
function premiereLigne(texte: string): string {
  const ligne = texte.split(/\r?\n/).find((l) => l.trim().length > 0) ?? texte;
  return ligne.trim().slice(0, 180);
}

function joursEntre(debut: Date, fin: Date | null, maintenant: Date): number {
  return Math.max(0, Math.floor(((fin ?? maintenant).getTime() - debut.getTime()) / JOUR_MS));
}

export async function ficheAnnonceur(
  slug: string,
  maintenant = new Date(),
): Promise<FicheAnnonceur | null> {
  const a = await db.advertiser.findUnique({
    where: { slug },
    include: { category: { select: { label: true, slug: true } } },
  });

  // Une page exclue par un administrateur n'existe plus pour le public, et une
  // page fusionnée renvoie vers celle qui la remplace — traité par l'appelant.
  if (!a || a.excluded) return null;

  const annonces = await db.ad.findMany({
    where: { advertiserId: a.id },
    orderBy: { deliveryStartTime: 'desc' },
    select: {
      id: true,
      metaAdId: true,
      bodyText: true,
      linkTitle: true,
      linkDescription: true,
      landingDomain: true,
      snapshotUrl: true,
      deliveryStartTime: true,
      deliveryStopTime: true,
      isActive: true,
      goneFromMeta: true,
      reachedCountries: true,
      publisherPlatforms: true,
    },
  });

  const enrichies: AnnonceFiche[] = annonces.map((x) => ({
    ...x,
    jours: joursEntre(x.deliveryStartTime, x.deliveryStopTime, maintenant),
  }));

  // Fenêtre de la chronologie : de la plus ancienne diffusion à aujourd'hui.
  const debutFenetre = enrichies.reduce<Date>(
    (min, x) => (x.deliveryStartTime < min ? x.deliveryStartTime : min),
    enrichies[0]?.deliveryStartTime ?? maintenant,
  );
  const etendue = Math.max(JOUR_MS, maintenant.getTime() - debutFenetre.getTime());

  const bandes: BandeChronologie[] = enrichies.map((x) => {
    const debut = x.deliveryStartTime.getTime();
    const fin = (x.deliveryStopTime ?? maintenant).getTime();
    return {
      id: x.id,
      titre: x.linkTitle ?? premiereLigne(x.bodyText ?? 'Annonce'),
      debut: x.deliveryStartTime,
      fin: x.deliveryStopTime,
      active: x.isActive,
      retiree: x.goneFromMeta,
      gauche: ((debut - debutFenetre.getTime()) / etendue) * 100,
      // Un minimum de 0,4 % : une annonce d'un jour sur une fenêtre de deux
      // ans serait large de zéro pixel et disparaîtrait du graphique.
      largeur: Math.max(0.4, ((fin - debut) / etendue) * 100),
    };
  });

  // Accroches regroupées : lire la stratégie éditoriale d'un coup d'œil.
  const parAccroche = new Map<string, { occurrences: number; premiereVue: Date }>();
  for (const x of enrichies) {
    if (!x.bodyText) continue;
    const cle = premiereLigne(x.bodyText);
    const vu = parAccroche.get(cle);
    if (vu) {
      vu.occurrences += 1;
      if (x.deliveryStartTime < vu.premiereVue) vu.premiereVue = x.deliveryStartTime;
    } else {
      parAccroche.set(cle, { occurrences: 1, premiereVue: x.deliveryStartTime });
    }
  }

  const parDomaine = new Map<string, { annonces: number; premiereVue: Date; derniereVue: Date }>();
  for (const x of enrichies) {
    if (!x.landingDomain) continue;
    const vu = parDomaine.get(x.landingDomain);
    const fin = x.deliveryStopTime ?? maintenant;
    if (vu) {
      vu.annonces += 1;
      if (x.deliveryStartTime < vu.premiereVue) vu.premiereVue = x.deliveryStartTime;
      if (fin > vu.derniereVue) vu.derniereVue = fin;
    } else {
      parDomaine.set(x.landingDomain, {
        annonces: 1,
        premiereVue: x.deliveryStartTime,
        derniereVue: fin,
      });
    }
  }

  const compter = (valeurs: string[][]) => {
    const m = new Map<string, number>();
    for (const liste of valeurs) for (const v of liste) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()]
      .map(([code, annonces]) => ({ code, annonces }))
      .sort((x, y) => y.annonces - x.annonces);
  };

  const proches = await db.similarityEdge.findMany({
    where: { advertiserId: a.id, related: { excluded: false } },
    orderBy: { score: 'desc' },
    take: 6,
    include: { related: { select: { slug: true, name: true, signalScore: true } } },
  });

  const { bande, libelle } = bandePour(a.signalScore);
  const detail = ((a.signalBreakdown as { detail?: DetailComposante[] } | null)?.detail ?? []) as
    DetailComposante[];

  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    websiteUrl: a.websiteUrl,
    categorie: a.category?.label ?? null,
    categorieSlug: a.category?.slug ?? null,
    countryCode: a.countryCode,
    firstSeenAt: a.firstSeenAt,
    lastSeenAt: a.lastSeenAt,
    isDemo: a.isDemo,
    signalScore: a.signalScore,
    bande,
    libelleBande: libelle,
    detail,
    signalComputedAt: a.signalComputedAt,
    mrr: {
      declareCents: a.mrrDeclaredCents,
      declareSource: a.mrrDeclaredSource,
      declareLe: a.mrrDeclaredAt,
      estimeBasCents: a.mrrEstimatedLowCents,
      estimeHautCents: a.mrrEstimatedHighCents,
      estimeMethode: a.mrrEstimatedMethod,
      estimeFiabilite: a.mrrEstimatedTrust,
    },
    actives: enrichies.filter((x) => x.isActive),
    archivees: enrichies.filter((x) => !x.isActive && !x.goneFromMeta),
    retirees: enrichies.filter((x) => x.goneFromMeta),
    chronologie: { bandes, debut: debutFenetre, fin: maintenant },
    accroches: [...parAccroche.entries()]
      .map(([texte, v]) => ({ texte, ...v }))
      .sort((x, y) => y.occurrences - x.occurrences || +y.premiereVue - +x.premiereVue),
    destinations: [...parDomaine.entries()]
      .map(([domaine, v]) => ({ domaine, ...v }))
      .sort((x, y) => y.annonces - x.annonces),
    pays: compter(enrichies.map((x) => x.reachedCountries)),
    plateformes: compter(enrichies.map((x) => x.publisherPlatforms)),
    proches: proches.map((p) => ({
      slug: p.related.slug,
      name: p.related.name,
      signalScore: p.related.signalScore,
      score: p.score,
      raisons: ((p.reasons as { raisons?: string[] } | null)?.raisons ?? []) as string[],
    })),
  };
}

/** Fiche d'une annonce, avec le contexte minimal de son annonceur. */
export async function ficheAnnonce(id: string, maintenant = new Date()) {
  const annonce = await db.ad.findUnique({
    where: { id },
    include: {
      advertiser: { select: { slug: true, name: true, signalScore: true, isDemo: true } },
      creatives: { select: { type: true, storageKey: true, sourceUrl: true, width: true, height: true } },
    },
  });

  if (!annonce || annonce.advertiser === null) return null;

  return {
    ...annonce,
    jours: joursEntre(annonce.deliveryStartTime, annonce.deliveryStopTime, maintenant),
  };
}
