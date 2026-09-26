import { describe, expect, it } from 'vitest';
import { normaliser, domaineDepuisCaption } from '../normaliser';
import { AnnonceInvalide, type AnnonceBrute } from '../types';

const MAINTENANT = new Date('2026-09-26T12:00:00Z');

function brute(p: Partial<AnnonceBrute> = {}): AnnonceBrute {
  return {
    id: 'a1',
    page_id: 'p1',
    page_name: 'Facturio',
    ad_snapshot_url: 'https://www.facebook.com/ads/library/?id=a1',
    ad_delivery_start_time: '2026-01-10T00:00:00+0000',
    ...p,
  };
}

describe('refus des annonces inexploitables', () => {
  it('refuse une annonce sans identifiant', () => {
    expect(() => normaliser(brute({ id: '' }), MAINTENANT)).toThrow(AnnonceInvalide);
  });

  it('refuse une annonce sans page_id', () => {
    expect(() => normaliser(brute({ page_id: '  ' }), MAINTENANT)).toThrow(/page_id absent/);
  });

  it('refuse une annonce sans instantané officiel', () => {
    // Garde-fou n° 3 : sans lien vers l'instantané Meta, on n'a pas le droit
    // d'afficher l'annonce, donc on ne la stocke pas.
    expect(() => normaliser(brute({ ad_snapshot_url: '' }), MAINTENANT)).toThrow(/snapshot/);
  });

  it('refuse une date de début illisible', () => {
    expect(() => normaliser(brute({ ad_delivery_start_time: 'bientôt' }), MAINTENANT)).toThrow(
      /date de début/,
    );
  });

  it('refuse une fin antérieure au début', () => {
    expect(() =>
      normaliser(
        brute({ ad_delivery_start_time: '2026-05-01', ad_delivery_stop_time: '2026-04-01' }),
        MAINTENANT,
      ),
    ).toThrow(/antérieure/);
  });
});

describe('statut de diffusion', () => {
  it('est active sans date de fin', () => {
    expect(normaliser(brute(), MAINTENANT).isActive).toBe(true);
  });

  it('est active si la fin est à venir', () => {
    expect(
      normaliser(brute({ ad_delivery_stop_time: '2026-12-01' }), MAINTENANT).isActive,
    ).toBe(true);
  });

  it('est arrêtée si la fin est passée', () => {
    const a = normaliser(brute({ ad_delivery_stop_time: '2026-03-01' }), MAINTENANT);
    expect(a.isActive).toBe(false);
    expect(a.deliveryStopTime).toBeInstanceOf(Date);
  });

  it('traite une fin nulle comme une absence de fin', () => {
    expect(normaliser(brute({ ad_delivery_stop_time: null }), MAINTENANT).isActive).toBe(true);
  });
});

describe('textes de création', () => {
  it('prend la première variante non vide', () => {
    const a = normaliser(
      brute({ ad_creative_bodies: ['', '   ', 'La bonne accroche', 'une autre'] }),
      MAINTENANT,
    );
    expect(a.bodyText).toBe('La bonne accroche');
  });

  it('rend null plutôt que d’inventer quand le champ manque', () => {
    const a = normaliser(brute(), MAINTENANT);
    expect(a.bodyText).toBeNull();
    expect(a.linkTitle).toBeNull();
    expect(a.linkDescription).toBeNull();
  });

  it('garde la charge complète : rien n’est perdu des variantes écartées', () => {
    const b = brute({ ad_creative_bodies: ['un', 'deux', 'trois'] });
    const a = normaliser(b, MAINTENANT);
    expect(a.rawPayload).toBe(b);
    expect((a.rawPayload as AnnonceBrute).ad_creative_bodies).toHaveLength(3);
  });

  it('se rabat sur l’identifiant de page quand le nom manque', () => {
    expect(normaliser(brute({ page_name: undefined }), MAINTENANT).pageName).toBe('Page p1');
  });
});

describe('domaine de destination', () => {
  it('lit un domaine nu', () => {
    expect(domaineDepuisCaption('facturio.fr')).toEqual({
      landingUrl: null,
      landingDomain: 'facturio.fr',
    });
  });

  it('retire le www', () => {
    expect(domaineDepuisCaption('WWW.Facturio.FR').landingDomain).toBe('facturio.fr');
  });

  it('lit une URL complète et en extrait l’hôte', () => {
    const r = domaineDepuisCaption('https://app.facturio.fr/tarifs?src=fb');
    expect(r.landingDomain).toBe('app.facturio.fr');
    expect(r.landingUrl).toContain('app.facturio.fr/tarifs');
  });

  it('accepte un domaine suivi d’un chemin', () => {
    expect(domaineDepuisCaption('facturio.fr/tarifs').landingDomain).toBe('facturio.fr');
  });

  it('préfère aucun domaine à un domaine faux', () => {
    for (const c of ['En savoir plus', '', '   ', 'appelez-nous', 'https://'])
      expect(domaineDepuisCaption(c).landingDomain).toBeNull();
  });
});

describe('listes', () => {
  it('normalise la casse, déduplique et trie', () => {
    const a = normaliser(
      brute({
        ad_reached_countries: ['fr', 'FR', 'be', 'ES'],
        publisher_platforms: ['Facebook', 'INSTAGRAM', 'facebook'],
        languages: ['FR', 'fr', 'en'],
      }),
      MAINTENANT,
    );
    expect(a.reachedCountries).toEqual(['BE', 'ES', 'FR']);
    expect(a.publisherPlatforms).toEqual(['facebook', 'instagram']);
    expect(a.languages).toEqual(['en', 'fr']);
  });

  it('rend un tableau vide quand le champ manque, jamais undefined', () => {
    const a = normaliser(brute(), MAINTENANT);
    expect(a.reachedCountries).toEqual([]);
    expect(a.publisherPlatforms).toEqual([]);
  });

  it('trie pour que deux exécutions identiques produisent la même ligne', () => {
    const un = normaliser(brute({ ad_reached_countries: ['FR', 'BE'] }), MAINTENANT);
    const deux = normaliser(brute({ ad_reached_countries: ['BE', 'FR'] }), MAINTENANT);
    expect(un.reachedCountries).toEqual(deux.reachedCountries);
  });
});
