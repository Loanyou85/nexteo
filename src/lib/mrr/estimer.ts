/**
 * Estimation de revenu mensuel récurrent.
 *
 * Avertissement, et il fait partie du produit : **ce chiffre est une
 * estimation, pas une mesure.** Le revenu d'un SaaS privé n'est publié nulle
 * part ; ce qui suit est une chaîne d'hypothèses appliquée à la seule donnée
 * chiffrée que l'API Meta expose pour les annonces diffusées dans l'Union
 * européenne : `eu_total_reach`, le nombre de comptes touchés.
 *
 * Chaque maillon multiplie l'incertitude :
 *
 *   comptes touchés → impressions (× fréquence)
 *                   → budget dépensé (× coût pour mille)
 *                   → recettes (× retour sur dépense publicitaire)
 *                   → mensualisation
 *
 * Quatre hypothèses, chacune facilement fausse d'un facteur deux : l'écart
 * total peut atteindre un ordre de grandeur. C'est pourquoi la fonction rend
 * une FOURCHETTE et la méthode qui l'a produite, jamais un nombre seul. Toute
 * interface qui affiche cette valeur doit afficher les deux.
 *
 * Elle ne rend rien du tout quand la portée est absente : mieux vaut aucun
 * chiffre qu'un chiffre né d'une hypothèse sur une hypothèse.
 */

export type HypothesesMrr = {
  /** Impressions par compte touché, sur la durée de la campagne. */
  frequence: number;
  /** Coût pour mille impressions, en euros. */
  coutPourMille: number;
  /** Recettes générées par euro dépensé en publicité. */
  retourSurDepense: number;
  /** Part des recettes qui est récurrente plutôt que ponctuelle. */
  partRecurrente: number;
  /** Largeur de la fourchette, de part et d'autre du point central. */
  facteurIncertitude: number;
};

/**
 * Valeurs par défaut, volontairement prudentes et documentées.
 *
 * Elles viennent d'ordres de grandeur publics du marché publicitaire Meta en
 * Europe, pas d'une mesure propre à Nexteo. Elles sont modifiables parce
 * qu'elles sont discutables.
 */
export const HYPOTHESES: HypothesesMrr = {
  frequence: 1.8,
  coutPourMille: 9,
  retourSurDepense: 2.5,
  partRecurrente: 0.7,
  facteurIncertitude: 2.5,
};

export type EntreeMrr = {
  /** Somme des portées européennes des annonces actives. */
  porteeTotale: number | null;
  /** Durée de diffusion observée, en jours. Sert à mensualiser. */
  joursDiffusion: number;
};

export type EstimationMrr = {
  /** Borne basse, en centimes d'euro. */
  basCents: number;
  /** Borne haute, en centimes d'euro. */
  hautCents: number;
  /** Point central, en centimes. Affiché seulement avec sa fourchette. */
  centreCents: number;
  /** Phrase affichable qui décrit exactement le calcul fait. */
  methode: string;
  /** Faible, moyenne ou nulle. Jamais « élevée » : elle ne peut pas l'être. */
  fiabilite: 'nulle' | 'faible' | 'moyenne';
};

/** Séparateur décimal français : « 1,8 », pas « 1.8 ». */
const nb = (v: number) => v.toLocaleString('fr-FR');

/** Aucune portée exploitable : on ne rend rien, et c'est voulu. */
export function estimerMrr(
  entree: EntreeMrr,
  hypotheses: HypothesesMrr = HYPOTHESES,
): EstimationMrr | null {
  const { porteeTotale, joursDiffusion } = entree;
  if (!porteeTotale || porteeTotale <= 0) return null;
  if (joursDiffusion <= 0) return null;

  const impressions = porteeTotale * hypotheses.frequence;
  const depenseTotale = (impressions / 1000) * hypotheses.coutPourMille;
  const recettesTotales = depenseTotale * hypotheses.retourSurDepense;
  const recurrentes = recettesTotales * hypotheses.partRecurrente;

  // Mensualisation : les recettes cumulées ramenées à un mois de diffusion.
  const mois = Math.max(1, joursDiffusion / 30);
  const centre = recurrentes / mois;

  const k = hypotheses.facteurIncertitude;
  const enCents = (euros: number) => Math.max(0, Math.round(euros * 100));

  return {
    basCents: enCents(centre / k),
    hautCents: enCents(centre * k),
    centreCents: enCents(centre),
    methode:
      `Estimation à partir de ${Math.round(porteeTotale).toLocaleString('fr-FR')} comptes ` +
      `européens touchés (donnée Meta), convertis en impressions (× ${nb(hypotheses.frequence)}), ` +
      `en budget (${nb(hypotheses.coutPourMille)} € pour mille impressions), puis en recettes ` +
      `(× ${nb(hypotheses.retourSurDepense)}), dont ${Math.round(hypotheses.partRecurrente * 100)} % ` +
      `supposées récurrentes, ramenées à un mois de diffusion. Quatre hypothèses de marché, ` +
      `aucune mesure propre à l’entreprise.`,
    // Au-delà de trois mois d'observation la portée cumulée devient moins
    // volatile ; en deçà, un pic de diffusion fausse tout.
    fiabilite: joursDiffusion >= 90 ? 'moyenne' : 'faible',
  };
}

/** Formate un montant en centimes, sans jamais laisser croire à une précision. */
export function formaterMontant(cents: number): string {
  const euros = cents / 100;
  if (euros >= 1_000_000) return `${(euros / 1_000_000).toFixed(1).replace('.', ',')} M€`;
  if (euros >= 1_000) return `${Math.round(euros / 1_000)} k€`;
  return `${Math.round(euros)} €`;
}

/** Fourchette affichable. Le point central seul n'a pas de sens ici. */
export function formaterFourchette(e: EstimationMrr): string {
  return `${formaterMontant(e.basCents)} – ${formaterMontant(e.hautCents)}`;
}
