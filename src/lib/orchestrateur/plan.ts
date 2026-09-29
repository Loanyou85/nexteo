import type { GameSpec } from '@/lib/gamespec/schema';
import { ECHELLE_UNITE_LUF, IDENTITE_LUF, luf, translaterLUF, type LUFVector } from '@/lib/uefn/coordinates';

/**
 * GameSpec → BuildPlan (section 8).
 *
 * Construction DÉTERMINISTE, sans LLM (DECISIONS n° 9) : chaque tâche porte
 * une clé stable dérivée du GameSpec. C'est elle qui rend la reprise
 * idempotente — relancer le plan après une interruption retrouve les mêmes
 * clés, et chaque exécutant vérifie l'existence avant de créer.
 *
 * Les tâches sont regroupées en ÉTAPES pour la console : c'est la liste
 * lisible de la section 25, chaque étape dépliable en ses tâches.
 */

export type TypeTache =
  | 'verify.plan'
  | 'project.create'
  | 'entity.create'
  | 'device.place'
  | 'device.configure'
  | 'verse.write'
  | 'ui.build'
  | 'verse.compile'
  | 'session.start'
  | 'session.test'
  | 'session.stop'
  | 'error.analyze'
  | 'fix.apply'
  | 'verify.prepublish';

export const ETAPES = [
  { cle: 'plan', libelle: 'Plan de map vérifié' },
  { cle: 'projet', libelle: 'Projet créé' },
  { cle: 'environnement', libelle: 'Environnement construit' },
  { cle: 'apparitions', libelle: 'Système d’apparition' },
  { cle: 'zombies', libelle: 'Système de zombies' },
  { cle: 'regles', libelle: 'Manches, score et boutique' },
  { cle: 'verse', libelle: 'Verse généré' },
  { cle: 'compilation', libelle: 'Verse compilé' },
  { cle: 'playtest', libelle: 'Playtest' },
  { cle: 'debogage', libelle: 'Débogage' },
  { cle: 'validation', libelle: 'Validation finale' },
] as const;

export type CleEtape = (typeof ETAPES)[number]['cle'];

export type TacheInitiale = {
  key: string;
  type: TypeTache;
  etape: CleEtape;
  description: string;
  dependsOn: string[];
  input: Record<string, unknown>;
  order: number;
  maxAttempts: number;
};

export type Environnement = { zones: string[]; anchors: Record<string, { left: number; up: number; forward: number }> };

/**
 * Ce dont dépend chaque module Verse. Une mise à jour ne régénère un module
 * que si l'une de ces données a changé (section 21 : ne jamais tout refaire).
 */
const DEPENDANCES_MODULE: Record<string, (s: GameSpec) => unknown> = {
  round_manager: (s) => [s.rounds, s.devices.filter((d) => d.need === 'round_timer').map((d) => d.stableId)],
  zombie_spawner: (s) => [s.enemies, s.devices.filter((d) => d.need === 'enemy_spawn' || d.need === 'boss_spawn').map((d) => d.stableId)],
  currency_system: (s) => s.currency,
  hud_manager: (s) => s.ui,
  game_manager: (s) => [s.playerCount, s.loseConditions],
};

/** Empreinte stable des données d'un module (djb2 sur le JSON). */
export function empreinteModule(spec: GameSpec, module: string): string {
  const texte = JSON.stringify(DEPENDANCES_MODULE[module]?.(spec) ?? spec);
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/** Espacement entre deux devices d'une même zone, en centimètres. */
const PAS = 300;

function etapeDuDevice(need: string): CleEtape {
  if (need === 'player_spawn') return 'apparitions';
  if (need === 'enemy_spawn' || need === 'boss_spawn') return 'zombies';
  return 'regles';
}

export function construirePlan(spec: GameSpec, env: Environnement): TacheInitiale[] {
  const taches: TacheInitiale[] = [];
  let ordre = 0;
  const ajouter = (t: Omit<TacheInitiale, 'order' | 'maxAttempts'> & { maxAttempts?: number }) => {
    taches.push({ maxAttempts: 3, ...t, order: ordre++ });
    return t.key;
  };

  const plan = ajouter({ key: 'plan', type: 'verify.plan', etape: 'plan', description: 'Vérifier le plan contre le catalogue de devices', dependsOn: [], input: {} });
  const projet = ajouter({ key: 'projet', type: 'project.create', etape: 'projet', description: `Créer le projet « ${spec.title} »`, dependsOn: [plan], input: { name: spec.title } });

  // Zones réellement utilisées par le plan, dans l'ordre du template.
  const utilisees = new Set([...spec.devices.map((d) => d.zone), ...spec.spawnPoints.map((p) => p.zone), ...spec.shops.map((s) => s.location)]);
  const zones = env.zones.filter((z) => utilisees.has(z));
  const origine = (z: string): LUFVector => {
    const a = env.anchors[z] ?? { left: 0, up: 0, forward: 0 };
    return luf(a.left, a.up, a.forward);
  };

  for (const z of zones) {
    ajouter({
      key: `zone:${z}`,
      type: 'entity.create',
      etape: 'environnement',
      description: `Construire la zone ${z}`,
      dependsOn: [projet],
      input: {
        stableId: `zone_${z}`,
        name: z,
        transform: { position: origine(z), rotation: IDENTITE_LUF, scale: ECHELLE_UNITE_LUF },
        components: [{ type: 'mesh_component', properties: { preset: `${spec.environment}_${z}` } }],
      },
    });
  }

  const parZone: Record<string, number> = {};
  const configurations: string[] = [];
  for (const d of spec.devices) {
    const i = (parZone[d.zone] = (parZone[d.zone] ?? -1) + 1);
    const position = translaterLUF(origine(d.zone), (i % 4) * PAS - PAS, 0, Math.floor(i / 4) * PAS + PAS);
    const etape = etapeDuDevice(d.need);
    const place = ajouter({
      key: `device:${d.stableId}`,
      type: 'device.place',
      etape,
      description: `Placer ${d.deviceType} « ${d.stableId} »`,
      dependsOn: zones.includes(d.zone) ? [projet, `zone:${d.zone}`] : [projet],
      input: { deviceType: d.deviceType, label: d.stableId, position },
    });
    configurations.push(
      ajouter({
        key: `config:${d.stableId}`,
        type: 'device.configure',
        etape,
        description: `Configurer « ${d.stableId} »`,
        dependsOn: [place],
        input: { label: d.stableId, properties: d.properties },
      }),
    );
  }

  const ecritures = spec.verseModules.map((m) =>
    ajouter({
      key: `verse:${m.name}`,
      type: m.name === 'hud_manager' ? 'ui.build' : 'verse.write',
      etape: 'verse',
      description: m.name === 'hud_manager' ? `Construire le HUD (${m.name}.verse)` : `Écrire ${m.name}.verse`,
      dependsOn: [projet],
      input: { module: m.name, path: `${m.name}.verse`, responsibility: m.responsibility, empreinte: empreinteModule(spec, m.name) },
    }),
  );

  const compile = ajouter({
    key: 'compile',
    type: 'verse.compile',
    etape: 'compilation',
    description: 'Compiler le Verse',
    dependsOn: [...ecritures, ...configurations],
    input: {},
    maxAttempts: 6,
  });
  const demarrer = ajouter({ key: 'playtest:start', type: 'session.start', etape: 'playtest', description: 'Lancer le playtest', dependsOn: [compile], input: {} });
  const tester = ajouter({ key: 'playtest:test', type: 'session.test', etape: 'playtest', description: 'Jouer et vérifier les tests générés', dependsOn: [demarrer], input: {}, maxAttempts: 6 });
  const arreter = ajouter({ key: 'playtest:stop', type: 'session.stop', etape: 'playtest', description: 'Arrêter le playtest', dependsOn: [tester], input: {} });
  ajouter({ key: 'prepublication', type: 'verify.prepublish', etape: 'validation', description: 'Vérification de pré-publication', dependsOn: [arreter], input: {} });

  return taches;
}

/** Une tâche est exécutable quand toutes ses dépendances sont faites. */
export function prochaineTache<T extends { key: string; status: string; dependsOn: string[]; order: number }>(taches: T[]): T | null {
  const faites = new Set(taches.filter((t) => t.status === 'done' || t.status === 'skipped').map((t) => t.key));
  return (
    taches
      .filter((t) => t.status === 'pending' && t.dependsOn.every((d) => faites.has(d)))
      .sort((a, b) => a.order - b.order)[0] ?? null
  );
}
