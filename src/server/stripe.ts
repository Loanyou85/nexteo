import 'server-only';
import Stripe from 'stripe';
import type { Plan } from '@prisma/client';
import { OFFRES, type Periodicite } from '@/lib/plans';

/**
 * Stripe, côté serveur uniquement. Tout est optionnel : sans clé, le produit
 * fonctionne, l'écran des offres enregistre l'intention et le dit franchement.
 */
let client: Stripe | null = null;

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe | null {
  if (!stripeEnabled()) return null;
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-08-26.dahlia' });
  return client;
}

export type StripeMode = 'absent' | 'test' | 'production';

/**
 * Mode réellement actif, déduit du préfixe de la clé secrète.
 *
 * C'est la seule source fiable : le tableau de bord se souvient du dernier
 * interrupteur utilisé, pas de ce qui tourne en production. Laisser une clé de
 * test en production est l'erreur la plus coûteuse du branchement — les vraies
 * cartes sont refusées, et les cartes de test ouvrent l'accès gratuitement.
 */
export function stripeMode(): StripeMode {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return 'absent';
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) return 'test';
  return 'production';
}

/**
 * Tarifs Stripe, par offre et par périodicité (section 9.3).
 *
 * Les noms de variables viennent du catalogue d'offres : ajouter une offre ne
 * demande pas de toucher à ce fichier.
 */
function envPour(plan: Plan, periodicite: Periodicite): string | null {
  const offre = OFFRES.find((o) => o.plan === plan);
  if (!offre) return null;
  return periodicite === 'annuel' ? offre.envAnnuel : offre.envMensuel;
}

/** Identifiant de tarif Stripe correspondant à une offre. */
export function priceIdFor(plan: Plan, periodicite: Periodicite = 'mensuel'): string | null {
  const nom = envPour(plan, periodicite);
  if (!nom) return null;
  const id = process.env[nom]?.trim();
  return id && id.length > 0 ? id : null;
}

/** Retrouve l'offre et la périodicité depuis un tarif, au retour du webhook. */
export function planForPriceId(
  priceId: string | null | undefined,
): { plan: Plan; periodicite: Periodicite } | null {
  if (!priceId) return null;
  for (const offre of OFFRES) {
    if (process.env[offre.envMensuel]?.trim() === priceId) {
      return { plan: offre.plan, periodicite: 'mensuel' };
    }
    if (process.env[offre.envAnnuel]?.trim() === priceId) {
      return { plan: offre.plan, periodicite: 'annuel' };
    }
  }
  return null;
}

/** Offres dont le tarif n'est pas configuré : /admin et /tarifs le disent. */
export function offresSansTarif(): { nom: string; manquantes: string[] }[] {
  return OFFRES.map((o) => ({
    nom: o.nom,
    manquantes: [o.envMensuel, o.envAnnuel].filter((v) => !process.env[v]?.trim()),
  })).filter((o) => o.manquantes.length > 0);
}
