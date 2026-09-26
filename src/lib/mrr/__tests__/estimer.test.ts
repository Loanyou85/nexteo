import { describe, expect, it } from 'vitest';
import { HYPOTHESES, estimerMrr, formaterFourchette, formaterMontant } from '../estimer';

describe('refus de produire un chiffre', () => {
  it('ne rend rien sans portée : une hypothèse sur une hypothèse n’est pas une estimation', () => {
    expect(estimerMrr({ porteeTotale: null, joursDiffusion: 200 })).toBeNull();
    expect(estimerMrr({ porteeTotale: 0, joursDiffusion: 200 })).toBeNull();
    expect(estimerMrr({ porteeTotale: -5, joursDiffusion: 200 })).toBeNull();
  });

  it('ne rend rien sans durée de diffusion', () => {
    expect(estimerMrr({ porteeTotale: 500_000, joursDiffusion: 0 })).toBeNull();
  });
});

describe('fourchette', () => {
  const e = estimerMrr({ porteeTotale: 1_000_000, joursDiffusion: 180 })!;

  it('encadre toujours le point central', () => {
    expect(e.basCents).toBeLessThan(e.centreCents);
    expect(e.centreCents).toBeLessThan(e.hautCents);
  });

  it('est large : le haut vaut le carré du facteur d’incertitude fois le bas', () => {
    // Quatre hypothèses de marché, chacune faussable d'un facteur deux. Une
    // fourchette étroite mentirait sur ce qu'on sait.
    expect(e.hautCents / e.basCents).toBeCloseTo(HYPOTHESES.facteurIncertitude ** 2, 5);
  });

  it('croît avec la portée, à durée égale', () => {
    const petit = estimerMrr({ porteeTotale: 100_000, joursDiffusion: 180 })!;
    const grand = estimerMrr({ porteeTotale: 400_000, joursDiffusion: 180 })!;
    expect(grand.centreCents).toBeGreaterThan(petit.centreCents);
  });

  it('décroît quand la même portée est étalée sur plus longtemps', () => {
    const court = estimerMrr({ porteeTotale: 500_000, joursDiffusion: 30 })!;
    const long = estimerMrr({ porteeTotale: 500_000, joursDiffusion: 300 })!;
    expect(long.centreCents).toBeLessThan(court.centreCents);
  });
});

describe('honnêteté du rendu', () => {
  it('n’annonce jamais une fiabilité élevée', () => {
    for (const j of [1, 30, 90, 400, 2000]) {
      const e = estimerMrr({ porteeTotale: 250_000, joursDiffusion: j })!;
      expect(['faible', 'moyenne']).toContain(e.fiabilite);
    }
  });

  it('reste « faible » tant que l’observation est courte', () => {
    expect(estimerMrr({ porteeTotale: 250_000, joursDiffusion: 40 })!.fiabilite).toBe('faible');
    expect(estimerMrr({ porteeTotale: 250_000, joursDiffusion: 120 })!.fiabilite).toBe('moyenne');
  });

  it('décrit sa méthode, hypothèses chiffrées comprises', () => {
    const { methode } = estimerMrr({ porteeTotale: 1_000_000, joursDiffusion: 180 })!;
    expect(methode).toContain('Estimation');
    expect(methode).toContain('comptes');
    expect(methode).toContain(String(HYPOTHESES.coutPourMille));
    expect(methode).toContain('aucune mesure propre à l’entreprise');
  });

  it('suit les hypothèses qu’on lui passe', () => {
    const base = estimerMrr({ porteeTotale: 500_000, joursDiffusion: 180 })!;
    const double = estimerMrr(
      { porteeTotale: 500_000, joursDiffusion: 180 },
      { ...HYPOTHESES, coutPourMille: HYPOTHESES.coutPourMille * 2 },
    )!;
    expect(double.centreCents).toBeCloseTo(base.centreCents * 2, -2);
  });
});

describe('mise en forme', () => {
  it('ne feint aucune précision', () => {
    expect(formaterMontant(4_250_00)).toBe('4 k€');
    expect(formaterMontant(1_500_000_00)).toBe('1,5 M€');
    expect(formaterMontant(42_00)).toBe('42 €');
  });

  it('rend une fourchette, jamais un nombre seul', () => {
    const e = estimerMrr({ porteeTotale: 1_000_000, joursDiffusion: 180 })!;
    expect(formaterFourchette(e)).toMatch(/–/);
  });
});
