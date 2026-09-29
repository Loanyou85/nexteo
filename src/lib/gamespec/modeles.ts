import { SPEC_VERSION, type GameSpec, type Genre } from '@/lib/gamespec/schema';

/**
 * Modèles de départ des templates (section 7).
 *
 * Ils servent à semer la base — c'est la base qui fait foi ensuite, et
 * l'administration qui les modifie. Le seul modèle entièrement détaillé est
 * la survie zombie : c'est le scénario de référence (section 33), et aucun
 * autre genre n'est activé tant qu'il n'est pas fiable dix fois de suite.
 */

export type OptionsZombie = {
  gameId: string;
  title?: string;
  description?: string;
  playerCount?: number;
  rounds?: number;
  bossRound?: number | null;
  environment?: GameSpec['environment'];
};

export function specZombie(o: OptionsZombie): GameSpec {
  const joueurs = o.playerCount ?? 4;
  const manches = o.rounds ?? 10;
  const boss = o.bossRound === undefined ? manches : o.bossRound;
  const vagues = Array.from({ length: manches }, (_, i) => ({
    round: i + 1,
    count: 8 + i * 4,
    boss: false,
  }));

  return {
    gameId: o.gameId,
    version: 1,
    specVersion: SPEC_VERSION,
    genre: 'zombie_survival',
    title: o.title ?? 'Zombie Hospital',
    description:
      o.description ??
      `Survie coopérative à ${joueurs} joueurs dans un hôpital envahi. Tenir ${manches} manches de zombies de plus en plus nombreux, gagner de l'or à chaque élimination, s'équiper entre les manches.`,
    playerCount: joueurs,
    mapSize: 'medium',
    environment: o.environment ?? 'hopital',
    gameplayLoop: [
      'Les joueurs apparaissent dans le hall',
      'Une vague de zombies attaque',
      'Chaque élimination rapporte de l’or',
      'Entre deux manches, les joueurs s’équipent au distributeur',
      'La vague suivante est plus nombreuse',
    ],
    objectives: [`Survivre aux ${manches} manches`, ...(boss ? [`Éliminer le boss de la manche ${boss}`] : [])],
    rounds: { count: manches, durationSeconds: 120, betweenRoundsSeconds: 20 },
    enemies: [
      { type: 'Zombie', health: 100, speed: 1, spawnRate: 12, waves: vagues },
      ...(boss
        ? [{ type: 'Zombie colosse', health: 2500, speed: 0.8, spawnRate: 1, waves: [{ round: boss, count: 1, boss: true }] }]
        : []),
    ],
    weapons: [
      { type: 'Pistolet', damage: 24, availability: 'start' as const },
      { type: 'Fusil à pompe', damage: 90, availability: 'shop' as const },
      { type: 'Fusil d’assaut', damage: 32, availability: 'shop' as const },
    ],
    currency: {
      enabled: true,
      name: 'Or',
      earnRules: [
        { event: 'elimination' as const, amount: 10 },
        { event: 'round_complete' as const, amount: 50 },
        ...(boss ? [{ event: 'boss_elimination' as const, amount: 500 }] : []),
      ],
    },
    shops: [
      {
        location: 'hall',
        inventory: [
          { item: 'Fusil à pompe', price: 300 },
          { item: 'Fusil d’assaut', price: 450 },
          { item: 'Soins', price: 100 },
        ],
      },
    ],
    progression: { enabled: false, levels: [], unlocks: [] },
    ui: { score: true, health: true, currency: true, timer: true, round: true, objectives: true, leaderboard: false },
    audio: { music: 'ambiance_tension', sfx: ['vague_debut', 'elimination', 'achat'] },
    vfx: ['apparition_zombie'],
    winConditions: [{ type: 'survive_rounds' as const, value: manches, description: `Survivre aux ${manches} manches` }],
    loseConditions: [{ type: 'all_eliminated' as const, description: 'Tous les joueurs sont éliminés' }],
    spawnPoints: [
      { id: 'hall_joueurs', kind: 'player' as const, zone: 'hall', count: joueurs },
      { id: 'urgences_zombies', kind: 'enemy' as const, zone: 'urgences', count: 2 },
      { id: 'bloc_zombies', kind: 'enemy' as const, zone: 'bloc_operatoire', count: 2 },
      { id: 'parking_zombies', kind: 'enemy' as const, zone: 'parking', count: 2 },
      ...(boss ? [{ id: 'morgue_boss', kind: 'boss' as const, zone: 'morgue', count: 1 }] : []),
    ],
    checkpoints: [],
    devices: [
      ...Array.from({ length: joueurs }, (_, i) => ({
        stableId: `joueur_apparition_${i + 1}`,
        need: 'player_spawn',
        deviceType: 'player_spawner_device',
        zone: 'hall',
        properties: { team: 1 },
      })),
      { stableId: 'zombies_urgences', need: 'enemy_spawn', deviceType: 'creature_spawner_device', zone: 'urgences', properties: { creature_type: 'zombie', max_spawned: 12 } },
      { stableId: 'zombies_bloc', need: 'enemy_spawn', deviceType: 'creature_spawner_device', zone: 'bloc_operatoire', properties: { creature_type: 'zombie', max_spawned: 12 } },
      { stableId: 'zombies_parking', need: 'enemy_spawn', deviceType: 'creature_spawner_device', zone: 'parking', properties: { creature_type: 'zombie', max_spawned: 12 } },
      ...(boss
        ? [{ stableId: 'boss_morgue', need: 'boss_spawn', deviceType: 'creature_spawner_device', zone: 'morgue', properties: { creature_type: 'brute', max_spawned: 1, health_multiplier: 25 } }]
        : []),
      { stableId: 'minuteur_manche', need: 'round_timer', deviceType: 'timer_device', zone: 'hall', properties: { duration: 120 } },
      { stableId: 'reglages_manches', need: 'round_settings', deviceType: 'round_settings_device', zone: 'hall', properties: { rounds: manches } },
      { stableId: 'gestion_eliminations', need: 'elimination_tracking', deviceType: 'elimination_manager_device', zone: 'hall', properties: {} },
      { stableId: 'score', need: 'score', deviceType: 'score_manager_device', zone: 'hall', properties: { score_per_elimination: 10 } },
      { stableId: 'hud_messages', need: 'hud_message', deviceType: 'hud_message_device', zone: 'hall', properties: {} },
      { stableId: 'armes_depart', need: 'weapon_grant', deviceType: 'item_granter_device', zone: 'hall', properties: { item: 'Pistolet' } },
      { stableId: 'distributeur_hall', need: 'shop', deviceType: 'vending_machine_device', zone: 'hall', properties: { currency: 'gold' } },
      { stableId: 'fin_de_partie', need: 'end_game', deviceType: 'end_game_device', zone: 'hall', properties: {} },
    ],
    verseModules: [
      { name: 'round_manager', responsibility: 'Enchaîne les manches, leur minuteur et la condition de victoire', dependsOn: [] },
      { name: 'zombie_spawner', responsibility: 'Fait apparaître les vagues et le boss selon la manche', dependsOn: ['round_manager'] },
      { name: 'currency_system', responsibility: 'Crédite l’or à chaque élimination et en fin de manche', dependsOn: [] },
      { name: 'hud_manager', responsibility: 'Affiche manche, minuteur, or, score, santé et objectifs', dependsOn: ['round_manager', 'currency_system'] },
      { name: 'game_manager', responsibility: 'Point d’entrée : relie les modules et gère la fin de partie', dependsOn: ['round_manager', 'zombie_spawner', 'currency_system', 'hud_manager'] },
    ],
    testRequirements: [
      { id: 'manche_demarre', description: 'La manche 1 démarre quand un joueur rejoint', kind: 'round_starts' as const, param: 1, severity: 'blocking' as const },
      { id: 'joueurs_apparaissent', description: `Les ${joueurs} joueurs apparaissent dans le hall`, kind: 'players_spawn' as const, param: joueurs, severity: 'blocking' as const },
      { id: 'zombies_apparaissent', description: 'Des zombies apparaissent à la manche 1', kind: 'enemies_spawn' as const, param: 1, severity: 'blocking' as const },
      { id: 'elimination_rapporte', description: 'Éliminer un zombie augmente l’or', kind: 'elimination_rewards' as const, severity: 'blocking' as const },
      ...(boss
        ? [{ id: 'boss_apparait', description: `Le boss apparaît à la manche ${boss}`, kind: 'boss_appears' as const, param: boss, severity: 'blocking' as const }]
        : []),
      { id: 'hud_pret', description: 'Le HUD affiche ses éléments', kind: 'hud_ready' as const, severity: 'warning' as const },
      { id: 'victoire_atteignable', description: `Survivre à la manche ${manches} déclenche la victoire`, kind: 'win_reachable' as const, param: manches, severity: 'blocking' as const },
      { id: 'defaite_possible', description: 'L’élimination de tous les joueurs termine la partie', kind: 'lose_possible' as const, severity: 'warning' as const },
    ],
    performanceRequirements: { maxSimultaneousEnemies: 60, maxDevices: 120 },
  };
}

/** Modèle minimal valide pour un genre dont le template n'est pas encore activé. */
export function specGenerique(genre: Genre, titre: string, environment: GameSpec['environment']): GameSpec {
  const base = specZombie({ gameId: `modele_${genre}`, title: titre, environment, bossRound: null });
  return {
    ...base,
    genre,
    description: `Modèle de départ « ${titre} ». Pas encore activé : il le sera quand le scénario de référence sera fiable.`,
  };
}
