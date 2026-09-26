import { describe, expect, it } from 'vitest';
import {
  BANDES,
  COMPOSANTES,
  POIDS_PAR_DEFAUT,
  SEUILS,
  bandePour,
  calculerSignal,
  type AnnonceObservee,
  type EntreeSignal,
} from '../score';

const MAINTENANT = new Date('2026-09-26T12:00:00Z');
const JOUR = 86_400_000;
const ilYA = (j: number) => new Date(MAINTENANT.getTime() - j * JOUR);

function annonce(p: Partial<AnnonceObservee> = {}): AnnonceObservee {
  return {
    deliveryStartTime: ilYA(30),
    deliveryStopTime: null,
    isActive: true,
    reachedCountries: ['FR'],
    publisherPlatforms: ['facebook'],
    checksums: ['c1'],
    firstSeenAt: ilYA(30),
    ...p,
  };
}

function entree(p: Partial<EntreeSignal> = {}): EntreeSignal {
  return {
    annonces: [annonce()],
    couverture: { joursCouverts: 30, joursObserves: 30 },
    maintenant: MAINTENANT,
    ...p,
  };
}

describe('bornes du score', () => {
  it('rend 0 quand il n’y a rien à observer', () => {
    const s = calculerSignal({
      annonces: [],
      couverture: { joursCouverts: 0, joursObserves: 0 },
      maintenant: MAINTENANT,
    });
    expect(s.score).toBe(0);
    expect(s.bande).toBe('test');
  });

  it('rend 100 pour un annonceur saturé sur toutes les composantes', () => {
    // Autant d'annonces que le plafond du rythme de test : en dessous, cette
    // composante n'est pas saturée et le total ne peut pas atteindre 100.
    const annonces = Array.from({ length: SEUILS.rythmeTestPlafond }, (_, i) =>
      annonce({
        deliveryStartTime: ilYA(500),
        firstSeenAt: MAINTENANT,
        checksums: [`visuel-${i}`],
        reachedCountries: ['FR', 'BE', 'ES', 'IT', 'DE', 'NL', 'PT', 'IE', 'AT', 'PL'],
        publisherPlatforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
      }),
    );
    const s = calculerSignal({
      annonces,
      couverture: { joursCouverts: 500, joursObserves: 500 },
      maintenant: MAINTENANT,
    });
    expect(s.score).toBe(100);
    expect(s.bande).toBe('eprouve');
  });

  it('ne dépasse jamais 0-100, quels que soient les excès', () => {
    const s = calculerSignal(
      entree({
        annonces: [
          annonce({
            deliveryStartTime: ilYA(5000),
            reachedCountries: Array.from({ length: 27 }, (_, i) => `P${i}`),
            publisherPlatforms: ['a', 'b', 'c', 'd', 'e', 'f'],
            checksums: Array.from({ length: 300 }, (_, i) => `v${i}`),
          }),
        ],
        couverture: { joursCouverts: 9999, joursObserves: 1000 },
      }),
    );
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
  });
});

describe('persistance', () => {
  it('ne compte que les annonces encore actives', () => {
    const arretee = calculerSignal(
      entree({
        annonces: [
          annonce({ deliveryStartTime: ilYA(400), isActive: false, deliveryStopTime: ilYA(200) }),
        ],
      }),
    );
    const active = calculerSignal(
      entree({ annonces: [annonce({ deliveryStartTime: ilYA(400) })] }),
    );

    const p = (s: typeof arretee) => s.detail.find((d) => d.cle === 'persistance')!;
    expect(p(arretee).normalisee).toBe(0);
    expect(p(active).normalisee).toBe(1);
    expect(p(arretee).explication).toBe('Aucune annonce en cours de diffusion.');
  });

  it('sature à un an', () => {
    const p = (j: number) =>
      calculerSignal(entree({ annonces: [annonce({ deliveryStartTime: ilYA(j) })] })).detail.find(
        (d) => d.cle === 'persistance',
      )!.normalisee;

    expect(p(SEUILS.persistanceJours / 2)).toBeCloseTo(0.5, 2);
    expect(p(SEUILS.persistanceJours)).toBe(1);
    expect(p(SEUILS.persistanceJours * 3)).toBe(1);
  });

  it('écrit « mois » sans pluriel parasite', () => {
    const e = calculerSignal(entree({ annonces: [annonce({ deliveryStartTime: ilYA(365) })] }));
    const texte = e.detail.find((d) => d.cle === 'persistance')!.explication;
    expect(texte).toContain('12 mois');
    expect(texte).not.toContain('moiss');
  });
});

describe('continuité', () => {
  it('plancherise le dénominateur : un annonceur vu hier ne peut pas être « continu »', () => {
    const neuf = calculerSignal(
      entree({ couverture: { joursCouverts: 1, joursObserves: 1 } }),
    ).detail.find((d) => d.cle === 'continuite')!;

    expect(neuf.normalisee).toBeCloseTo(1 / SEUILS.observationMinimaleJours, 5);
    expect(neuf.explication).toContain('ne peut pas encore être établie');
  });

  it('rend la part réelle une fois la fenêtre d’observation suffisante', () => {
    const d = calculerSignal(
      entree({ couverture: { joursCouverts: 90, joursObserves: 180 } }),
    ).detail.find((c) => c.cle === 'continuite')!;

    expect(d.normalisee).toBeCloseTo(0.5, 5);
    expect(d.valeur).toBe(50);
    expect(d.explication).toBe('Diffusion active 90 jours sur les 180 observés, soit 50 %.');
  });

  it('ne dépasse pas 1 si la couverture excède la fenêtre', () => {
    const d = calculerSignal(
      entree({ couverture: { joursCouverts: 400, joursObserves: 200 } }),
    ).detail.find((c) => c.cle === 'continuite')!;
    expect(d.normalisee).toBe(1);
  });
});

describe('rythme de test', () => {
  it('compte les visuels distincts, pas les annonces', () => {
    const memeVisuel = calculerSignal(
      entree({
        annonces: Array.from({ length: 10 }, () => annonce({ checksums: ['identique'] })),
      }),
    ).detail.find((d) => d.cle === 'rythmeTest')!;

    const visuelsDistincts = calculerSignal(
      entree({
        annonces: Array.from({ length: 10 }, (_, i) => annonce({ checksums: [`v${i}`] })),
      }),
    ).detail.find((d) => d.cle === 'rythmeTest')!;

    expect(memeVisuel.valeur).toBe(1);
    expect(visuelsDistincts.valeur).toBe(10);
    expect(visuelsDistincts.normalisee).toBeGreaterThan(memeVisuel.normalisee);
  });

  it('ignore ce qui est plus vieux que douze mois', () => {
    const d = calculerSignal(
      entree({
        annonces: [
          annonce({ deliveryStartTime: ilYA(400), firstSeenAt: ilYA(400), checksums: ['vieux'] }),
          annonce({ deliveryStartTime: ilYA(10), firstSeenAt: ilYA(10), checksums: ['recent'] }),
        ],
      }),
    ).detail.find((c) => c.cle === 'rythmeTest')!;
    expect(d.valeur).toBe(1);
  });
});

describe('fraîcheur', () => {
  it('décroît linéairement et s’annule à trois mois', () => {
    const f = (j: number) =>
      calculerSignal(entree({ annonces: [annonce({ firstSeenAt: ilYA(j) })] })).detail.find(
        (d) => d.cle === 'fraicheur',
      )!.normalisee;

    expect(f(0)).toBe(1);
    expect(f(SEUILS.fraicheurJours / 2)).toBeCloseTo(0.5, 5);
    expect(f(SEUILS.fraicheurJours)).toBe(0);
    expect(f(SEUILS.fraicheurJours * 2)).toBe(0);
  });
});

describe('poids', () => {
  it('lit les poids fournis plutôt que ceux d’usine', () => {
    const e = entree({
      annonces: [annonce({ deliveryStartTime: ilYA(365) })],
      couverture: { joursCouverts: 0, joursObserves: 365 },
    });
    const usine = calculerSignal(e).score;
    const toutSurLaPersistance = calculerSignal(e, {
      persistance: 100,
      continuite: 0,
      volumeActif: 0,
      rythmeTest: 0,
      etendue: 0,
      fraicheur: 0,
    }).score;

    expect(toutSurLaPersistance).toBe(100);
    expect(usine).toBeLessThan(toutSurLaPersistance);
  });

  it('ramène toujours l’échelle à 100, quelle que soit la somme des poids', () => {
    const e = entree();
    const cent = calculerSignal(e, POIDS_PAR_DEFAUT).score;
    const doubles = calculerSignal(
      e,
      Object.fromEntries(COMPOSANTES.map((c) => [c, POIDS_PAR_DEFAUT[c] * 2])),
    ).score;
    expect(doubles).toBe(cent);
  });

  it('retombe sur le poids d’usine pour une clé absente', () => {
    const e = entree();
    expect(calculerSignal(e, {}).score).toBe(calculerSignal(e, POIDS_PAR_DEFAUT).score);
  });

  it('ignore un poids négatif au lieu d’inverser la composante', () => {
    const e = entree();
    expect(calculerSignal(e, { persistance: -50 }).score).toBe(
      calculerSignal(e, { persistance: 0 }).score,
    );
  });
});

describe('restitution', () => {
  it('expose une composante par poids, avec une explication non vide', () => {
    const s = calculerSignal(entree());
    expect(s.detail.map((d) => d.cle)).toEqual([...COMPOSANTES]);
    for (const d of s.detail) {
      expect(d.explication.length).toBeGreaterThan(0);
      expect(d.points).toBeGreaterThanOrEqual(0);
    }
  });

  it('le détail affiché retombe sur le score, à l’arrondi près', () => {
    const s = calculerSignal(
      entree({
        annonces: [
          annonce({ deliveryStartTime: ilYA(200), checksums: ['a'] }),
          annonce({ deliveryStartTime: ilYA(90), checksums: ['b'], reachedCountries: ['FR', 'BE'] }),
        ],
        couverture: { joursCouverts: 150, joursObserves: 200 },
      }),
    );
    const somme = s.detail.reduce((t, d) => t + d.points, 0);
    expect(Math.abs(somme - s.score)).toBeLessThanOrEqual(0.5);
  });

  it('ne laisse fuir aucun vocabulaire monétaire dans les explications', () => {
    const interdits = /gagn|revenu|rentab|chiffre d.affaires|mrr|argent|riche|passif|garanti|€|\$/i;
    const s = calculerSignal(
      entree({ annonces: [annonce(), annonce({ isActive: false, deliveryStopTime: ilYA(5) })] }),
    );
    for (const d of s.detail) expect(d.explication).not.toMatch(interdits);
    for (const b of BANDES) expect(b.libelle).not.toMatch(interdits);
  });
});

describe('bandes de lecture', () => {
  it('découpe aux seuils annoncés', () => {
    expect(bandePour(0).bande).toBe('test');
    expect(bandePour(29).bande).toBe('test');
    expect(bandePour(30).bande).toBe('validation');
    expect(bandePour(59).bande).toBe('validation');
    expect(bandePour(60).bande).toBe('installe');
    expect(bandePour(84).bande).toBe('installe');
    expect(bandePour(85).bande).toBe('eprouve');
    expect(bandePour(100).bande).toBe('eprouve');
  });
});
