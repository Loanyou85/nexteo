/**
 * Calculs de tarifs. Tout en centimes entiers : un flottant pour de l'argent
 * finit toujours par afficher 32,499999 €.
 *
 * Aucune valeur ici n'est un prix : les prix viennent de la base. Ces
 * fonctions ne font que les combiner.
 */

/** Économie de l'annuel en pourcentage entier : (mensuel × 12 − annuel) / (mensuel × 12). */
export function economieAnnuellePct(mensuelCents: number, annuelCents: number): number {
  const douze = mensuelCents * 12;
  if (douze <= 0) return 0;
  return Math.round(((douze - annuelCents) * 100) / douze);
}

/** Nombre de mois offerts : 12 − annuel / mensuel. « 2 mois offerts » pour 10 mois payés. */
export function moisOfferts(mensuelCents: number, annuelCents: number): number {
  if (mensuelCents <= 0) return 0;
  return Math.round(12 - annuelCents / mensuelCents);
}

/** Prix mensuel équivalent d'un abonnement annuel, en centimes, arrondi au centime. */
export function mensuelEquivalentCents(annuelCents: number): number {
  return Math.round(annuelCents / 12);
}

/**
 * Prix d'un crédit dans une offre, arrondi au centime supérieur à partir du
 * demi-centime (124,5 → 125). Affiché discrètement : il rend la montée de
 * gamme rationnelle.
 */
export function prixCreditCents(prixCents: number, credits: number): number | null {
  if (credits <= 0) return null;
  return Math.round(prixCents / credits);
}

const FORMAT = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FORMAT_ENTIER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/**
 * « 32,50 € ». Les montants ronds perdent leurs décimales (« 39 € ») sauf si
 * `decimales` est forcé : un prix mensuel équivalent s'affiche toujours au
 * centime, sinon « 32,5 € » ressemble à une erreur.
 */
export function euros(cents: number, decimales: 'auto' | 'toujours' = 'auto'): string {
  const rond = cents % 100 === 0;
  const texte =
    rond && decimales === 'auto' ? FORMAT_ENTIER.format(cents / 100) : FORMAT.format(cents / 100);
  // Espace insécable avant le symbole, comme le veut la typographie française.
  return `${texte} €`;
}

/**
 * Économie réelle qu'aurait faite quelqu'un qui recharge au lieu de monter de
 * gamme : ce qu'il a payé en recharges, moins ce que lui auraient coûté les
 * mêmes crédits au prix unitaire de l'offre supérieure.
 */
export function economieMonteeDeGamme(args: {
  rechargesPayeesCents: number;
  creditsRecharges: number;
  prixCreditSuperieurCents: number;
}): number {
  const auPrixSuperieur = args.creditsRecharges * args.prixCreditSuperieurCents;
  return Math.max(0, args.rechargesPayeesCents - auPrixSuperieur);
}

/**
 * Validation d'administration d'un prix annuel : la remise ne dépasse jamais
 * le maximum configuré (lui-même plafonné à 20 % par une contrainte en base).
 */
export function validerPrixAnnuel(args: {
  mensuelCents: number;
  annuelCents: number | null;
  remiseMaxPct: number;
}): { ok: true } | { ok: false; erreur: string } {
  if (args.annuelCents === null) return { ok: true };
  if (!Number.isInteger(args.annuelCents) || args.annuelCents < 0) {
    return { ok: false, erreur: 'Le prix annuel doit être un montant positif, en centimes entiers.' };
  }
  // Comparaison en entiers : annuel × 100 ≥ mensuel × 12 × (100 − remise max).
  const plancher = args.mensuelCents * 12 * (100 - args.remiseMaxPct);
  if (args.annuelCents * 100 < plancher) {
    const remise = economieAnnuellePct(args.mensuelCents, args.annuelCents);
    return {
      ok: false,
      erreur: `Remise annuelle de ${remise} % refusée : le maximum est ${args.remiseMaxPct} %. L’abonné annuel consomme autant de crédits que le mensuel, chaque point de remise sort de la marge.`,
    };
  }
  return { ok: true };
}

/**
 * Recharge à la quantité libre : le crédit de l'offre de l'abonné, majoré.
 *
 * Le total est calculé en une fois, arrondi au centime supérieur — pas le
 * prix unitaire arrondi multiplié par la quantité, qui dériverait de
 * plusieurs centimes sur une grosse recharge. Le prix unitaire affiché est
 * indicatif.
 */
export function prixRechargeCents(args: {
  offreMensuelCents: number;
  offreCredits: number;
  quantite: number;
  majorationPct: number;
}): number {
  const { offreMensuelCents, offreCredits, quantite, majorationPct } = args;
  if (offreCredits <= 0 || !Number.isInteger(quantite) || quantite <= 0) {
    throw new Error('Recharge impossible sans offre payante ni quantité positive.');
  }
  return Math.ceil((quantite * offreMensuelCents * (100 + majorationPct)) / (100 * offreCredits));
}

export function prixCreditRechargeCents(offreMensuelCents: number, offreCredits: number, majorationPct: number): number | null {
  if (offreCredits <= 0) return null;
  return Math.round((offreMensuelCents * (100 + majorationPct)) / (100 * offreCredits));
}

/**
 * Marge brute mensuelle d'un abonné, TVA, frais Stripe et hébergement
 * déduits, pour une part de ses crédits consommée. Tout en centimes, les
 * taux en points de base (1 % = 100).
 */
export function margeBrute(a: {
  prixTtcCents: number;
  tvaBp: number;
  stripeBp: number;
  stripeFixeCents: number;
  hebergementCents: number;
  credits: number;
  consommationPct: number;
  coutParCreditCents: number;
}): { horsTaxeCents: number; margeCents: number; pct: number } {
  const horsTaxe = Math.round((a.prixTtcCents * 10_000) / (10_000 + a.tvaBp));
  const stripe = Math.round((a.prixTtcCents * a.stripeBp) / 10_000) + a.stripeFixeCents;
  const ia = Math.round((a.credits * a.consommationPct * a.coutParCreditCents) / 100);
  const marge = horsTaxe - stripe - a.hebergementCents - ia;
  return { horsTaxeCents: horsTaxe, margeCents: marge, pct: horsTaxe > 0 ? Math.round((marge * 100) / horsTaxe) : 0 };
}
