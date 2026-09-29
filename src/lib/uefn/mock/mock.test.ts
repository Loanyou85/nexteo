import { describe, expect, it } from 'vitest';
import { genererModule } from '@/lib/ai/simule/verse';
import { specZombie } from '@/lib/gamespec/modeles';
import { analyserSortieCompilateur, erreursSeulement } from '@/lib/verse/erreurs';
import { IDENTITE_LUF, ECHELLE_UNITE_LUF, luf } from '@/lib/uefn/coordinates';
import { compilerSimule } from '@/lib/uefn/mock/compilateur';
import { DepotMemoire, MockUEFNProvider } from '@/lib/uefn/mock';
import { estPannePlateforme } from '@/lib/uefn/provider';

const spec = specZombie({ gameId: 'g' });
const MODULES = ['round_manager', 'zombie_spawner', 'currency_system', 'hud_manager', 'game_manager'];
const sources = (premiere: boolean) => MODULES.map((m) => ({ path: `${m}.verse`, content: genererModule(spec, m, premiere) }));

describe('compilateur simulé', () => {
  it('compile le code correct', () => {
    const r = compilerSimule(sources(false));
    expect(r.output).toContain('Build succeeded');
    expect(r.ok).toBe(true);
  });

  it('trouve la faute de frappe et le using manquant, au bon endroit', () => {
    const r = compilerSimule(sources(true));
    expect(r.ok).toBe(false);
    const erreurs = erreursSeulement(analyserSortieCompilateur(r.output));
    const parFichier = Object.fromEntries(erreurs.map((e) => [e.fichier, e]));
    expect(parFichier['zombie_spawner.verse']?.identifiant).toBe('SpawnZombi');
    expect(parFichier['hud_manager.verse']?.identifiant).toBe('Print');
    // La ligne indiquée contient bien l'identifiant fautif.
    const src = sources(true).find((s) => s.path === 'zombie_spawner.verse')!.content.split('\n');
    expect(src[parFichier['zombie_spawner.verse']!.ligne! - 1]).toContain('SpawnZombi(');
  });

  it('le gain non crédité compile : seul un test de gameplay peut le voir', () => {
    const r = compilerSimule(sources(true).map((s) => (s.path === 'currency_system.verse' ? s : { ...s, content: genererModule(spec, s.path.replace('.verse', ''), false) })));
    expect(r.ok).toBe(true);
  });
});

describe('éditeur simulé', () => {
  it('rejoue la panne « succès sans effet » au troisième placement', async () => {
    const p = new MockUEFNProvider(new DepotMemoire(), { latence: 0 });
    await p.createProject('Test');
    for (const label of ['a', 'b', 'c']) await p.placeDevice('timer_device', luf(0, 0, 100), label);
    const places = await p.listPlacedDevices();
    expect(places.map((d) => d.label)).toEqual(['a', 'b']);
  });

  it('se fige APRÈS avoir créé l’entité : l’objet existe malgré l’erreur', async () => {
    const p = new MockUEFNProvider(new DepotMemoire(), { latence: 0 });
    await p.createProject('Test');
    const spec = { stableId: 'zone_hall', name: 'Hall', transform: { position: luf(0, 0, 0), rotation: IDENTITE_LUF, scale: ECHELLE_UNITE_LUF }, components: [] };
    const err = await p.createEntity(spec).catch((e: unknown) => e);
    expect(estPannePlateforme(err)).toBe(true);
    expect((await p.listEntities()).map((e) => e.stableId)).toEqual(['zone_hall']);
  });

  it('restitue les positions en LUF à l’identique après stockage en XYZ', async () => {
    const p = new MockUEFNProvider(new DepotMemoire(), { latence: 0, pannes: 'aucune' });
    await p.createProject('Test');
    await p.placeDevice('timer_device', luf(-350, 80, 1200), 'minuteur');
    expect((await p.listPlacedDevices())[0]!.position).toEqual(luf(-350, 80, 1200));
  });

  it('refuse un device absent du catalogue', async () => {
    const p = new MockUEFNProvider(new DepotMemoire(), { latence: 0, pannes: 'aucune' });
    await p.createProject('Test');
    await expect(p.placeDevice('machine_magique_device', luf(0, 0, 0), 'x')).rejects.toThrow(/catalogue/);
  });
});
