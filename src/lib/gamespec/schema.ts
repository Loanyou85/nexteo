import { z } from 'zod/v4';

/**
 * Le GameSpec (section 6) — le contrat entre l'utilisateur, l'IA et le
 * générateur. Aucune génération n'est pilotée par du texte libre : tout ce
 * que l'agent construit sort de ce document, validé à chaque écriture.
 *
 * `specVersion` versionne le SCHÉMA (pas le contenu). Un changement de forme
 * incompatible incrémente la version, et `lireGameSpec` refuse ce qu'elle ne
 * sait pas lire au lieu de le deviner.
 */

export const SPEC_VERSION = '1.0' as const;

export const GENRES = [
  'zombie_survival',
  'gun_game',
  'tycoon',
  'racing',
  'horror',
  'pvp_arena',
  'deathrun',
] as const;
export type Genre = (typeof GENRES)[number];

export const ENVIRONNEMENTS = [
  'hopital',
  'ville',
  'prison',
  'base_militaire',
  'ile',
  'entrepot',
  'arene',
  'laboratoire',
  'circuit',
] as const;

/** Identifiant stable : minuscules, chiffres, tirets bas. Il devient une étiquette dans UEFN. */
const idStable = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,47}$/, 'Identifiant : minuscules, chiffres et _ uniquement.');

const texteCourt = z.string().trim().min(1).max(120);

export const vagueSchema = z.object({
  round: z.number().int().min(1).max(100),
  count: z.number().int().min(1).max(200),
  boss: z.boolean().default(false),
});

export const ennemiSchema = z.object({
  type: texteCourt,
  health: z.number().int().min(1).max(10_000),
  /** Multiplicateur de vitesse, 1 = vitesse de référence du device. */
  speed: z.number().min(0.1).max(5),
  /** Apparitions par minute et par point d'apparition. */
  spawnRate: z.number().min(0).max(120),
  waves: z.array(vagueSchema).max(100),
});

export const armeSchema = z.object({
  type: texteCourt,
  damage: z.number().int().min(1).max(1000),
  availability: z.enum(['start', 'shop', 'pickup']),
});

export const regleGainSchema = z.object({
  event: z.enum(['elimination', 'round_complete', 'objective', 'boss_elimination']),
  amount: z.number().int().min(1).max(100_000),
});

export const boutiqueSchema = z.object({
  location: idStable,
  inventory: z
    .array(z.object({ item: texteCourt, price: z.number().int().min(0).max(1_000_000) }))
    .min(1)
    .max(40),
});

export const conditionSchema = z.object({
  type: z.enum(['survive_rounds', 'reach_score', 'last_standing', 'all_eliminated', 'time_elapsed', 'objective']),
  value: z.number().int().min(0).max(1_000_000).optional(),
  description: texteCourt,
});

export const pointApparitionSchema = z.object({
  id: idStable,
  kind: z.enum(['player', 'enemy', 'boss']),
  zone: idStable,
  count: z.number().int().min(1).max(64),
});

export const deviceBesoinSchema = z.object({
  /** Identifiant stable, dérivé du GameSpec : il sert d'étiquette dans UEFN. */
  stableId: idStable,
  /** Besoin fonctionnel, résolu vers un device par la table de correspondance. */
  need: idStable,
  /** Type de device RÉSOLU depuis le catalogue réel — jamais inventé (section 13). */
  deviceType: z.string().regex(/^[a-z_]+_device$/),
  zone: idStable,
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export const moduleVerseSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/),
  responsibility: texteCourt,
  dependsOn: z.array(z.string()).default([]),
});

export const exigenceTestSchema = z.object({
  id: idStable,
  description: texteCourt,
  kind: z.enum([
    'round_starts',
    'players_spawn',
    'enemies_spawn',
    'elimination_rewards',
    'boss_appears',
    'hud_ready',
    'win_reachable',
    'lose_possible',
  ]),
  /** Paramètre du test, par exemple la manche d'apparition du boss. */
  param: z.number().int().min(0).max(1000).optional(),
  severity: z.enum(['blocking', 'warning']),
});

export const gameSpecSchema = z
  .object({
    gameId: z.string().min(1).max(64),
    version: z.number().int().min(1),
    specVersion: z.literal(SPEC_VERSION),
    genre: z.enum(GENRES),
    title: z.string().trim().min(2).max(60),
    description: z.string().trim().max(600),
    playerCount: z.number().int().min(1).max(64),
    mapSize: z.enum(['small', 'medium', 'large']),
    environment: z.enum(ENVIRONNEMENTS),
    gameplayLoop: z.array(texteCourt).min(1).max(12),
    objectives: z.array(texteCourt).min(1).max(12),
    rounds: z.object({
      count: z.number().int().min(1).max(100),
      durationSeconds: z.number().int().min(15).max(3600),
      betweenRoundsSeconds: z.number().int().min(0).max(300),
    }),
    enemies: z.array(ennemiSchema).max(12),
    weapons: z.array(armeSchema).max(24),
    currency: z.object({
      enabled: z.boolean(),
      name: z.string().trim().max(24),
      earnRules: z.array(regleGainSchema).max(8),
    }),
    shops: z.array(boutiqueSchema).max(8),
    progression: z.object({
      enabled: z.boolean(),
      levels: z.array(z.object({ level: z.number().int().min(1), xp: z.number().int().min(0) })).max(50),
      unlocks: z.array(z.object({ level: z.number().int().min(1), item: texteCourt })).max(50),
    }),
    ui: z.object({
      score: z.boolean(),
      health: z.boolean(),
      currency: z.boolean(),
      timer: z.boolean(),
      round: z.boolean(),
      objectives: z.boolean(),
      leaderboard: z.boolean(),
    }),
    audio: z.object({ music: z.string().max(80).nullable(), sfx: z.array(z.string().max(80)).max(20) }),
    vfx: z.array(z.string().max(80)).max(20),
    winConditions: z.array(conditionSchema).min(1).max(6),
    loseConditions: z.array(conditionSchema).min(1).max(6),
    spawnPoints: z.array(pointApparitionSchema).min(1).max(64),
    checkpoints: z.array(z.object({ id: idStable, zone: idStable, order: z.number().int().min(1) })).max(32),
    devices: z.array(deviceBesoinSchema).max(120),
    verseModules: z.array(moduleVerseSchema).min(1).max(20),
    testRequirements: z.array(exigenceTestSchema).max(40),
    performanceRequirements: z.object({
      maxSimultaneousEnemies: z.number().int().min(1).max(200),
      maxDevices: z.number().int().min(1).max(500),
    }),
  })
  .superRefine((s, ctx) => {
    // Cohérences qu'un schéma de forme ne voit pas, et qui produiraient un
    // jeu impossible à construire ou à tester.
    const uniques = <T,>(liste: T[], cle: (x: T) => string, chemin: string) => {
      const vus = new Set<string>();
      for (const x of liste) {
        const k = cle(x);
        if (vus.has(k)) ctx.addIssue({ code: 'custom', path: [chemin], message: `« ${k} » apparaît deux fois.` });
        vus.add(k);
      }
    };
    uniques(s.devices, (d) => d.stableId, 'devices');
    uniques(s.spawnPoints, (p) => p.id, 'spawnPoints');
    uniques(s.verseModules, (m) => m.name, 'verseModules');
    uniques(s.testRequirements, (t) => t.id, 'testRequirements');

    if (!s.spawnPoints.some((p) => p.kind === 'player')) {
      ctx.addIssue({ code: 'custom', path: ['spawnPoints'], message: 'Il faut au moins un point d’apparition joueur.' });
    }

    for (const e of s.enemies) {
      for (const v of e.waves) {
        if (v.round > s.rounds.count) {
          ctx.addIssue({
            code: 'custom',
            path: ['enemies'],
            message: `La vague de la manche ${v.round} dépasse le nombre de manches (${s.rounds.count}).`,
          });
        }
      }
    }

    const noms = new Set(s.verseModules.map((m) => m.name));
    for (const m of s.verseModules) {
      for (const d of m.dependsOn) {
        if (!noms.has(d)) {
          ctx.addIssue({ code: 'custom', path: ['verseModules'], message: `${m.name} dépend de ${d}, qui n’existe pas.` });
        }
      }
    }

    if (s.currency.enabled && s.currency.earnRules.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['currency'], message: 'Une monnaie activée doit avoir au moins une règle de gain.' });
    }
  });

export type GameSpec = z.infer<typeof gameSpecSchema>;

/** Lit un GameSpec stocké. Refuse une version de schéma inconnue au lieu de la deviner. */
export function lireGameSpec(brut: unknown): { ok: true; spec: GameSpec } | { ok: false; erreurs: string[] } {
  const r = gameSpecSchema.safeParse(brut);
  if (r.success) return { ok: true, spec: r.data };
  return {
    ok: false,
    erreurs: r.error.issues.map((i) => `${i.path.join('.') || 'racine'} : ${i.message}`),
  };
}

/** Champs modifiés entre deux versions, pour l'historique et la comparaison. */
export function differences(avant: GameSpec, apres: GameSpec): string[] {
  const cles = Object.keys(apres) as (keyof GameSpec)[];
  return cles.filter(
    (k) => k !== 'version' && JSON.stringify(avant[k]) !== JSON.stringify(apres[k]),
  );
}
