import { describe, expect, it } from 'vitest';
import { calculerPalier, type FaitsProjet } from '@/lib/palier';

const base: FaitsProjet = {
  planExiste: true,
  derniereCompilationReussie: true,
  playtestAvecLogs: true,
  testsBloquants: { total: 4, reussis: 4 },
  prePublicationPrete: true,
};

describe('calculerPalier', () => {
  it('monte à l’or quand tout est vérifié', () => {
    expect(calculerPalier(base)).toBe(5);
  });

  it('reste au gris sans plan, quels que soient les autres faits', () => {
    expect(calculerPalier({ ...base, planExiste: false })).toBe(1);
  });

  it('redescend au gris quand la dernière compilation échoue, même si les tests passaient', () => {
    expect(calculerPalier({ ...base, derniereCompilationReussie: false })).toBe(1);
    expect(calculerPalier({ ...base, derniereCompilationReussie: null })).toBe(1);
  });

  it('s’arrête au vert tant qu’aucun playtest n’a produit de logs', () => {
    expect(calculerPalier({ ...base, playtestAvecLogs: false })).toBe(2);
  });

  it('s’arrête au bleu si un seul test bloquant échoue', () => {
    expect(calculerPalier({ ...base, testsBloquants: { total: 4, reussis: 3 } })).toBe(3);
  });

  it('ne compte pas zéro test comme « tous les tests passent »', () => {
    expect(calculerPalier({ ...base, testsBloquants: { total: 0, reussis: 0 } })).toBe(3);
  });

  it('s’arrête au violet tant que la pré-publication n’est pas au vert', () => {
    expect(calculerPalier({ ...base, prePublicationPrete: false })).toBe(4);
    expect(calculerPalier({ ...base, prePublicationPrete: null })).toBe(4);
  });
});
