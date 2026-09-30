'use server';

import { redirect } from 'next/navigation';
import type { BillingInterval } from '@prisma/client';
import { prixRechargeCents } from '@/lib/tarifs/calculs';
import { requireUser } from '@/server/auth';
import { configEntier } from '@/server/config';
import { db } from '@/server/db';
import { offreDe } from '@/server/offre';
import { origine } from '@/server/origine';
import { prixStripe, stripe, stripeActif } from '@/server/stripe';

/**
 * Paiements (sections 6 et 7.2 de l'offre). Stripe Checkout hébergé, TVA
 * automatique sur des prix TTC, adresse de facturation collectée.
 */

export type EtatPaiement = { erreur?: string };

const NON_CONFIGURE = 'Le paiement n’est pas encore configuré sur ce site : aucune transaction ne peut être faite. Rien ne t’a été facturé.';

/** Souscrire, ou changer d'offre pour un abonné. */
export async function choisirOffre(slug: string, periode: 'mensuel' | 'annuel'): Promise<EtatPaiement> {
  const user = await requireUser();
  const plan = await db.plan.findUnique({ where: { slug } });
  if (!plan || !plan.isActive || plan.monthlyPriceCents === 0) return { erreur: 'Offre introuvable.' };
  const intervalle: BillingInterval = periode === 'annuel' ? 'year' : 'month';
  if (intervalle === 'year' && plan.annualPriceCents === null) return { erreur: 'Cette offre n’a pas de facturation annuelle.' };
  if (!stripeActif()) return { erreur: NON_CONFIGURE };
  const prix = prixStripe(plan, intervalle);
  if (!prix) return { erreur: `L’identifiant de prix Stripe de ${plan.name} (${periode}) n’est pas configuré.` };

  const offre = await offreDe(user.id);
  const s = stripe();

  // Abonné : changement d'offre. Montée immédiate au prorata ; descente et
  // passage de l'annuel au mensuel à l'échéance (section 6).
  if (offre.actif && offre.abonnement?.stripeSubscriptionId) {
    const abo = await s.subscriptions.retrieve(offre.abonnement.stripeSubscriptionId);
    const item = abo.items.data[0];
    if (!item) return { erreur: 'Abonnement Stripe illisible.' };
    const montee =
      plan.monthlyCredits > offre.plan.monthlyCredits ||
      (plan.id === offre.plan.id && intervalle === 'year' && offre.abonnement.interval === 'month');
    await s.subscriptions.update(abo.id, {
      items: [{ id: item.id, price: prix }],
      proration_behavior: montee ? 'always_invoice' : 'none',
      metadata: { userId: user.id, plan: plan.slug, periode },
    });
    redirect('/dashboard?offre=modifiee');
  }

  const base = await origine();
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: prix, quantity: 1 }],
    client_reference_id: user.id,
    customer: offre.abonnement?.stripeCustomerId ?? undefined,
    customer_email: offre.abonnement?.stripeCustomerId ? undefined : (user.email ?? undefined),
    metadata: { userId: user.id, plan: plan.slug, periode },
    subscription_data: { metadata: { userId: user.id, plan: plan.slug, periode } },
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    success_url: `${base}/dashboard?paiement=ok`,
    cancel_url: `${base}/tarifs?periode=${periode}`,
  });
  if (!session.url) return { erreur: 'Stripe n’a pas renvoyé de page de paiement.' };
  redirect(session.url);
}

/** Recharge à la quantité libre (section 3.3, modifiée : +10 % sur le crédit de l'offre). */
export async function recharger(_e: EtatPaiement, formData: FormData): Promise<EtatPaiement> {
  const user = await requireUser();
  const quantite = Number(formData.get('quantite'));
  const [min, max, majoration] = await Promise.all([
    configEntier('TOPUP_MIN_CREDITS'),
    configEntier('TOPUP_MAX_CREDITS'),
    configEntier('TOPUP_MARKUP_PCT'),
  ]);
  if (!Number.isInteger(quantite) || quantite < min || quantite > max) {
    return { erreur: `Choisis entre ${min} et ${max} crédits.` };
  }

  const offre = await offreDe(user.id);
  if (!offre.actif || offre.plan.monthlyCredits <= 0) {
    return { erreur: 'Les recharges sont réservées aux abonnés d’une offre payante.' };
  }
  if (!stripeActif()) return { erreur: NON_CONFIGURE };

  const total = prixRechargeCents({
    offreMensuelCents: offre.plan.monthlyPriceCents,
    offreCredits: offre.plan.monthlyCredits,
    quantite,
    majorationPct: majoration,
  });

  const base = await origine();
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: total,
          tax_behavior: 'inclusive',
          product_data: { name: `Recharge de ${quantite} crédits Nexteo`, description: 'Crédits sans expiration.' },
        },
      },
    ],
    client_reference_id: user.id,
    customer: offre.abonnement?.stripeCustomerId ?? undefined,
    metadata: { userId: user.id, type: 'recharge', credits: String(quantite) },
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    success_url: `${base}/dashboard?recharge=ok`,
    cancel_url: `${base}/tarifs#recharge`,
  });
  if (!session.url) return { erreur: 'Stripe n’a pas renvoyé de page de paiement.' };
  redirect(session.url);
}

/** Portail client : résiliation en deux clics, factures, moyen de paiement. */
export async function ouvrirPortail(): Promise<EtatPaiement> {
  const user = await requireUser();
  const offre = await offreDe(user.id);
  if (!offre.abonnement?.stripeCustomerId) return { erreur: 'Aucun abonnement à gérer.' };
  if (!stripeActif()) return { erreur: NON_CONFIGURE };
  const session = await stripe().billingPortal.sessions.create({
    customer: offre.abonnement.stripeCustomerId,
    return_url: `${await origine()}/dashboard`,
  });
  redirect(session.url);
}
