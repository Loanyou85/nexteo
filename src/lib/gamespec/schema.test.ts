import { describe, expect, it } from 'vitest';
import { differences, lireGameSpec } from '@/lib/gamespec/schema';
import { specZombie } from '@/lib/gamespec/modeles';

describe('GameSpec', () => {
  it('le modèle de référence est valide', () => {
    const r = lireGameSpec(specZombie({ gameId: 'g1' }));
    expect(r.ok).toBe(true);
  });

  it('refuse une version de schéma inconnue au lieu de la deviner', () => {
    const r = lireGameSpec({ ...specZombie({ gameId: 'g1' }), specVersion: '2.0' });
    expect(r.ok).toBe(false);
  });

  it('refuse une vague au-delà du nombre de manches', () => {
    const s = specZombie({ gameId: 'g1', rounds: 5, bossRound: 8 });
    const r = lireGameSpec(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.join(' ')).toMatch(/manche 8/);
  });

  it('refuse un jeu sans apparition joueur', () => {
    const s = specZombie({ gameId: 'g1' });
    const r = lireGameSpec({ ...s, spawnPoints: s.spawnPoints.filter((p) => p.kind !== 'player') });
    expect(r.ok).toBe(false);
  });

  it('refuse un device dont le type n’a pas la forme d’un device', () => {
    const s = specZombie({ gameId: 'g1' });
    const r = lireGameSpec({ ...s, devices: [{ ...s.devices[0]!, deviceType: 'machine_magique' }] });
    expect(r.ok).toBe(false);
  });

  it('refuse deux devices avec le même identifiant stable', () => {
    const s = specZombie({ gameId: 'g1' });
    const r = lireGameSpec({ ...s, devices: [s.devices[0]!, s.devices[0]!] });
    expect(r.ok).toBe(false);
  });

  it('refuse une dépendance de module qui n’existe pas', () => {
    const s = specZombie({ gameId: 'g1' });
    const r = lireGameSpec({
      ...s,
      verseModules: [...s.verseModules, { name: 'orphelin', responsibility: 'x', dependsOn: ['fantome'] }],
    });
    expect(r.ok).toBe(false);
  });

  it('liste les champs modifiés entre deux versions', () => {
    const a = specZombie({ gameId: 'g1' });
    const b = { ...a, version: 2, playerCount: 6, title: 'Autre' };
    expect(differences(a, b).sort()).toEqual(['playerCount', 'title']);
  });
});
