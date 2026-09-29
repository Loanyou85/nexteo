import { describe, expect, it } from 'vitest';
import { corriger, IASimulee, lireIdee } from '@/lib/ai/simule';
import { currencySystem, hudManager, zombieSpawner } from '@/lib/ai/simule/verse';
import { gameSpecSchema } from '@/lib/gamespec/schema';
import { specZombie } from '@/lib/gamespec/modeles';

const spec = specZombie({ gameId: 'g' });

describe('lecture de l’idée', () => {
  it('lit ce qui est écrit, et seulement ça', () => {
    expect(lireIdee('Crée un jeu de survie zombie à 4 joueurs.')).toEqual({
      playerCount: 4,
      rounds: undefined,
      bossRound: undefined,
      environment: undefined,
    });
    expect(lireIdee('Survie en prison, 6 joueurs, 15 manches, un boss à la manche 12')).toMatchObject({
      playerCount: 6,
      rounds: 15,
      bossRound: 12,
      environment: 'prison',
    });
    expect(lireIdee('zombies sans boss').bossRound).toBeNull();
  });

  it('produit un GameSpec valide pour le scénario de référence', async () => {
    const r = await new IASimulee().structuredOutput({
      systeme: '',
      message: 'Crée un jeu de survie zombie à 4 joueurs.',
      schema: gameSpecSchema,
      nomSchema: 'GameSpec',
      simulation: { idee: 'Crée un jeu de survie zombie à 4 joueurs.', titre: 'Zombie Hospital', gameId: 'g1' },
    });
    expect(r.valeur.playerCount).toBe(4);
    expect(r.usage.inputTokens).toBeGreaterThan(0);
  });
});

describe('corrections de l’IA simulée', () => {
  it('répare la faute de frappe par la fonction définie la plus proche', () => {
    const fautif = zombieSpawner(spec, true);
    expect(fautif).toContain('SpawnZombi(Round, Count)');
    const corrige = corriger(fautif, {
      brut: '/P/zombie_spawner.verse(26,9, 26,19): Script error 3506: Unknown identifier `SpawnZombi`.',
      fichier: 'zombie_spawner.verse',
      ligne: 26,
      contenuFichier: fautif,
      categorie: 'invalid_reference',
    });
    expect(corrige).toBe(zombieSpawner(spec, false));
  });

  it('ajoute le using manquant', () => {
    const fautif = hudManager(spec, true);
    const corrige = corriger(fautif, {
      brut: '/P/hud_manager.verse(9,9, 9,14): Script error 3506: Unknown identifier `Print`.',
      fichier: 'hud_manager.verse',
      ligne: 9,
      contenuFichier: fautif,
      categorie: 'invalid_reference',
    });
    expect(corrige).toBe(hudManager(spec, false));
  });

  it('crédite enfin l’or à l’élimination', () => {
    const fautif = currencySystem(spec, true);
    const corrige = corriger(fautif, {
      brut: 'Test « elimination_rapporte » échoué : currency_after (0) n’est pas supérieur à currency_before (0).',
      fichier: 'currency_system.verse',
      ligne: null,
      contenuFichier: fautif,
      categorie: 'gameplay_error',
    });
    expect(corrige).toBe(currencySystem(spec, false));
  });

  it('rend le fichier inchangé quand il ne sait pas corriger', () => {
    const c = 'x := 1\n';
    expect(corriger(c, { brut: 'Script error 3001: ???', fichier: null, ligne: null, contenuFichier: c, categorie: 'compile_error' })).toBe(c);
  });
});
