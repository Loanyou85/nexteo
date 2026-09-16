'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Plan } from '@prisma/client';
import { db } from '@/server/db';
import { sessionOuNull } from '@/server/auth';
import { getStripe, priceIdFor, stripeEnabled } from '@/server/stripe';
import { absoluteUrl } from '@/lib/site';
import { offerFor } from '@/lib/offers';

/**
 * Choisir une offre.
 *
 * Tant que Stripe n'est pas branché, on enregistre l'intention et on le dit
 * franchement : aucun accès n'est ouvert, aucun montant n'est débité. Ouvrir
 * l'accès sans paiement reviendrait à simuler une vente.
 */
export async function choisirOffre(formData: FormData): Promise<void> {
  const plan = String(formData.get('plan') ?? '') as Plan;
  if (!offerFor(plan)) redirect('/offres');

  const session = await sessionOuNull();
  if (!session?.user?.id) redirect(`/connexion?suite=${encodeURIComponent('/offres')}`);
  const userId = session.user.id;

  await db.subscription.upsert({
    where: { userId },
    create: { userId, intendedPlan: plan, intendedAt: new Date() },
    update: { intendedPlan: plan, intendedAt: new Date() },
  });

  const stripe = getStripe();
  const priceId = priceIdFor(plan);
  if (!stripe || !priceId) {
    revalidatePath('/offres');
    redirect('/offres?paiement=indisponible');
  }

  const abonnement = await db.subscription.findUnique({ where: { userId } });
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: userId,
    // Le client est créé au premier paiement puis réutilisé, pour que
    // l'historique de facturation reste d'un seul tenant.
    customer: abonnement?.stripeCustomerId ?? undefined,
    customer_email: abonnement?.stripeCustomerId ? undefined : user.email,
    subscription_data: { metadata: { userId } },
    metadata: { userId, plan },
    allow_promotion_codes: true,
    success_url: absoluteUrl('/app?bienvenue=1'),
    cancel_url: absoluteUrl('/offres?retour=1'),
  });

  if (!checkout.url) redirect('/offres?paiement=indisponible');
  redirect(checkout.url);
}

/** Portail de facturation : changer de carte, voir ses factures, résilier. */
export async function ouvrirPortail(): Promise<void> {
  const session = await sessionOuNull();
  if (!session?.user?.id) redirect('/connexion');

  const stripe = getStripe();
  const abonnement = await db.subscription.findUnique({ where: { userId: session.user.id } });
  if (!stripe || !abonnement?.stripeCustomerId) redirect('/app/compte?portail=indisponible');

  const portail = await stripe.billingPortal.sessions.create({
    customer: abonnement.stripeCustomerId,
    return_url: absoluteUrl('/app/compte'),
  });
  redirect(portail.url);
}

export { stripeEnabled };
