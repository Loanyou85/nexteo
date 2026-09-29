import { describe, expect, it } from 'vitest';
import {
  ajouter,
  ajouterMois,
  ajuster,
  cloturer,
  creditsPourCout,
  disponible,
  expirer,
  recharger,
  rembourser,
  reserver,
  SoldeInsuffisant,
  soldes,
  verserPeriode,
  type Ecriture,
  type Ligne,
} from '@/lib/credits/registre';

/** Applique des écritures comme le ferait la base : en ajout seul. */
function appliquer(lignes: Ligne[], ecritures: Ecriture[], quand = new Date('2026-10-01')): Ligne[] {
  return ajouter(lignes, ecritures, quand);
}

const D1 = new Date('2026-10-01T00:00:00Z');
const F1 = new Date('2026-11-01T00:00:00Z');
const F2 = new Date('2026-12-01T00:00:00Z');
const F3 = new Date('2027-01-01T00:00:00Z');

function abonne(credits = 25, recharges = 0): Ligne[] {
  let l: Ligne[] = [];
  l = appliquer(l, verserPeriode({ lignes: l, cle: 'sub1:2026-10-01', credits, debut: D1, fin: F1, moisReport: 1 }));
  if (recharges) l = appliquer(l, recharger(recharges, 'cs_1'));
  return l;
}

describe('réservation, débit au réel, libération (test 3)', () => {
  it('laisse le solde exact : 25 − 7 réellement consommés = 18', () => {
    let l = abonne(25);
    l = appliquer(l, reserver(l, 'b1', 20));
    expect(disponible(l)).toBe(5); // réservé, pas débité

    const { ecritures, debite } = cloturer(l, 'b1', 7);
    l = appliquer(l, ecritures);
    expect(debite).toBe(7);
    expect(disponible(l)).toBe(18);
  });

  it('ne débite rien de plus si la clôture est rejouée', () => {
    let l = abonne(25);
    l = appliquer(l, reserver(l, 'b1', 20));
    l = appliquer(l, cloturer(l, 'b1', 7).ecritures);
    expect(cloturer(l, 'b1', 7).ecritures).toEqual([]);
    expect(disponible(l)).toBe(18);
  });

  it('refuse une réservation à découvert', () => {
    const l = abonne(5);
    expect(() => reserver(l, 'b1', 10)).toThrow(SoldeInsuffisant);
  });

  it('ne passe jamais sous zéro, même si l’arrondi dépasse la réservation', () => {
    let l = abonne(3);
    l = appliquer(l, reserver(l, 'b1', 3));
    const r = cloturer(l, 'b1', 4);
    l = appliquer(l, r.ecritures);
    expect(r.debite).toBe(3);
    expect(r.absorbe).toBe(1);
    expect(disponible(l)).toBe(0);
  });

  it('accepte une seconde réservation après confirmation, et libère les deux', () => {
    let l = abonne(25, 20);
    l = appliquer(l, reserver(l, 'b1', 20));
    l = appliquer(l, reserver(l, 'b1', 10)); // « Continuer en consommant davantage »
    expect(disponible(l)).toBe(15);
    l = appliquer(l, cloturer(l, 'b1', 24).ecritures);
    expect(disponible(l)).toBe(21);
  });
});

describe('remboursement (test 4)', () => {
  it('restitue exactement les crédits consommés', () => {
    let l = abonne(25);
    const avant = disponible(l);
    l = appliquer(l, reserver(l, 'b1', 20));
    l = appliquer(l, cloturer(l, 'b1', 9).ecritures);
    expect(disponible(l)).toBe(avant - 9);

    l = appliquer(l, rembourser(l, 'b1'));
    expect(disponible(l)).toBe(avant);
    expect(soldes(l)).toEqual(soldes(abonne(25)));
  });

  it('libère aussi une réservation restée ouverte (panne en plein build)', () => {
    let l = abonne(25);
    l = appliquer(l, reserver(l, 'b1', 20));
    l = appliquer(l, rembourser(l, 'b1'));
    expect(disponible(l)).toBe(25);
  });

  it('ne rembourse pas deux fois', () => {
    let l = abonne(25);
    l = appliquer(l, reserver(l, 'b1', 20));
    l = appliquer(l, cloturer(l, 'b1', 9).ecritures);
    l = appliquer(l, rembourser(l, 'b1'));
    expect(rembourser(l, 'b1')).toEqual([]);
  });
});

describe('ordre de consommation (test 5)', () => {
  it('prend l’abonnement, puis le report, puis la recharge', () => {
    let l: Ligne[] = [];
    l = appliquer(l, verserPeriode({ lignes: l, cle: 's:1', credits: 25, debut: D1, fin: F1, moisReport: 1 }));
    l = appliquer(l, reserver(l, 'b0', 15));
    l = appliquer(l, cloturer(l, 'b0', 15).ecritures); // reste 10 d'abonnement
    l = appliquer(l, verserPeriode({ lignes: l, cle: 's:2', credits: 25, debut: F1, fin: F2, moisReport: 1 }));
    l = appliquer(l, recharger(20, 'cs_1'));
    expect(soldes(l)).toEqual({ subscription: 25, rollover: 10, topup: 20 });

    l = appliquer(l, reserver(l, 'b1', 30));
    l = appliquer(l, cloturer(l, 'b1', 30).ecritures);
    // 25 d'abonnement épuisés d'abord, puis 5 du report ; la recharge intacte.
    expect(soldes(l)).toEqual({ subscription: 0, rollover: 5, topup: 20 });

    l = appliquer(l, reserver(l, 'b2', 8));
    l = appliquer(l, cloturer(l, 'b2', 8).ecritures);
    expect(soldes(l)).toEqual({ subscription: 0, rollover: 0, topup: 17 });
  });
});

describe('report d’un mois (test 6)', () => {
  it('reporte le reste une fois, puis le fait expirer', () => {
    let l: Ligne[] = [];
    l = appliquer(l, verserPeriode({ lignes: l, cle: 's:1', credits: 25, debut: D1, fin: F1, moisReport: 1 }));
    l = appliquer(l, reserver(l, 'b', 10));
    l = appliquer(l, cloturer(l, 'b', 10).ecritures); // reste 15

    l = appliquer(l, verserPeriode({ lignes: l, cle: 's:2', credits: 25, debut: F1, fin: F2, moisReport: 1 }));
    expect(soldes(l)).toEqual({ subscription: 25, rollover: 15, topup: 0 });

    // Mois suivant sans rien consommer : les 15 reportés expirent, les 25
    // non utilisés deviennent le nouveau report.
    l = appliquer(l, verserPeriode({ lignes: l, cle: 's:3', credits: 25, debut: F2, fin: F3, moisReport: 1 }));
    expect(soldes(l)).toEqual({ subscription: 25, rollover: 25, topup: 0 });
  });

  it('fait expirer le report à sa date même sans nouveau versement (abonnement résilié)', () => {
    let l: Ligne[] = [];
    l = appliquer(l, verserPeriode({ lignes: l, cle: 's:1', credits: 25, debut: D1, fin: F1, moisReport: 1 }), D1);
    l = appliquer(l, verserPeriode({ lignes: l, cle: 's:2', credits: 25, debut: F1, fin: F2, moisReport: 1 }), F1);
    expect(soldes(l).rollover).toBe(25);

    // Veille de l'échéance : rien n'expire.
    expect(expirer(l, new Date('2026-11-30T23:00:00Z'))).toEqual([]);
    l = appliquer(l, expirer(l, F2), F2);
    expect(soldes(l)).toEqual({ subscription: 0, rollover: 0, topup: 0 });
  });

  it('ne fait jamais expirer une recharge', () => {
    let l = appliquer([], recharger(20, 'cs'));
    l = appliquer(l, expirer(l, new Date('2031-01-01')));
    expect(disponible(l)).toBe(20);
  });

  it('ne reverse rien si la même période est versée deux fois', () => {
    let l: Ligne[] = [];
    const args = { cle: 's:1', credits: 25, debut: D1, fin: F1, moisReport: 1 };
    l = appliquer(l, verserPeriode({ lignes: l, ...args }));
    expect(verserPeriode({ lignes: l, ...args })).toEqual([]);
    expect(disponible(l)).toBe(25);
  });
});

describe('ajustement manuel', () => {
  it('exige un motif', () => {
    expect(() => ajuster([], { delta: 5, note: '  ', cle: 'a' })).toThrow();
  });

  it('ne rend pas le solde négatif', () => {
    expect(() => ajuster(abonne(5), { delta: -6, note: 'erreur de saisie', cle: 'a' })).toThrow(SoldeInsuffisant);
  });
});

describe('conversion coût réel → crédits', () => {
  it('arrondit au crédit supérieur (0,42 € par crédit)', () => {
    expect(creditsPourCout(4_060_000, 42)).toBe(10); // 4,06 € → 9,67 → 10
    expect(creditsPourCout(4_200_000, 42)).toBe(10); // pile 10
    expect(creditsPourCout(4_200_001, 42)).toBe(11);
    expect(creditsPourCout(0, 42)).toBe(0);
  });
});

describe('ajouterMois', () => {
  it('ne déborde pas sur le mois suivant (31 janvier + 1 mois)', () => {
    expect(ajouterMois(new Date('2027-01-31T00:00:00Z'), 1).toISOString()).toBe('2027-02-28T00:00:00.000Z');
  });
});
