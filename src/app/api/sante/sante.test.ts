import { beforeAll, describe, expect, it, vi } from 'vitest';
import { preparerBaseTest, URL_TEST } from '@/test/base';

const session = vi.hoisted(() => ({ courante: null as null | { user: { id: string; role: string } } }));
vi.mock('@/server/auth', () => ({ sessionOuNull: async () => session.courante }));

describe.skipIf(!URL_TEST)('/api/sante', () => {
  let GET: typeof import('@/app/api/sante/route').GET;
  const SECRET = 'valeur-secrete-qui-ne-doit-jamais-sortir-0123456789';

  beforeAll(async () => {
    preparerBaseTest();
    process.env.AUTH_SECRET = SECRET;
    process.env.CRON_SECRET = SECRET + '-cron';
    process.env.STRIPE_SECRET_KEY = 'sk_live_' + SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_' + SECRET;
    ({ GET } = await import('@/app/api/sante/route'));
  });

  it('public : seulement « le site et la base répondent », sans aucun détail', async () => {
    session.courante = null;
    const r = await GET(new Request('http://test/api/sante'));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, base: 'ok' });
  });

  it('un utilisateur ordinaire ne voit pas plus que le public', async () => {
    session.courante = { user: { id: 'u', role: 'user' } };
    const corps = await (await GET(new Request('http://test/api/sante'))).json();
    expect(corps.details).toBeUndefined();
  });

  it('administrateur : état de la configuration, sans jamais une valeur secrète', async () => {
    session.courante = { user: { id: 'a', role: 'admin' } };
    const r = await GET(new Request('http://test/api/sante'));
    const texte = await r.text();
    const corps = JSON.parse(texte);
    expect(corps.details.auth_secret).toBe('présent');
    expect(corps.details.cron_secret).toBe('présent');
    expect(corps.details.stripe.cle).toContain('RÉELLE');
    expect(corps.details.stripe.secret_webhook).toBe('présent');
    expect(corps.details.migrations_appliquees).toBeGreaterThanOrEqual(2);
    expect(texte).not.toContain(SECRET);
    expect(texte).not.toContain('sk_live_');
    expect(texte).not.toContain('whsec_');
  });

  it('signale une variable manquante en clair', async () => {
    session.courante = { user: { id: 'a', role: 'admin' } };
    const avant = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    const corps = await (await GET(new Request('http://test/api/sante'))).json();
    expect(corps.details.cron_secret).toBe('MANQUANT');
    process.env.CRON_SECRET = avant;
  });
});
