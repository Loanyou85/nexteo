import 'server-only';
import type Stripe from 'stripe';
import type { BillingInterval, SubscriptionStatus } from '@prisma/client';
import { ajouterMois } from '@/lib/credits/registre';
import { configEntier } from '@/server/config';
import { crediterRecharge, verserComplement, verserCreditsPeriode } from '@/server/credits';
import { db } from '@/server/db';
import { prixStripe } from '@/server/stripe';

/**
 * Traitement des événements Stripe (section 7.3 de l'offre).
 *
 * Deux protections contre le double versement, volontairement redondantes :
 * l'identifiant d'événement est enregistré (un événement déjà vu est
 * ignoré), ET chaque écriture de crédits porte une clé d'idempotence liée à
 * la période ou à la session de paiement. Si le traitement tombe entre les
 * deux, le rejeu de Stripe ne verse toujours rien de plus.
 */

const STATUTS: Record<string, SubscriptionStatus> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  unpaid: 'past_due',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  paused: 'past_due',
};

const date = (s: number) => new Date(s * 1000);

async function planDuPrix(priceId: string) {
  const plans = await db.plan.findMany({ where: { isActive: true } });
  for (const p of plans) {
    if (prixStripe(p, 'month') === priceId) return { plan: p, intervalle: 'month' as BillingInterval };
    if (prixStripe(p, 'year') === priceId) return { plan: p, intervalle: 'year' as BillingInterval };
  }
  return null;
}

function idPrix(p: string | Stripe.Price | null | undefined): string | null {
  if (!p) return null;
  return typeof p === 'string' ? p : p.id;
}

/** Point d'entrée : rend « deja_traite » pour un événement déjà vu. */
export async function traiterEvenement(ev: Stripe.Event): Promise<'traite' | 'deja_traite' | 'ignore'> {
  if (await db.stripeEvent.findUnique({ where: { id: ev.id } })) return 'deja_traite';

  let issue: 'traite' | 'ignore' = 'traite';
  switch (ev.type) {
    case 'checkout.session.completed':
      await paiementTermine(ev.data.object, ev.id);
      break;
    case 'invoice.paid':
      await facturePayee(ev.data.object, ev.id);
      break;
    case 'invoice.payment_failed':
      await paiementEchoue(ev.data.object);
      break;
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await abonnementModifie(ev.data.object, ev.id, ev.type === 'customer.subscription.deleted');
      break;
    default:
      issue = 'ignore';
  }

  // Enregistré APRÈS le traitement : un traitement interrompu sera rejoué
  // par Stripe, et les clés d'idempotence du registre empêchent tout doublon.
  await db.stripeEvent.upsert({ where: { id: ev.id }, create: { id: ev.id, type: ev.type }, update: {} });
  return issue;
}

async function paiementTermine(cs: Stripe.Checkout.Session, eventId: string) {
  const userId = cs.client_reference_id ?? cs.metadata?.userId;
  if (!userId) return;
  const client = typeof cs.customer === 'string' ? cs.customer : cs.customer?.id;

  if (cs.mode === 'payment' && cs.metadata?.type === 'recharge') {
    const credits = Number(cs.metadata.credits);
    if (!Number.isInteger(credits) || credits <= 0) return;
    // La clé est la session de paiement : une recharge ne crédite qu'une fois.
    await crediterRecharge({ userId, credits, cle: cs.id, stripeEventId: eventId });
    return;
  }

  if (cs.mode === 'subscription') {
    const subId = typeof cs.subscription === 'string' ? cs.subscription : cs.subscription?.id;
    const plan = cs.metadata?.plan ? await db.plan.findUnique({ where: { slug: cs.metadata.plan } }) : null;
    if (!subId || !plan) return;
    const intervalle: BillingInterval = cs.metadata?.periode === 'annuel' ? 'year' : 'month';
    // Le tarif est figé à la souscription : un changement de prix ultérieur
    // ne touche pas cet abonné.
    const prix = intervalle === 'year' ? (plan.annualPriceCents ?? plan.monthlyPriceCents * 12) : plan.monthlyPriceCents;
    await db.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: plan.id,
        interval: intervalle,
        status: 'active',
        priceCents: prix,
        stripePriceId: prixStripe(plan, intervalle),
        stripeCustomerId: client ?? null,
        stripeSubscriptionId: subId,
      },
      update: {
        planId: plan.id,
        interval: intervalle,
        status: 'active',
        priceCents: prix,
        stripePriceId: prixStripe(plan, intervalle),
        stripeCustomerId: client ?? undefined,
        stripeSubscriptionId: subId,
        pendingPlanId: null,
        pendingInterval: null,
      },
    });
    // Les crédits tombent avec la facture payée, pas ici.
  }
}

async function facturePayee(inv: Stripe.Invoice, eventId: string) {
  const subRef = inv.parent?.subscription_details?.subscription;
  const subId = typeof subRef === 'string' ? subRef : subRef?.id;
  if (!subId) return;
  const sub = await db.subscription.findUnique({ where: { stripeSubscriptionId: subId } });
  if (!sub) return;

  const ligne = inv.lines.data.find((l) => idPrix(l.pricing?.price_details?.price)) ?? inv.lines.data[0];
  if (!ligne) return;
  const priceId = idPrix(ligne.pricing?.price_details?.price);
  const trouve = priceId ? await planDuPrix(priceId) : null;

  // Descente programmée : elle s'applique au renouvellement, pas avant.
  const planId = sub.pendingPlanId && inv.billing_reason === 'subscription_cycle' ? sub.pendingPlanId : (trouve?.plan.id ?? sub.planId);
  const intervalle = (sub.pendingInterval && inv.billing_reason === 'subscription_cycle' ? sub.pendingInterval : trouve?.intervalle) ?? sub.interval;
  const plan = await db.plan.findUniqueOrThrow({ where: { id: planId } });

  const debut = date(ligne.period.start);
  const fin = date(ligne.period.end);
  // L'annuel est facturé une fois par an, mais crédité MOIS PAR MOIS : on
  // verse le premier mois ici, la tâche quotidienne versera les suivants.
  const finVersement = intervalle === 'year' ? ajouterMois(debut, 1) : fin;

  await db.subscription.update({
    where: { id: sub.id },
    data: {
      planId,
      interval: intervalle,
      status: 'active',
      currentPeriodStart: debut,
      currentPeriodEnd: fin,
      nextCreditGrantAt: intervalle === 'year' ? finVersement : null,
      pendingPlanId: inv.billing_reason === 'subscription_cycle' ? null : sub.pendingPlanId,
      pendingInterval: inv.billing_reason === 'subscription_cycle' ? null : sub.pendingInterval,
    },
  });

  await verserCreditsPeriode({
    userId: sub.userId,
    subscriptionId: sub.id,
    credits: plan.monthlyCredits,
    debut,
    fin: finVersement,
    moisReport: await configEntier('ROLLOVER_MONTHS'),
    stripeEventId: eventId,
  });
}

async function paiementEchoue(inv: Stripe.Invoice) {
  const subRef = inv.parent?.subscription_details?.subscription;
  const subId = typeof subRef === 'string' ? subRef : subRef?.id;
  if (!subId) return;
  // Builds suspendus (l'offre n'est plus active), projets conservés, rien effacé.
  await db.subscription.updateMany({ where: { stripeSubscriptionId: subId }, data: { status: 'past_due' } });
}

async function abonnementModifie(s: Stripe.Subscription, eventId: string, supprime: boolean) {
  const sub = await db.subscription.findUnique({ where: { stripeSubscriptionId: s.id }, include: { plan: true } });
  if (!sub) return;
  const item = s.items.data[0];

  if (supprime) {
    await db.subscription.update({ where: { id: sub.id }, data: { status: 'canceled', cancelAtPeriodEnd: false } });
    return;
  }

  const priceId = idPrix(item?.price);
  const trouve = priceId ? await planDuPrix(priceId) : null;
  const statut = STATUTS[s.status] ?? 'incomplete';
  const donnees = {
    status: statut,
    cancelAtPeriodEnd: s.cancel_at_period_end,
    ...(item ? { currentPeriodStart: date(item.current_period_start), currentPeriodEnd: date(item.current_period_end) } : {}),
  };

  if (!trouve || (trouve.plan.id === sub.planId && trouve.intervalle === sub.interval)) {
    await db.subscription.update({ where: { id: sub.id }, data: donnees });
    return;
  }

  // Changement d'offre. Montée : immédiate, et la différence de crédits est
  // versée tout de suite. Descente : programmée à l'échéance.
  const montee = trouve.plan.monthlyCredits > sub.plan.monthlyCredits || (trouve.plan.id === sub.planId && trouve.intervalle === 'year');
  if (montee) {
    await db.subscription.update({ where: { id: sub.id }, data: { ...donnees, planId: trouve.plan.id, interval: trouve.intervalle, pendingPlanId: null, pendingInterval: null } });
    const difference = trouve.plan.monthlyCredits - sub.plan.monthlyCredits;
    if (difference > 0 && item) {
      await verserComplement({
        userId: sub.userId,
        credits: difference,
        cle: `${sub.id}:${eventId}`,
        expiresAt: date(item.current_period_end),
        stripeEventId: eventId,
      });
    }
  } else {
    await db.subscription.update({ where: { id: sub.id }, data: { ...donnees, pendingPlanId: trouve.plan.id, pendingInterval: trouve.intervalle } });
  }
}

/**
 * Versement mensuel des abonnés annuels (section 7.4). Tâche quotidienne,
 * idempotente : relancée deux fois le même jour, elle ne verse qu'une fois —
 * la clé d'écriture est l'abonnement et le jour de début du mois versé.
 */
export async function verserMensualitesAnnuelles(maintenant = new Date()): Promise<number> {
  const dus = await db.subscription.findMany({
    where: { interval: 'year', status: 'active', nextCreditGrantAt: { lte: maintenant } },
    include: { plan: true },
  });
  const moisReport = await configEntier('ROLLOVER_MONTHS');
  let verses = 0;

  for (const s of dus) {
    let debut = s.nextCreditGrantAt!;
    // Rattrape les mois manqués si la tâche n'a pas tourné, sans dépasser l'échéance annuelle.
    while (debut <= maintenant && (!s.currentPeriodEnd || debut < s.currentPeriodEnd)) {
      const fin = ajouterMois(debut, 1);
      const r = await verserCreditsPeriode({ userId: s.userId, subscriptionId: s.id, credits: s.plan.monthlyCredits, debut, fin, moisReport });
      if (r.verse) verses++;
      debut = fin;
    }
    await db.subscription.update({ where: { id: s.id }, data: { nextCreditGrantAt: debut } });
  }
  return verses;
}
