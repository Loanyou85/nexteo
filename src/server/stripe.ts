import 'server-only';
import Stripe from 'stripe';
import type { BillingInterval, Plan } from '@prisma/client';

/**
 * Accès Stripe. Sans clé, aucun paiement n'est proposé comme s'il allait
 * marcher : l'interface le dit, et rien n'est tenté.
 */

let client: Stripe | null = null;

export function stripeActif(): boolean {
  return !!process.env.STRIPE_SECRET_KEY?.trim();
}

export function stripe(): Stripe {
  const cle = process.env.STRIPE_SECRET_KEY?.trim();
  if (!cle) throw new Error('STRIPE_SECRET_KEY absente : paiement non configuré.');
  if (!client) client = new Stripe(cle);
  return client;
}

const VARIABLES: Record<string, { month: string; year: string }> = {
  createur: { month: 'STRIPE_CREATOR_MONTHLY', year: 'STRIPE_CREATOR_ANNUAL' },
  pro: { month: 'STRIPE_PRO_MONTHLY', year: 'STRIPE_PRO_ANNUAL' },
  studio: { month: 'STRIPE_STUDIO_MONTHLY', year: 'STRIPE_STUDIO_ANNUAL' },
};

/**
 * Identifiant de prix Stripe d'une offre. La base fait foi (il y est mis à
 * jour quand l'administration change un prix) ; à défaut, la variable
 * d'environnement de la section 7.1.
 */
export function prixStripe(plan: Pick<Plan, 'slug' | 'stripeMonthlyPriceId' | 'stripeAnnualPriceId'>, intervalle: BillingInterval): string | null {
  const enBase = intervalle === 'year' ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId;
  if (enBase) return enBase;
  const v = VARIABLES[plan.slug]?.[intervalle];
  return (v && process.env[v]?.trim()) || null;
}

export function nomsVariablesPrix(): string[] {
  return Object.values(VARIABLES).flatMap((v) => [v.month, v.year]);
}
