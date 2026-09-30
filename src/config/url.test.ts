import { describe, expect, it } from 'vitest';
import { urlPublique } from '@/config/url';

describe('urlPublique', () => {
  it('prend AUTH_URL, réduite à son origine', () => {
    expect(urlPublique({ AUTH_URL: 'https://mon-site.fr/api/auth' }).href).toBe('https://mon-site.fr/');
  });
  it('tolère des guillemets et des espaces collés par erreur', () => {
    expect(urlPublique({ AUTH_URL: ' "https://mon-site.fr" ' }).href).toBe('https://mon-site.fr/');
  });
  it('ne plante pas sur une valeur illisible : repli sur Vercel, puis sur la marque', () => {
    expect(urlPublique({ AUTH_URL: 'pas une adresse', VERCEL_PROJECT_PRODUCTION_URL: 'prod.vercel.app' }).href).toBe('https://prod.vercel.app/');
    expect(urlPublique({ AUTH_URL: 'pas une adresse' }).href).toBe('https://nexteo.app/');
    expect(urlPublique({}).href).toBe('https://nexteo.app/');
  });
  it('refuse un protocole qui n’est pas http(s)', () => {
    expect(urlPublique({ AUTH_URL: 'javascript:alert(1)' }).href).toBe('https://nexteo.app/');
    expect(urlPublique({ AUTH_URL: 'ftp://exemple.fr' }).href).toBe('https://nexteo.app/');
  });
});
