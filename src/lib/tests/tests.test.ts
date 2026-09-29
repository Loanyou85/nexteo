import { describe, expect, it } from 'vitest';
import { analyserAssertion, evaluer, genererTests, mesurer } from '@/lib/tests';
import { specZombie } from '@/lib/gamespec/modeles';
import { executerPartie } from '@/lib/uefn/mock/execution';
import { genererModule } from '@/lib/ai/simule/verse';

const spec = specZombie({ gameId: 'g' });
const tests = genererTests(spec);
const MODULES = ['round_manager', 'zombie_spawner', 'currency_system', 'hud_manager', 'game_manager'];

function partie(premiere: boolean, devices = { player_spawner_device: 4, creature_spawner_device: 4 }) {
  const fichiers = Object.fromEntries(MODULES.map((m) => [`${m}.verse`, genererModule(spec, m, premiere)]));
  return mesurer(executerPartie({ fichiers, devices, joueurs: 4 }));
}

describe('génération des tests', () => {
  it('produit un test par exigence du plan', () => {
    expect(tests.map((t) => t.key)).toEqual(spec.testRequirements.map((t) => t.id));
  });

  it('traduit les exemples de la section 17', () => {
    const par = Object.fromEntries(tests.map((t) => [t.key, t.assertion]));
    expect(par.manche_demarre).toBe('first_round == 1');
    expect(par.elimination_rapporte).toBe('currency_after > currency_before');
    expect(par.boss_apparait).toBe('boss_round == 10');
  });
});

describe('évaluation sur les logs d’une partie', () => {
  it('tout passe quand le code est correct et les devices présents', () => {
    const { mesures, preuves } = partie(false);
    const echecs = tests.filter((t) => !evaluer(t, mesures, preuves).passe);
    expect(echecs.map((t) => t.key)).toEqual([]);
  });

  it('voit que l’or n’augmente pas quand le gain n’est pas crédité', () => {
    const { mesures, preuves } = partie(true);
    const t = tests.find((x) => x.key === 'elimination_rapporte')!;
    const v = evaluer(t, mesures, preuves);
    expect(v.passe).toBe(false);
    expect(v.observe).toContain('currency_after = 0');
    expect(v.preuves.length).toBeGreaterThan(0);
  });

  it('voit qu’il manque des joueurs quand les apparitions manquent', () => {
    const { mesures, preuves } = partie(false, { player_spawner_device: 2, creature_spawner_device: 4 });
    const t = tests.find((x) => x.key === 'joueurs_apparaissent')!;
    expect(evaluer(t, mesures, preuves).passe).toBe(false);
  });

  it('une mesure absente fait échouer le test au lieu de valoir zéro', () => {
    const t = tests.find((x) => x.key === 'boss_apparait')!;
    expect(evaluer(t, {}, {}).passe).toBe(false);
  });
});

describe('analyseur d’assertions', () => {
  it('refuse ce qui n’est pas une comparaison simple', () => {
    expect(() => analyserAssertion('process.exit(1)')).toThrow();
    expect(() => analyserAssertion('a == b; drop')).toThrow();
  });
});
