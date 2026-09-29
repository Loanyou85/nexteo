import { describe, expect, it } from 'vitest';
import { specZombie } from '@/lib/gamespec/modeles';
import { appliquerParametres, parametresDe } from '@/lib/gamespec/parametres';

const spec = specZombie({ gameId: 'g' });

describe('paramètres du plan de map', () => {
  it('relire puis réappliquer les paramètres ne change rien', () => {
    expect(appliquerParametres(spec, parametresDe(spec))).toEqual(spec);
  });

  it('passer à 6 joueurs ajoute les apparitions ET met le test à jour', () => {
    const s = appliquerParametres(spec, { ...parametresDe(spec), playerCount: 6 });
    expect(s.devices.filter((d) => d.need === 'player_spawn')).toHaveLength(6);
    expect(s.testRequirements.find((t) => t.kind === 'players_spawn')?.param).toBe(6);
  });

  it('retirer le boss retire son device et son test', () => {
    const s = appliquerParametres(spec, { ...parametresDe(spec), bossRound: 0 });
    expect(s.devices.some((d) => d.need === 'boss_spawn')).toBe(false);
    expect(s.testRequirements.some((t) => t.kind === 'boss_appears')).toBe(false);
  });

  it('ramène un boss placé après la dernière manche à la dernière manche', () => {
    const s = appliquerParametres(spec, { ...parametresDe(spec), rounds: 5, bossRound: 9 });
    expect(s.testRequirements.find((t) => t.kind === 'boss_appears')?.param).toBe(5);
  });
});
