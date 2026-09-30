import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { preparerBaseTest, URL_TEST } from '@/test/base';

/**
 * Régression : une erreur de Stripe (prix inexistant dans le mode courant, clé
 * refusée, TVA non configurée, Stripe injoignable) faisait tomber la page sur
 * « Quelque chose s'est mal passé » — y compris juste après l'inscription.
 */

const etat = vi.hoisted(() => ({
  utilisateur: { id: '', email: 'x@exemple.invalid', role: 'user' },
  configure: true,
  prix: 'price_test' as string | null,
  creer: vi.fn(),
  portail: vi.fn(),
}));

vi.mock('@/server/auth', () => ({ requireUser: async () => etat.utilisateur }));
vi.mock('@/server/origine', () => ({ origine: async () => 'http://test' }));
vi.mock('@/server/stripe', () => ({
  paiementConfigure: () => etat.configure,
  stripeActif: () => etat.configure,
  prixStripe: () => etat.prix,
  stripe: () => ({ checkout: { sessions: { create: etat.creer } }, billingPortal: { sessions: { create: etat.portail } } }),
}));

const erreurStripe = (type: string, message: string, code?: string) => Object.assign(new Error(message), { type, code });

describe('messages d’erreur de paiement', () => {
  it('le visiteur ne lit jamais la cause technique', async () => {
    const { messagePaiement, MESSAGE_PAIEMENT_INDISPONIBLE } = await import('@/server/paiement-erreurs');
    const m = messagePaiement(erreurStripe('StripeInvalidRequestError', "No such price: 'price_secret_abc'", 'resource_missing'), false);
    expect(m).toBe(MESSAGE_PAIEMENT_INDISPONIBLE);
    expect(m).not.toContain('price_secret_abc');
  });

  it('l’administrateur lit la cause probable, pour chaque famille d’erreur', async () => {
    const { causeProbable } = await import('@/server/paiement-erreurs');
    expect(causeProbable(erreurStripe('StripeInvalidRequestError', 'No such price', 'resource_missing'))).toContain('mode de Stripe');
    expect(causeProbable(erreurStripe('StripeAuthenticationError', 'Invalid API Key provided'))).toContain('clé secrète');
    expect(causeProbable(erreurStripe('StripeInvalidRequestError', 'You must have a valid head office address to enable automatic tax calculation'))).toContain('TVA');
    expect(causeProbable(erreurStripe('StripeInvalidRequestError', 'No configuration provided and your test mode default configuration has not been created'))).toContain('portail');
    expect(causeProbable(erreurStripe('StripeConnectionError', 'socket hang up'))).toContain('injoignable');
    expect(causeProbable(new Error('autre chose'))).toBe('Erreur Stripe inattendue');
  });
});

describe.skipIf(!URL_TEST)('actions de paiement', () => {
  let db: typeof import('@/server/db').db;
  let choisirOffre: typeof import('@/server/actions/paiement').choisirOffre;
  let recharger: typeof import('@/server/actions/paiement').recharger;
  let ouvrirPortail: typeof import('@/server/actions/paiement').ouvrirPortail;

  beforeAll(async () => {
    preparerBaseTest();
    ({ db } = await import('@/server/db'));
    ({ choisirOffre, recharger, ouvrirPortail } = await import('@/server/actions/paiement'));
  });

  afterEach(() => {
    etat.configure = true;
    etat.prix = 'price_test';
    etat.utilisateur.role = 'user';
    etat.creer.mockReset();
    etat.portail.mockReset();
    vi.restoreAllMocks();
  });

  async function nouvelUtilisateur(abonne = false) {
    const u = await db.user.create({ data: { email: `pay-${Math.random().toString(36).slice(2)}@exemple.invalid` } });
    etat.utilisateur = { id: u.id, email: u.email, role: 'user' };
    if (abonne) {
      const pro = await db.plan.findUniqueOrThrow({ where: { slug: 'pro' } });
      await db.subscription.create({
        data: { userId: u.id, planId: pro.id, status: 'active', priceCents: pro.monthlyPriceCents, stripeCustomerId: `cus_${Math.random().toString(36).slice(2)}`, currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
      });
    }
    return u;
  }

  it('prix inexistant dans le mode courant : un message, pas une exception', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await nouvelUtilisateur();
    etat.creer.mockRejectedValue(erreurStripe('StripeInvalidRequestError', "No such price: 'price_test'", 'resource_missing'));
    const r = await choisirOffre('pro', 'mensuel');
    expect(r.erreur).toContain('momentanément indisponible');
    expect(r.erreur).not.toContain('price_test');
    expect(r.erreur).not.toContain('administrateurs');
  });

  it('l’administrateur voit la cause et le lien de contrôle', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await nouvelUtilisateur();
    etat.utilisateur.role = 'admin';
    etat.creer.mockRejectedValue(erreurStripe('StripeInvalidRequestError', "No such price: 'price_test'", 'resource_missing'));
    const r = await choisirOffre('pro', 'annuel');
    expect(r.erreur).toContain('administrateurs');
    expect(r.erreur).toContain('mode de Stripe');
    expect(r.erreur).toContain('/api/sante?stripe=1');
  });

  it('clé refusée, TVA non configurée, Stripe injoignable : toujours un message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await nouvelUtilisateur();
    for (const e of [
      erreurStripe('StripeAuthenticationError', 'Invalid API Key provided: sk_live_****'),
      erreurStripe('StripeInvalidRequestError', 'automatic tax calculation needs a head office address'),
      erreurStripe('StripeConnectionError', 'An error occurred with our connection to Stripe'),
      new Error('quelque chose d’imprévu'),
    ]) {
      etat.creer.mockRejectedValueOnce(e);
      const r = await choisirOffre('createur', 'mensuel');
      expect(r.erreur).toContain('momentanément indisponible');
    }
  });

  it('la redirection vers Stripe traverse la protection (elle n’est pas avalée)', async () => {
    await nouvelUtilisateur();
    etat.creer.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_x' });
    const e = await choisirOffre('pro', 'mensuel').catch((x) => x);
    expect(String((e as { digest?: string }).digest ?? e)).toContain('NEXT_REDIRECT');
    expect(String((e as { digest?: string }).digest)).toContain('checkout.stripe.com');
  });

  it('webhook ou clé absents : aucun paiement n’est démarré (pas d’argent encaissé sans crédits)', async () => {
    await nouvelUtilisateur();
    etat.configure = false;
    const r = await choisirOffre('pro', 'mensuel');
    expect(r.erreur).toContain('pas encore configuré');
    expect(etat.creer).not.toHaveBeenCalled();
  });

  it('identifiant de prix absent : message clair', async () => {
    await nouvelUtilisateur();
    etat.prix = null;
    const r = await choisirOffre('pro', 'mensuel');
    expect(r.erreur).toContain('identifiant de prix Stripe');
  });

  it('recharge : une erreur de Stripe devient un message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await nouvelUtilisateur(true);
    etat.creer.mockRejectedValue(erreurStripe('StripeAPIError', 'Invalid JSON received from the Stripe API'));
    const fd = new FormData();
    fd.set('quantite', '20');
    const r = await recharger({}, fd);
    expect(r.erreur).toContain('momentanément indisponible');
  });

  it('portail client : une erreur de Stripe devient un message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await nouvelUtilisateur(true);
    etat.portail.mockRejectedValue(erreurStripe('StripeInvalidRequestError', 'No configuration provided for the customer portal'));
    const r = await ouvrirPortail();
    expect(r.erreur).toContain('momentanément indisponible');
  });
});
