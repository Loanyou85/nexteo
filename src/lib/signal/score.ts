/**
 * Le signal Nexteo (section 3 du prompt maître).
 *
 * Fonction pure : elle ne lit ni base ni horloge, tout entre par l'argument.
 * C'est ce qui la rend testable, et surtout reproductible — un score qu'on ne
 * peut pas rejouer à l'identique serait indéfendable.
 *
 * Ce que ce score mesure : une ACTIVITÉ PUBLICITAIRE OBSERVÉE. Rien d'autre.
 * Il ne dit pas qu'une entreprise gagne de l'argent, il dit depuis combien de
 * temps elle en dépense. C'est un fait vérifiable, et c'est la seule chose que
 * ce produit a le droit d'affirmer.
 */

export const COMPOSANTES = [
  'persistance',
  'continuite',
  'volumeActif',
  'rythmeTest',
  'etendue',
  'fraicheur',
] as const;

export type Composante = (typeof COMPOSANTES)[number];

/** Poids d'usine. Les vrais viennent de la table SignalWeight. */
export const POIDS_PAR_DEFAUT: Record<Composante, number> = {
  persistance: 35,
  continuite: 20,
  volumeActif: 15,
  rythmeTest: 15,
  etendue: 10,
  fraicheur: 5,
};

const JOUR_MS = 86_400_000;

/**
 * Seuils de saturation. Au-delà, la composante vaut 1 — on ne distingue plus.
 * Ils sont ici, nommés, plutôt que noyés dans les formules : c'est ce que
 * quelqu'un vient lire quand il conteste un score.
 */
export const SEUILS = {
  /** Un an de diffusion continue est le plafond. Au-delà, c'est déjà éprouvé. */
  persistanceJours: 365,
  /** Le rappel de continuité n'est crédible qu'au bout d'un mois d'observation. */
  observationMinimaleJours: 30,
  /** Vingt-cinq annonces simultanées : au-delà, l'écart ne veut plus dire grand-chose. */
  volumeActifPlafond: 25,
  /** Cinquante créations distinctes sur douze mois. */
  rythmeTestPlafond: 50,
  /** Dix pays et quatre plateformes couvrent la diffusion la plus large observée. */
  paysPlafond: 10,
  plateformesPlafond: 4,
  /** Au-delà de trois mois sans nouvelle création, la fraîcheur est nulle. */
  fraicheurJours: 90,
} as const;

export type AnnonceObservee = {
  deliveryStartTime: Date;
  deliveryStopTime: Date | null;
  isActive: boolean;
  reachedCountries: string[];
  publisherPlatforms: string[];
  /** Sommes de contrôle des visuels : deux annonces au même visuel ne comptent qu'une création. */
  checksums: string[];
  /** Première fois que Nexteo a vu cette annonce. */
  firstSeenAt: Date;
};

export type Couverture = {
  /** Jours, dans la fenêtre observée, où au moins une annonce était active. */
  joursCouverts: number;
  /** Jours pendant lesquels Nexteo a effectivement observé cet annonceur. */
  joursObserves: number;
};

export type EntreeSignal = {
  annonces: AnnonceObservee[];
  couverture: Couverture;
  maintenant: Date;
};

export type DetailComposante = {
  cle: Composante;
  libelle: string;
  poids: number;
  /** Valeur brute mesurée, telle qu'on la montre à l'utilisateur. */
  valeur: number;
  /** Même valeur ramenée entre 0 et 1. */
  normalisee: number;
  /** Points effectivement apportés au score final. */
  points: number;
  /** Phrase affichée sur la fiche. Factuelle, jamais interprétative. */
  explication: string;
};

export type Bande = 'test' | 'validation' | 'installe' | 'eprouve';

export type Signal = {
  score: number;
  bande: Bande;
  libelleBande: string;
  detail: DetailComposante[];
};

const LIBELLES: Record<Composante, string> = {
  persistance: 'Persistance',
  continuite: 'Continuité',
  volumeActif: 'Volume actif',
  rythmeTest: 'Rythme de test',
  etendue: 'Étendue',
  fraicheur: 'Fraîcheur',
};

/**
 * Bandes de lecture. Elles décrivent une activité publicitaire, jamais une
 * santé financière — d'où « modèle éprouvé » et non « entreprise rentable ».
 */
export const BANDES: { min: number; bande: Bande; libelle: string }[] = [
  { min: 85, bande: 'eprouve', libelle: 'Modèle éprouvé' },
  { min: 60, bande: 'installe', libelle: 'Modèle installé' },
  { min: 30, bande: 'validation', libelle: 'En cours de validation' },
  { min: 0, bande: 'test', libelle: 'Test' },
];

export function bandePour(score: number): { bande: Bande; libelle: string } {
  const trouvee = BANDES.find((b) => score >= b.min) ?? BANDES[BANDES.length - 1];
  return { bande: trouvee.bande, libelle: trouvee.libelle };
}

const borne = (x: number) => Math.min(1, Math.max(0, x));

/** Saturation douce : croissance rapide au début, plafond atteint à `plafond`. */
function logarithmique(valeur: number, plafond: number): number {
  if (valeur <= 0) return 0;
  return borne(Math.log1p(valeur) / Math.log1p(plafond));
}

function jours(de: Date, a: Date): number {
  return Math.max(0, (a.getTime() - de.getTime()) / JOUR_MS);
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? 's' : ''}`;
}

/**
 * Durée de diffusion de la plus ancienne annonce ENCORE ACTIVE.
 *
 * Volontairement pas « la plus ancienne annonce tout court » : une campagne
 * arrêtée il y a six mois ne prouve rien sur aujourd'hui. C'est la diffusion
 * qui continue d'être payée qui porte le signal.
 */
function persistance(e: EntreeSignal) {
  const actives = e.annonces.filter((a) => a.isActive);
  if (actives.length === 0) {
    return { valeur: 0, normalisee: 0, explication: 'Aucune annonce en cours de diffusion.' };
  }
  const debutLePlusAncien = actives.reduce(
    (min, a) => (a.deliveryStartTime < min ? a.deliveryStartTime : min),
    actives[0].deliveryStartTime,
  );
  const j = Math.floor(jours(debutLePlusAncien, e.maintenant));
  const mois = Math.floor(j / 30);
  return {
    valeur: j,
    normalisee: borne(j / SEUILS.persistanceJours),
    explication:
      mois >= 1
        ? `La plus ancienne annonce encore diffusée a démarré il y a ${mois} mois.`
        : `La plus ancienne annonce encore diffusée a démarré il y a ${pluriel(j, 'jour')}.`,
  };
}

/**
 * Part des jours sans interruption sur la période observée.
 *
 * Le dénominateur est plancherisé à trente jours. Sans ce plancher, un
 * annonceur découvert hier afficherait une continuité parfaite sur un seul
 * jour d'observation — ce serait faux, et ce serait précisément le genre de
 * chiffre inventé que ce produit refuse.
 */
function continuite(e: EntreeSignal) {
  const { joursCouverts, joursObserves } = e.couverture;
  const denominateur = Math.max(joursObserves, SEUILS.observationMinimaleJours);
  const part = denominateur === 0 ? 0 : borne(joursCouverts / denominateur);
  const pourcent = Math.round(part * 100);

  if (joursObserves < SEUILS.observationMinimaleJours) {
    return {
      valeur: pourcent,
      normalisee: part,
      explication: `Observé depuis ${pluriel(joursObserves, 'jour')} seulement : la continuité ne peut pas encore être établie.`,
    };
  }
  return {
    valeur: pourcent,
    normalisee: part,
    explication: `Diffusion active ${joursCouverts} jours sur les ${joursObserves} observés, soit ${pourcent} %.`,
  };
}

function volumeActif(e: EntreeSignal) {
  const n = e.annonces.filter((a) => a.isActive).length;
  return {
    valeur: n,
    normalisee: logarithmique(n, SEUILS.volumeActifPlafond),
    explication:
      n === 0
        ? 'Aucune annonce active simultanément.'
        : `${pluriel(n, 'annonce')} diffusée${n > 1 ? 's' : ''} simultanément.`,
  };
}

/**
 * Créations distinctes produites sur douze mois.
 *
 * Distinctes au sens de la somme de contrôle du visuel : rediffuser le même
 * visuel sur dix annonces n'est pas dix tests, c'est un seul.
 */
function rythmeTest(e: EntreeSignal) {
  const limite = new Date(e.maintenant.getTime() - 365 * JOUR_MS);
  const vus = new Set<string>();
  for (const a of e.annonces) {
    if (a.firstSeenAt < limite && a.deliveryStartTime < limite) continue;
    for (const c of a.checksums) vus.add(c);
  }
  const n = vus.size;
  return {
    valeur: n,
    normalisee: logarithmique(n, SEUILS.rythmeTestPlafond),
    explication:
      n === 0
        ? 'Aucune création distincte relevée sur douze mois.'
        : `${pluriel(n, 'création')} distincte${n > 1 ? 's' : ''} sur les douze derniers mois.`,
  };
}

function etendue(e: EntreeSignal) {
  const pays = new Set<string>();
  const plateformes = new Set<string>();
  for (const a of e.annonces) {
    for (const p of a.reachedCountries) pays.add(p);
    for (const p of a.publisherPlatforms) plateformes.add(p);
  }
  const partPays = borne(pays.size / SEUILS.paysPlafond);
  const partPlateformes = borne(plateformes.size / SEUILS.plateformesPlafond);
  // Le pays pèse plus que la plateforme : ouvrir un marché coûte une
  // traduction et un budget, cocher une plateforme de plus coûte un clic.
  const normalisee = 0.6 * partPays + 0.4 * partPlateformes;
  return {
    valeur: pays.size,
    normalisee,
    explication: `${pays.size} pays et ${pluriel(plateformes.size, 'plateforme')} touchés.`,
  };
}

function fraicheur(e: EntreeSignal) {
  if (e.annonces.length === 0) {
    return { valeur: 0, normalisee: 0, explication: 'Aucune annonce relevée.' };
  }
  const derniere = e.annonces.reduce(
    (max, a) => (a.firstSeenAt > max ? a.firstSeenAt : max),
    e.annonces[0].firstSeenAt,
  );
  const j = Math.floor(jours(derniere, e.maintenant));
  return {
    valeur: j,
    normalisee: borne(1 - j / SEUILS.fraicheurJours),
    explication:
      j === 0
        ? 'Nouvelle création relevée aujourd’hui.'
        : `Dernière nouvelle création il y a ${pluriel(j, 'jour')}.`,
  };
}

const CALCULS: Record<
  Composante,
  (e: EntreeSignal) => { valeur: number; normalisee: number; explication: string }
> = {
  persistance,
  continuite,
  volumeActif,
  rythmeTest,
  etendue,
  fraicheur,
};

/**
 * Calcule le signal.
 *
 * `poids` vient de la base. Une clé absente retombe sur le poids d'usine, et
 * le total est ramené à 100 quelle que soit la somme des poids : régler un
 * poids depuis /admin ne doit pas déplacer silencieusement toute l'échelle.
 */
export function calculerSignal(
  entree: EntreeSignal,
  poids: Partial<Record<Composante, number>> = {},
): Signal {
  const effectifs = COMPOSANTES.map((cle) => ({
    cle,
    poids: Math.max(0, poids[cle] ?? POIDS_PAR_DEFAUT[cle]),
  }));
  const total = effectifs.reduce((s, p) => s + p.poids, 0);

  const detail: DetailComposante[] = effectifs.map(({ cle, poids: w }) => {
    const { valeur, normalisee, explication } = CALCULS[cle](entree);
    return {
      cle,
      libelle: LIBELLES[cle],
      poids: w,
      valeur,
      normalisee,
      points: total === 0 ? 0 : (w / total) * 100 * normalisee,
      explication,
    };
  });

  const brut = detail.reduce((s, d) => s + d.points, 0);
  const score = Math.round(borne(brut / 100) * 100);
  const { bande, libelle } = bandePour(score);

  return {
    score,
    bande,
    libelleBande: libelle,
    // Les points arrondis pour l'affichage, une fois le score établi : arrondir
    // avant la somme ferait que le détail ne retomberait pas sur le total.
    detail: detail.map((d) => ({ ...d, points: Math.round(d.points * 10) / 10 })),
  };
}
