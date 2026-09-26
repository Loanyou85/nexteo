import { describe, expect, it } from 'vitest';
import { FixtureSource } from '../fixture';
import { MetaAdLibrarySource } from '../meta';
import { normaliser } from '../normaliser';
import { ErreurDebit } from '../types';

const MAINTENANT = new Date('2026-09-26T12:00:00Z');
const horloge = () => MAINTENANT;

function source() {
  return new FixtureSource(undefined, horloge);
}

describe('FixtureSource', () => {
  it('se déclare comme donnée de démonstration', () => {
    // C'est la source qui porte la déclaration, pas l'appelant : un oubli
    // publierait de la donnée inventée comme si elle était observée.
    expect(source().estDemo).toBe(true);
    expect(new MetaAdLibrarySource('jeton').estDemo).toBe(false);
  });

  it('ne rend que les annonces diffusées dans le pays demandé', async () => {
    const { annonces } = await source().recuperer({ pays: 'FR', terme: '', taille: 500 });
    expect(annonces.length).toBeGreaterThan(0);
    for (const a of annonces) expect(a.ad_reached_countries).toContain('FR');
  });

  it('filtre sur le terme sans se soucier des accents ni de la casse', async () => {
    const s = source();
    const accentue = await s.recuperer({ pays: 'FR', terme: 'créations', taille: 500 });
    const nu = await s.recuperer({ pays: 'FR', terme: 'CREATIONS', taille: 500 });
    expect(nu.annonces.map((a) => a.id)).toEqual(accentue.annonces.map((a) => a.id));
  });

  it('cherche aussi dans le nom de la page', async () => {
    const { annonces } = await source().recuperer({ pays: 'FR', terme: 'facturio', taille: 500 });
    expect(annonces.length).toBeGreaterThan(0);
    for (const a of annonces) expect(a.page_name).toBe('Facturio');
  });

  it('pagine et finit par rendre un curseur nul', async () => {
    const s = source();
    const vus = new Set<string>();
    let curseur: string | null = null;
    let tours = 0;

    do {
      const page: Awaited<ReturnType<typeof s.recuperer>> = await s.recuperer({
        pays: 'FR',
        terme: '',
        taille: 10,
        curseur,
      });
      for (const a of page.annonces) vus.add(a.id);
      curseur = page.curseurSuivant;
      tours += 1;
      expect(tours).toBeLessThan(200); // garde-fou anti-boucle infinie
    } while (curseur !== null);

    const tout = await s.recuperer({ pays: 'FR', terme: '', taille: 500 });
    expect(vus.size).toBe(tout.annonces.length);
  });

  it('matérialise des dates relatives à l’horloge injectée', async () => {
    const { annonces } = await source().recuperer({ pays: 'FR', terme: '', taille: 5 });
    for (const a of annonces) {
      const debut = new Date(a.ad_delivery_start_time);
      expect(debut.getTime()).toBeLessThanOrEqual(MAINTENANT.getTime());
      if (a.ad_delivery_stop_time) {
        expect(new Date(a.ad_delivery_stop_time).getTime()).toBeGreaterThanOrEqual(debut.getTime());
      }
    }
  });

  it('produit un jeu que le normaliseur accepte intégralement', async () => {
    const { annonces } = await source().recuperer({ pays: 'FR', terme: '', taille: 500 });
    for (const a of annonces) expect(() => normaliser(a, MAINTENANT)).not.toThrow();
  });

  it('contient à la fois des annonces actives et des annonces arrêtées', async () => {
    // Sans les deux, la continuité et la persistance ne seraient jamais
    // exercées par les tests du pipeline.
    const { annonces } = await source().recuperer({ pays: 'FR', terme: '', taille: 500 });
    const n = annonces.map((a) => normaliser(a, MAINTENANT));
    expect(n.some((a) => a.isActive)).toBe(true);
    expect(n.some((a) => !a.isActive)).toBe(true);
  });

  it('couvre un annonceur diffusant depuis plus d’un an', async () => {
    const { annonces } = await source().recuperer({ pays: 'FR', terme: '', taille: 500 });
    const plusAncienne = Math.max(
      ...annonces.map((a) => MAINTENANT.getTime() - new Date(a.ad_delivery_start_time).getTime()),
    );
    expect(plusAncienne / 86_400_000).toBeGreaterThan(365);
  });
});

describe('MetaAdLibrarySource', () => {
  const reponse = (corps: unknown, ok = true, status = 200) =>
    (async () => new Response(JSON.stringify(corps), { status: ok ? status : status })) as unknown as typeof fetch;

  it('refuse de partir sans jeton', async () => {
    await expect(
      new MetaAdLibrarySource('').recuperer({ pays: 'FR', terme: 'saas' }),
    ).rejects.toThrow(/META_ACCESS_TOKEN/);
  });

  it('refuse une requête sans pays : il n’existe pas de requête mondiale', async () => {
    await expect(
      new MetaAdLibrarySource('jeton').recuperer({ pays: '  ', terme: 'saas' }),
    ).rejects.toThrow(/obligatoire/);
  });

  it('transmet le pays et tronque le terme à cent caractères', async () => {
    let vue = '';
    const espion = (async (url: string | URL | Request) => {
      vue = String(url);
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    await new MetaAdLibrarySource('jeton', espion).recuperer({
      pays: 'be',
      terme: 'x'.repeat(250),
    });

    const params = new URL(vue).searchParams;
    expect(params.get('ad_reached_countries')).toBe('["BE"]');
    expect(params.get('search_terms')).toHaveLength(100);
    expect(params.get('ad_active_status')).toBe('ALL');
  });

  it('lève une erreur de débit sur le code 613', async () => {
    const s = new MetaAdLibrarySource(
      'jeton',
      reponse({ error: { code: 613, message: 'Calls to this api have exceeded the rate limit' } }, false, 400),
    );
    await expect(s.recuperer({ pays: 'FR', terme: 'saas' })).rejects.toBeInstanceOf(ErreurDebit);
  });

  it('lève une erreur de débit sur un 429', async () => {
    const s = new MetaAdLibrarySource('jeton', reponse({}, false, 429));
    await expect(s.recuperer({ pays: 'FR', terme: 'saas' })).rejects.toBeInstanceOf(ErreurDebit);
  });

  it('distingue un jeton invalide d’un dépassement de débit', async () => {
    const s = new MetaAdLibrarySource(
      'jeton',
      reponse({ error: { code: 190, message: 'Invalid OAuth access token' } }, false, 400),
    );
    const erreur = await s.recuperer({ pays: 'FR', terme: 'saas' }).catch((e) => e);
    expect(erreur).not.toBeInstanceOf(ErreurDebit);
    expect(String(erreur)).toContain('190');
  });

  it('écarte les entrées malformées au lieu de faire tomber l’exécution', async () => {
    const s = new MetaAdLibrarySource(
      'jeton',
      reponse({ data: [{ id: 'bon', page_id: 'p' }, null, 42, { page_id: 'sans id' }] }),
    );
    const { annonces } = await s.recuperer({ pays: 'FR', terme: 'saas' });
    expect(annonces.map((a) => a.id)).toEqual(['bon']);
  });

  it('s’arrête quand Meta n’annonce plus de page suivante', async () => {
    const sansSuite = new MetaAdLibrarySource(
      'jeton',
      // Meta peut renvoyer un curseur tout en étant au bout : se fier au seul
      // curseur ferait boucler indéfiniment.
      reponse({ data: [{ id: 'a', page_id: 'p' }], paging: { cursors: { after: 'ABC' } } }),
    );
    expect((await sansSuite.recuperer({ pays: 'FR', terme: 's' })).curseurSuivant).toBeNull();

    const avecSuite = new MetaAdLibrarySource(
      'jeton',
      reponse({
        data: [{ id: 'a', page_id: 'p' }],
        paging: { cursors: { after: 'ABC' }, next: 'https://graph.facebook.com/...' },
      }),
    );
    expect((await avecSuite.recuperer({ pays: 'FR', terme: 's' })).curseurSuivant).toBe('ABC');
  });
});
