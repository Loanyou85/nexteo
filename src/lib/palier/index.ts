/**
 * Paliers de rareté (section 4.1).
 *
 * L'état d'un projet est affiché comme une rareté : gris, vert, bleu, violet,
 * or. Tout joueur lit instantanément ce que veut dire passer de l'un à
 * l'autre. Le palier est CALCULÉ à partir de faits vérifiés — jamais posé à la
 * main, jamais avancé par optimisme. Chaque palier exige le précédent : un jeu
 * dont un test passe mais qui ne compile plus redescend au gris.
 */

export type Palier = 1 | 2 | 3 | 4 | 5;

export const PALIERS: Record<
  Palier,
  { cle: string; libelle: string; sens: string; couleur: string; classeTexte: string; classeFond: string }
> = {
  1: {
    cle: 'brouillon',
    libelle: 'Brouillon',
    sens: 'Le plan de jeu existe, rien n’est construit.',
    couleur: '#9AA3BD',
    classeTexte: 'text-tier-1',
    classeFond: 'bg-tier-1',
  },
  2: {
    cle: 'compile',
    libelle: 'Compilé',
    sens: 'Le Verse compile sans erreur.',
    couleur: '#3DD68C',
    classeTexte: 'text-tier-2',
    classeFond: 'bg-tier-2',
  },
  3: {
    cle: 'teste',
    libelle: 'Testé',
    sens: 'Un playtest s’est lancé et a produit des logs.',
    couleur: '#2B7BFF',
    classeTexte: 'text-tier-3',
    classeFond: 'bg-tier-3',
  },
  4: {
    cle: 'valide',
    libelle: 'Validé',
    sens: 'Tous les tests bloquants du plan de jeu passent.',
    couleur: '#A855F7',
    classeTexte: 'text-tier-4',
    classeFond: 'bg-tier-4',
  },
  5: {
    cle: 'pret',
    libelle: 'Prêt',
    sens: 'La vérification de pré-publication est au vert.',
    couleur: '#FFB020',
    classeTexte: 'text-tier-5',
    classeFond: 'bg-tier-5',
  },
};

/** Les faits dont dépend le palier, relus depuis la base — jamais supposés. */
export type FaitsProjet = {
  /** Un GameSpec valide existe pour la version courante. */
  planExiste: boolean;
  /** La DERNIÈRE compilation de la version courante a réussi. */
  derniereCompilationReussie: boolean | null;
  /** Un playtest s'est lancé depuis cette compilation et a produit au moins un log. */
  playtestAvecLogs: boolean;
  /** Tests bloquants du dernier passage : total et réussis. */
  testsBloquants: { total: number; reussis: number };
  /** Dernière vérification de pré-publication, postérieure au dernier test. */
  prePublicationPrete: boolean | null;
};

export function calculerPalier(f: FaitsProjet): Palier {
  if (!f.planExiste) return 1;
  if (f.derniereCompilationReussie !== true) return 1;
  if (!f.playtestAvecLogs) return 2;
  // Zéro test bloquant ne vaut pas « tous passent » : un plan sans aucun test
  // n'a rien démontré, et le laisser monter au violet serait mentir.
  const { total, reussis } = f.testsBloquants;
  if (total === 0 || reussis < total) return 3;
  if (f.prePublicationPrete !== true) return 4;
  return 5;
}

export function estPalier(n: number): n is Palier {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}
