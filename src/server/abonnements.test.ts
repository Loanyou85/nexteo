import { beforeAll, describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { preparerBaseTest, URL_TEST } from '@/test/base';

/**
 * Tests 7 et 8 du cahier des offres, contre une vraie base. Les événements
 * sont signés comme Stripe les signe ; aucun appel réseau n'est fait.
 */
describe.skipIf(!URL_TEST)('abonnements et webhooks', () => {
  const SECRET = 'whsec_test_nexteo';
  let db: typeof import('@/server/db').db;
  let POST: typeof import('@/app/api/webhooks/stripe/route').POST;
  let verserMensualitesAnnuelles: typeof import('@/server/abonnements').verserMensualitesAnnuelles;
  let solde: typeof import('@/server/credits').solde;
  const signeur = new Stripe('sk_test_fictif');

  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fictif';
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    process.env.STRIPE_PRO_MONTHLY = 'price_pro_mensuel';
    process.env.STRIPE_PRO_ANNUAL = 'price_pro_annuel';
    preparerBaseTest();
    ({ db } = await import('@/server/db'));
    ({ POST } = await import('@/app/api/webhooks/stripe/route'));
    ({ verserMensualitesAnnuelles } = await import('@/server/abonnements'));
    ({ solde } = await import('@/server/credits'));
  });

  function requete(ev: object) {
    const corps = JSON.stringify(ev);
    const signature = signeur.webhooks.generateTestHeaderString({ payload: corps, secret: SECRET });
    return new Request('http://test/api/webhooks/stripe', { method: 'POST', body: corps, headers: { 'stripe-signature': signature } });
  }

  async function utilisateur() {
    return db.user.create({ data: { email: `w-${Math.random().toString(36).slice(2)}@exemple.invalid` } });
  }

  it('refuse un événement mal signé', async () => {
    const r = await POST(new Request('http://test', { method: 'POST', body: '{}', headers: { 'stripe-signature': 't=1,v1=faux' } }));
    expect(r.status).toBe(400);
  });

  it('test 7 — une recharge reçue deux fois ne crédite qu’une fois', async () => {
    const u = await utilisateur();
    const ev = {
      id: `evt_${Math.random().toString(36).slice(2)}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: `cs_${Math.random().toString(36).slice(2)}`, object: 'checkout.session', mode: 'payment', client_reference_id: u.id, customer: null, metadata: { type: 'recharge', credits: '20', userId: u.id } } },
    };
    expect((await POST(requete(ev))).status).toBe(200);
    expect((await POST(requete(ev))).status).toBe(200);
    expect((await solde(u.id)).total).toBe(20);

    // Même session rejouée sous un AUTRE identifiant d'événement : la clé du
    // registre (la session de paiement) bloque quand même le doublon.
    expect((await POST(requete({ ...ev, id: `${ev.id}_bis` }))).status).toBe(200);
    expect((await solde(u.id)).total).toBe(20);
  });

  it('test 7 — une facture payée reçue deux fois ne verse les crédits du mois qu’une fois', async () => {
    const u = await utilisateur();
    const pro = await db.plan.findUniqueOrThrow({ where: { slug: 'pro' } });
    const subId = `sub_${Math.random().toString(36).slice(2)}`;
    await db.subscription.create({ data: { userId: u.id, planId: pro.id, interval: 'month', status: 'active', priceCents: pro.monthlyPriceCents, stripeSubscriptionId: subId } });
    const debut = Math.floor(Date.now() / 1000);
    const ev = {
      id: `evt_${Math.random().toString(36).slice(2)}`,
      object: 'event',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_1',
          object: 'invoice',
          billing_reason: 'subscription_create',
          parent: { type: 'subscription_details', subscription_details: { subscription: subId } },
          lines: { data: [{ period: { start: debut, end: debut + 30 * 86400 }, pricing: { type: 'price_details', price_details: { price: 'price_pro_mensuel' } } }] },
        },
      },
    };
    await POST(requete(ev));
    await POST(requete(ev));
    expect((await solde(u.id)).total).toBe(75);
  });

  it('test 8 — le versement mensuel de l’annuel relancé deux fois le même jour ne verse qu’une fois', async () => {
    const u = await utilisateur();
    const pro = await db.plan.findUniqueOrThrow({ where: { slug: 'pro' } });
    const maintenant = new Date();
    await db.subscription.create({
      data: {
        userId: u.id,
        planId: pro.id,
        interval: 'year',
        status: 'active',
        priceCents: pro.annualPriceCents!,
        currentPeriodStart: new Date(maintenant.getTime() - 40 * 86_400_000),
        currentPeriodEnd: new Date(maintenant.getTime() + 300 * 86_400_000),
        nextCreditGrantAt: new Date(maintenant.getTime() - 3_600_000),
      },
    });
    await verserMensualitesAnnuelles(maintenant);
    await verserMensualitesAnnuelles(maintenant);
    expect((await solde(u.id)).total).toBe(75);
    const s = await db.subscription.findUniqueOrThrow({ where: { userId: u.id } });
    expect(s.nextCreditGrantAt!.getTime()).toBeGreaterThan(maintenant.getTime());
  });

  it('le registre refuse toute modification, même par un accès direct à la base', async () => {
    const u = await utilisateur();
    await db.creditLedger.create({ data: { userId: u.id, delta: 5, bucket: 'topup', reason: 'adjust', note: 'test' } });
    await expect(db.creditLedger.updateMany({ where: { userId: u.id }, data: { delta: 500 } })).rejects.toThrow(/ajout seul/);
    await expect(db.creditLedger.deleteMany({ where: { userId: u.id } })).rejects.toThrow(/ajout seul/);
  });
});
