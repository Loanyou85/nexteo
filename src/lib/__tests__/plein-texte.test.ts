import { describe, expect, it } from 'vitest';
import { requetePrefixe } from '@/lib/plein-texte';

describe('requetePrefixe', () => {
  it('transforme chaque mot en préfixe', () => {
    expect(requetePrefixe('stripe')).toBe('stripe:*');
  });

  it('exige tous les mots, et non un seul', () => {
    // Un OU renverrait la moitié de l'archive dès qu'un mot est courant.
    expect(requetePrefixe('facturation saas')).toBe('facturation:* & saas:*');
  });

  it('écarte les mots trop courts pour que l’index serve', () => {
    // Trois caractères suffisent — « crm » et « ia » ne se traitent pas pareil.
    expect(requetePrefixe('ia crm')).toBe('crm:*');
    expect(requetePrefixe('ia de')).toBeNull();
    expect(requetePrefixe('ia facturation')).toBe('facturation:*');
  });

  it('retire la ponctuation au lieu de la laisser casser to_tsquery', () => {
    for (const saisie of ["l'outil", 'paie (2024)', 'a & b | c', 'test:*', '"guillemets"']) {
      const sortie = requetePrefixe(saisie);
      if (sortie === null) continue;
      // Seuls `:*` et ` & ` subsistent : tout le reste est alphanumérique.
      expect(sortie.replace(/:\*/g, '').replace(/ & /g, '')).toMatch(/^[\p{L}\p{N}]+$/u);
    }
  });

  it('ne renvoie jamais une expression vide, qui ferait échouer la requête', () => {
    for (const saisie of ['', '   ', '!!!', 'a', 'ab', '— — —']) {
      expect(requetePrefixe(saisie)).toBeNull();
    }
  });

  it('garde les lettres accentuées, le corpus est européen', () => {
    expect(requetePrefixe('résiliation')).toBe('résiliation:*');
  });
});
