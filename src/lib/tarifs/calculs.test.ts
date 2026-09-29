import { describe, expect, it } from 'vitest';
import {
  economieAnnuellePct,
  euros,
  mensuelEquivalentCents,
  moisOfferts,
  prixCreditCents,
  validerPrixAnnuel,
  economieMonteeDeGamme,
  prixCreditRechargeCents,
  prixRechargeCents,
  margeBrute,
} from '@/lib/tarifs/calculs';

// Les prix de l'offre de référence, tels que semés en base. Ils sont ici en
// données de test, pas en configuration du produit.
const OFFRES = [
  { nom: 'Créateur', mensuel: 3900, annuel: 39000, credits: 25 },
  { nom: 'Pro', mensuel: 9900, annuel: 99000, credits: 75 },
  { nom: 'Studio', mensuel: 24900, annuel: 249000, credits: 200 },
];

describe('économie annuelle (test 1)', () => {
  it.each(OFFRES)('vaut 17 % pour $nom', ({ mensuel, annuel }) => {
    expect(economieAnnuellePct(mensuel, annuel)).toBe(17);
  });

  it.each(OFFRES)('correspond à 2 mois offerts pour $nom', ({ mensuel, annuel }) => {
    expect(moisOfferts(mensuel, annuel)).toBe(2);
  });
});

describe('mensuel équivalent de l’annuel (test 2)', () => {
  it('s’affiche à deux décimales exactes', () => {
    expect(euros(mensuelEquivalentCents(39000), 'toujours')).toBe('32,50 €');
    expect(euros(mensuelEquivalentCents(99000), 'toujours')).toBe('82,50 €');
    expect(euros(mensuelEquivalentCents(249000), 'toujours')).toBe('207,50 €');
  });

  it('garde les montants ronds sans décimales par défaut', () => {
    expect(euros(3900)).toBe('39 €');
    expect(euros(249000)).toBe('2 490 €');
  });
});

describe('prix du crédit par offre', () => {
  it('baisse en montant de gamme : 1,56 €, 1,32 €, 1,25 €', () => {
    expect(OFFRES.map((o) => prixCreditCents(o.mensuel, o.credits))).toEqual([156, 132, 125]);
  });

  it('n’a pas de sens pour une offre sans crédit', () => {
    expect(prixCreditCents(0, 0)).toBeNull();
  });
});

describe('validation de la remise annuelle (test 9)', () => {
  it('refuse une remise supérieure au maximum configuré', () => {
    // 35 % de remise sur Studio : 249 € × 12 × 0,65.
    const r = validerPrixAnnuel({ mensuelCents: 24900, annuelCents: 194220, remiseMaxPct: 20 });
    expect(r.ok).toBe(false);
  });

  it('accepte « 2 mois offerts » (17 %)', () => {
    expect(validerPrixAnnuel({ mensuelCents: 9900, annuelCents: 99000, remiseMaxPct: 20 }).ok).toBe(true);
  });

  it('accepte exactement 20 %, refuse 20 % et un centime', () => {
    expect(validerPrixAnnuel({ mensuelCents: 10000, annuelCents: 96000, remiseMaxPct: 20 }).ok).toBe(true);
    expect(validerPrixAnnuel({ mensuelCents: 10000, annuelCents: 95999, remiseMaxPct: 20 }).ok).toBe(false);
  });

  it('refuse un montant non entier', () => {
    expect(validerPrixAnnuel({ mensuelCents: 3900, annuelCents: 390.5, remiseMaxPct: 20 }).ok).toBe(false);
  });
});

describe('suggestion de montée de gamme', () => {
  it('chiffre l’économie réelle de deux recharges face au crédit Pro', () => {
    // Deux recharges de 20 crédits à 35 € : 70 € pour 40 crédits, contre 40 × 1,32 € en Pro.
    expect(
      economieMonteeDeGamme({ rechargesPayeesCents: 7000, creditsRecharges: 40, prixCreditSuperieurCents: 132 }),
    ).toBe(1720);
  });
});

describe('recharge à la quantité libre (+10 % sur le crédit de l’offre)', () => {
  it('coûte 10 % de plus que le crédit de chaque offre : 1,72 €, 1,45 €, 1,37 €', () => {
    expect(OFFRES.map((o) => prixCreditRechargeCents(o.mensuel, o.credits, 10))).toEqual([172, 145, 137]);
  });

  it('calcule le total en une fois, sans cumuler les arrondis', () => {
    // Créateur : 20 × 39 € × 1,10 / 25 = 34,32 €, pas 20 × 1,72 € = 34,40 €.
    expect(prixRechargeCents({ offreMensuelCents: 3900, offreCredits: 25, quantite: 20, majorationPct: 10 })).toBe(3432);
    // Studio : 1 000 crédits = 1 369,50 €.
    expect(prixRechargeCents({ offreMensuelCents: 24900, offreCredits: 200, quantite: 1000, majorationPct: 10 })).toBe(136950);
  });

  it('reste toujours plus cher que le crédit de l’offre', () => {
    for (const o of OFFRES) {
      expect(prixCreditRechargeCents(o.mensuel, o.credits, 10)!).toBeGreaterThan(prixCreditCents(o.mensuel, o.credits)!);
    }
  });

  it('refuse une recharge sans offre payante', () => {
    expect(() => prixRechargeCents({ offreMensuelCents: 0, offreCredits: 0, quantite: 5, majorationPct: 10 })).toThrow();
  });
});

describe('marge brute (section 3 de l’offre)', () => {
  const base = { tvaBp: 2000, stripeBp: 150, stripeFixeCents: 25, hebergementCents: 100, coutParCreditCents: 42 };
  it('reste autour de 58 % à pleine consommation et 77 % à moitié, pour Pro et Studio', () => {
    for (const o of OFFRES.slice(1)) {
      const plein = margeBrute({ ...base, prixTtcCents: o.mensuel, credits: o.credits, consommationPct: 100 });
      const moitie = margeBrute({ ...base, prixTtcCents: o.mensuel, credits: o.credits, consommationPct: 50 });
      expect(plein.pct).toBeGreaterThanOrEqual(57);
      expect(plein.pct).toBeLessThanOrEqual(59);
      expect(moitie.pct).toBeGreaterThanOrEqual(77);
      expect(moitie.pct).toBeLessThanOrEqual(78);
    }
  });
});
