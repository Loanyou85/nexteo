import type { Plan } from '@prisma/client';

/**
 * Les trois offres (section 9.3).
 *
 * Les prix vivent ici, les droits dans `DROITS` : changer un prix ne touche
 * pas au gating, ouvrir un droit ne demande pas de toucher aux écrans.
 *
 * Le gratuit n'est pas une quatrième carte. C'est ce que le visiteur a déjà —
 * recherche, liste, signal visible, trois fiches complètes par mois — et on le
 * lui rappelle sous les cartes plutôt que de lui donner un choix de plus au
 * moment de décider.
 */

export type Periodicite = 'mensuel' | 'annuel';

export interface Offre {
  plan: Exclude<Plan, 'free'>;
  nom: string;
  /** Prix mensuel, en euros. */
  mensuel: number;
  /** Prix annuel, en euros, payé en une fois. */
  annuel: number;
  promesse: string;
  /** Ce que l'offre ajoute par rapport à la précédente. */
  apports: string[];
  /** Une seule offre porte le badge. */
  enAvant?: boolean;
  /** Variables d'environnement des prix Stripe. */
  envMensuel: string;
  envAnnuel: string;
}

export const OFFRES: Offre[] = [
  {
    plan: 'pro',
    nom: 'Pro',
    mensuel: 19,
    annuel: 149,
    promesse: 'Pour explorer un premier segment.',
    apports: [
      'Recherche illimitée',
      'Fiches annonceurs complètes',
      'Annonces actives et accroches',
      'Filtres de base',
      '50 éléments enregistrés',
    ],
    envMensuel: 'STRIPE_PRO_MONTHLY',
    envAnnuel: 'STRIPE_PRO_ANNUAL',
  },
  {
    plan: 'pro_plus',
    nom: 'Pro Plus',
    mensuel: 39,
    annuel: 299,
    promesse: 'Pour chercher sérieusement.',
    apports: [
      "Tout Pro, plus l'archive historique complète",
      'Chronologie de diffusion',
      'Annonces supprimées par Meta',
      'Annonceurs proches',
      "Suivi d'annonceurs avec alertes",
      'Filtres avancés et recherches enregistrées',
      'Éléments illimités',
    ],
    enAvant: true,
    envMensuel: 'STRIPE_PRO_PLUS_MONTHLY',
    envAnnuel: 'STRIPE_PRO_PLUS_ANNUAL',
  },
  {
    plan: 'agency',
    nom: 'Agence',
    mensuel: 79,
    annuel: 599,
    promesse: 'Pour les équipes.',
    apports: [
      'Tout Pro Plus, plus les espaces de travail multiples',
      'Membres',
      'Exports CSV',
      'Accès API',
      'Quotas relevés',
      'Support prioritaire',
    ],
    envMensuel: 'STRIPE_AGENCY_MONTHLY',
    envAnnuel: 'STRIPE_AGENCY_ANNUAL',
  },
];

/** Fiches complètes offertes par mois, sans compte (section 9.1). */
export const FICHES_GRATUITES_PAR_MOIS = 3;

/**
 * Économie annuelle affichée, en pourcentage entier.
 *
 * Les trois remises sont volontairement alignées autour de 35 %. Une remise
 * de 65 % sur l'entrée de gamme détruirait le revenu mensuel récurrent et
 * signalerait un produit en difficulté.
 */
export function economieAnnuelle(offre: Pick<Offre, 'mensuel' | 'annuel'>): number {
  const surDouzeMois = offre.mensuel * 12;
  return Math.round(((surDouzeMois - offre.annuel) / surDouzeMois) * 100);
}

export function prix(offre: Offre, periodicite: Periodicite): number {
  return periodicite === 'annuel' ? offre.annuel : offre.mensuel;
}

/** Prix mensuel équivalent d'un abonnement annuel, pour comparer honnêtement. */
export function mensuelEquivalent(offre: Offre): number {
  return Math.round((offre.annuel / 12) * 100) / 100;
}

export function offrePour(plan: Plan): Offre | null {
  return OFFRES.find((o) => o.plan === plan) ?? null;
}

/** Droits par plan. Le gratuit est la base, chaque offre ajoute. */
export const DROITS = {
  free: {
    fichesParMois: FICHES_GRATUITES_PAR_MOIS,
    elementsEnregistres: 0,
    archiveHistorique: false,
    chronologie: false,
    annoncesRetirees: false,
    annonceursProches: false,
    suiviAnnonceurs: false,
    filtresAvances: false,
    recherchesEnregistrees: false,
    exportCsv: false,
    api: false,
  },
  pro: {
    fichesParMois: Infinity,
    elementsEnregistres: 50,
    archiveHistorique: false,
    chronologie: false,
    annoncesRetirees: false,
    annonceursProches: false,
    suiviAnnonceurs: false,
    filtresAvances: false,
    recherchesEnregistrees: false,
    exportCsv: false,
    api: false,
  },
  pro_plus: {
    fichesParMois: Infinity,
    elementsEnregistres: Infinity,
    archiveHistorique: true,
    chronologie: true,
    annoncesRetirees: true,
    annonceursProches: true,
    suiviAnnonceurs: true,
    filtresAvances: true,
    recherchesEnregistrees: true,
    exportCsv: false,
    api: false,
  },
  agency: {
    fichesParMois: Infinity,
    elementsEnregistres: Infinity,
    archiveHistorique: true,
    chronologie: true,
    annoncesRetirees: true,
    annonceursProches: true,
    suiviAnnonceurs: true,
    filtresAvances: true,
    recherchesEnregistrees: true,
    exportCsv: true,
    api: true,
  },
} as const satisfies Record<Plan, Record<string, number | boolean>>;

export type Droit = keyof (typeof DROITS)['free'];

export function aLeDroit(plan: Plan, droit: Droit): boolean {
  return Boolean(DROITS[plan][droit]);
}
