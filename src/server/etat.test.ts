import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Diagnostic de la base : une base créée mais VIDE (offres et réglages
 * absents) doit être annoncée, pas provoquer une exception sur chaque page
 * sauf l'accueil.
 */
const base = vi.hoisted(() => ({
  tables: ['Project', 'Plan', 'PricingConfig'] as string[],
  comptes: { plans: 4n, bareme: 1n },
  erreur: null as Error | null,
}));

vi.mock('@/server/db', () => ({
  db: {
    $queryRawUnsafe: async () => {
      if (base.erreur) throw base.erreur;
      return base.tables.map((tablename) => ({ tablename }));
    },
    $queryRaw: async () => [base.comptes],
  },
}));

describe('etatBase', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://x:x@127.0.0.1:5432/x';
    base.tables = ['Project', 'Plan', 'PricingConfig'];
    base.comptes = { plans: 4n, bareme: 1n };
    base.erreur = null;
  });

  it('prête quand le schéma ET les référentiels sont là', async () => {
    const { etatBase } = await import('@/server/etat');
    expect(await etatBase()).toEqual({ pret: true });
  });

  it('base créée mais sans offres : annoncée, avec la manœuvre pour l’administrateur', async () => {
    base.comptes = { plans: 0n, bareme: 0n };
    const { etatBase } = await import('@/server/etat');
    const e = await etatBase();
    expect(e.pret).toBe(false);
    if (e.pret) return;
    expect(e.titre).toContain('vide');
    expect(e.aFaire.join(' ')).toContain('/reparation');
  });

  it('réglages chiffrés absents alors que les offres existent : annoncé aussi', async () => {
    base.comptes = { plans: 4n, bareme: 0n };
    const { etatBase } = await import('@/server/etat');
    expect((await etatBase()).pret).toBe(false);
  });

  it('schéma absent : le message existant est conservé', async () => {
    base.tables = [];
    const { etatBase } = await import('@/server/etat');
    const e = await etatBase();
    expect(e.pret).toBe(false);
    if (!e.pret) expect(e.titre).toBe('La base est vide');
  });

  it('base injoignable : message clair, jamais d’exception', async () => {
    base.erreur = new Error("Can't reach database server at `x:5432`");
    const { etatBase } = await import('@/server/etat');
    const e = await etatBase();
    expect(e.pret).toBe(false);
    if (!e.pret) expect(e.titre).toBe('La base ne répond pas');
  });
});
