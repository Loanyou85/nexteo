import type Stripe from 'stripe';
import { traiterEvenement } from '@/server/abonnements';
import { stripe, stripeActif } from '@/server/stripe';

/**
 * Webhook Stripe (section 7.3). Signature vérifiée sur le corps BRUT : le
 * relire en JSON avant vérification la ferait échouer. Traitement idempotent.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripeActif() || !secret) return new Response('Paiement non configuré', { status: 503 });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Signature absente', { status: 400 });

  const corps = await req.text();
  let ev: Stripe.Event;
  try {
    ev = stripe().webhooks.constructEvent(corps, signature, secret);
  } catch {
    return new Response('Signature invalide', { status: 400 });
  }

  try {
    const r = await traiterEvenement(ev);
    return Response.json({ recu: true, issue: r });
  } catch (e) {
    console.error('[stripe] traitement en échec', ev.id, e);
    // 500 : Stripe rejouera l'événement, et le rejeu ne verse rien en double.
    return new Response('Erreur de traitement', { status: 500 });
  }
}
