import { beforeAll, describe, expect, it, vi } from 'vitest';
import { preparerBaseTest, URL_TEST } from '@/test/base';

const garde = vi.hoisted(() => ({ admin: true, semisEnEchec: false }));

vi.mock('@/server/auth', () => ({
  requireAdmin: async () => {
    if (!garde.admin) throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/;307;' });
    return { id: 'a', role: 'admin' };
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

describe.skipIf(!URL_TEST)('semis et réparation', () => {
  let db: typeof import('@/server/db').db;
  let semer: typeof import('@/server/semis').semer;
  let reparerBase: typeof import('@/server/actions/reparation').reparerBase;

  beforeAll(async () => {
    process.env.ADMIN_EMAILS = 'patron@exemple.test, Autre@Exemple.test';
    preparerBaseTest();
    ({ db } = await import('@/server/db'));
    ({ semer } = await import('@/server/semis'));
    ({ reparerBase } = await import('@/server/actions/reparation'));
  });

  it('rejouable : la deuxième passe ne crée rien', async () => {
    await semer(db);
    expect(await semer(db)).toBe(0);
  });

  it('recrée ce qui manque… sans jamais écraser une valeur modifiée', async () => {
    const cle = 'STRIPE_FEE_FIXED_CENTS';
    const avant = await db.pricingConfig.findUniqueOrThrow({ where: { key: cle } });
    const bareme = await db.pricingConfig.findUniqueOrThrow({ where: { key: 'BAREME' } });
    try {
      await db.pricingConfig.update({ where: { key: cle }, data: { value: '99' } });
      await db.pricingConfig.delete({ where: { key: 'BAREME' } });
      const crees = await semer(db);
      expect(crees).toBeGreaterThanOrEqual(1);
      expect(await db.pricingConfig.count({ where: { key: 'BAREME' } })).toBe(1);
      // La valeur changée par l'administrateur reste celle de l'administrateur.
      expect((await db.pricingConfig.findUniqueOrThrow({ where: { key: cle } })).value).toBe('99');
    } finally {
      await db.pricingConfig.update({ where: { key: cle }, data: { value: avant.value } });
      await db.pricingConfig.upsert({ where: { key: 'BAREME' }, create: bareme, update: {} });
    }
  });

  it('le semis passe par la connexion DIRECTE, même si l’adresse poolée est fausse', async () => {
    const { execSync } = await import('node:child_process');
    const sortie = execSync('npx tsx prisma/seed.ts', {
      env: { ...process.env, DATABASE_URL: 'postgresql://faux:faux@127.0.0.1:1/inexistant', DIRECT_URL: URL_TEST! },
      encoding: 'utf8',
    });
    expect(sortie).toContain('Rien à créer');
  });

  it('la réparation rend un message, et refuse qui n’est pas administrateur', async () => {
    garde.admin = true;
    const r = await reparerBase();
    expect(r.ok).toBeTruthy();
    expect(r.erreur).toBeUndefined();

    garde.admin = false;
    await expect(reparerBase()).rejects.toThrow('NEXT_REDIRECT');
    garde.admin = true;
  });

  it('une adresse de ADMIN_EMAILS inscrite avant la variable est promue à la relecture', async () => {
    const { roleAJour } = await import('@/server/roles');
    const patron = await db.user.create({ data: { email: 'Patron@Exemple.test-' + Math.random().toString(36).slice(2) } });
    // L'adresse exacte de la variable, en casse différente.
    const exact = await db.user.create({ data: { email: 'patron@exemple.test' } }).catch(() => db.user.findUniqueOrThrow({ where: { email: 'patron@exemple.test' } }));
    expect(await roleAJour({ id: exact.id, role: 'user', email: exact.email })).toBe('admin');
    expect((await db.user.findUniqueOrThrow({ where: { id: exact.id } })).role).toBe('admin');

    // Un compte ordinaire reste ordinaire.
    expect(await roleAJour({ id: patron.id, role: 'user', email: patron.email })).toBe('user');
    expect((await db.user.findUniqueOrThrow({ where: { id: patron.id } })).role).toBe('user');
  });
});
