import { z } from 'zod/v4';
import { specZombie } from '@/lib/gamespec/modeles';
import { ENVIRONNEMENTS, gameSpecSchema, type GameSpec } from '@/lib/gamespec/schema';

/**
 * Ce que l'utilisateur modifie dans le formulaire du plan de jeu.
 *
 * On n'édite pas le GameSpec champ par champ : ses parties se tiennent. Passer
 * de 4 à 6 joueurs doit ajouter deux points d'apparition ET changer le test
 * « les joueurs apparaissent ». L'utilisateur édite donc des paramètres, et le
 * plan complet est recalculé à partir d'eux — devices, modules et tests
 * restent cohérents par construction.
 */

export const parametresSchema = z.object({
  title: z.string().trim().min(2, 'Deux caractères au moins.').max(60),
  description: z.string().trim().max(600),
  playerCount: z.coerce.number().int().min(1).max(16),
  mapSize: z.enum(['small', 'medium', 'large']),
  environment: z.enum(ENVIRONNEMENTS),
  rounds: z.coerce.number().int().min(1).max(50),
  durationSeconds: z.coerce.number().int().min(30).max(600),
  betweenRoundsSeconds: z.coerce.number().int().min(0).max(120),
  /** 0 = pas de boss. */
  bossRound: z.coerce.number().int().min(0).max(50),
  zombieHealth: z.coerce.number().int().min(1).max(10_000),
  zombieSpeed: z.coerce.number().min(0.1).max(5),
  zombieSpawnRate: z.coerce.number().min(0).max(120),
  bossHealth: z.coerce.number().int().min(1).max(10_000),
  currencyName: z.string().trim().min(1).max(24),
  rewardElimination: z.coerce.number().int().min(1).max(100_000),
  rewardRound: z.coerce.number().int().min(1).max(100_000),
  rewardBoss: z.coerce.number().int().min(1).max(100_000),
  ui: z.object({
    score: z.boolean(),
    health: z.boolean(),
    currency: z.boolean(),
    timer: z.boolean(),
    round: z.boolean(),
    objectives: z.boolean(),
    leaderboard: z.boolean(),
  }),
});

export type Parametres = z.infer<typeof parametresSchema>;

export function parametresDe(s: GameSpec): Parametres {
  const zombie = s.enemies.find((e) => !e.waves.some((v) => v.boss));
  const boss = s.enemies.find((e) => e.waves.some((v) => v.boss));
  const gain = (ev: string, defaut: number) => s.currency.earnRules.find((r) => r.event === ev)?.amount ?? defaut;
  return {
    title: s.title,
    description: s.description,
    playerCount: s.playerCount,
    mapSize: s.mapSize,
    environment: s.environment,
    rounds: s.rounds.count,
    durationSeconds: s.rounds.durationSeconds,
    betweenRoundsSeconds: s.rounds.betweenRoundsSeconds,
    bossRound: boss?.waves.find((v) => v.boss)?.round ?? 0,
    zombieHealth: zombie?.health ?? 100,
    zombieSpeed: zombie?.speed ?? 1,
    zombieSpawnRate: zombie?.spawnRate ?? 12,
    bossHealth: boss?.health ?? 2500,
    currencyName: s.currency.name || 'Or',
    rewardElimination: gain('elimination', 10),
    rewardRound: gain('round_complete', 50),
    rewardBoss: gain('boss_elimination', 500),
    ui: s.ui,
  };
}

/** Recalcule un plan complet et cohérent à partir des paramètres. */
export function appliquerParametres(courant: GameSpec, p: Parametres): GameSpec {
  const bossRound = p.bossRound > 0 ? Math.min(p.bossRound, p.rounds) : null;
  const base = specZombie({
    gameId: courant.gameId,
    title: p.title,
    description: p.description,
    playerCount: p.playerCount,
    rounds: p.rounds,
    bossRound,
    environment: p.environment,
  });

  const suivant: GameSpec = {
    ...base,
    version: courant.version,
    mapSize: p.mapSize,
    rounds: { count: p.rounds, durationSeconds: p.durationSeconds, betweenRoundsSeconds: p.betweenRoundsSeconds },
    enemies: base.enemies.map((e) =>
      e.waves.some((v) => v.boss)
        ? { ...e, health: p.bossHealth }
        : { ...e, health: p.zombieHealth, speed: p.zombieSpeed, spawnRate: p.zombieSpawnRate },
    ),
    // Les armes n'ont pas de paramètre : celles du plan courant sont gardées.
    weapons: courant.weapons,
    currency: {
      enabled: true,
      name: p.currencyName,
      earnRules: base.currency.earnRules.map((r) => ({
        ...r,
        amount:
          r.event === 'elimination' ? p.rewardElimination : r.event === 'round_complete' ? p.rewardRound : p.rewardBoss,
      })),
    },
    devices: base.devices.map((d) =>
      d.need === 'round_timer' ? { ...d, properties: { ...d.properties, duration: p.durationSeconds } } : d,
    ),
    ui: p.ui,
  };

  return gameSpecSchema.parse(suivant);
}
