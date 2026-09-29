import type { GameSpec } from '@/lib/gamespec/schema';

/**
 * Générateur de Verse de l'IA simulée.
 *
 * Il produit du Verse plausible pour les modules du scénario de référence.
 * À la PREMIÈRE écriture, il reproduit trois défauts typiques d'un modèle
 * réel — une faute de frappe dans un appel, un `using` oublié, un gain de
 * monnaie jamais crédité. C'est volontaire : une IA simulée qui ne se trompe
 * jamais ne testerait ni le parseur d'erreurs, ni la boucle de correction,
 * ni les tests de gameplay. Chaque défaut est détecté par une vérification
 * réelle (compilateur simulé ou assertion sur les logs), jamais annoncé.
 */

const USING_DEVICES = 'using { /Fortnite.com/Devices }';
const USING_SIMULATION = 'using { /Verse.org/Simulation }';
const USING_DIAGNOSTICS = 'using { /UnrealEngine.com/Temporary/Diagnostics }';

function entete(usings: string[]): string {
  return usings.join('\n') + '\n';
}

function devicesDe(spec: GameSpec, need: string) {
  return spec.devices.filter((d) => d.need === need);
}

function nomEditable(stableId: string): string {
  // joueur_apparition_1 → JoueurApparition1 : convention PascalCase de Verse.
  return stableId
    .split('_')
    .map((m) => (m ? m[0]!.toUpperCase() + m.slice(1) : m))
    .join('');
}

export function roundManager(spec: GameSpec): string {
  const timer = devicesDe(spec, 'round_timer')[0];
  return `${entete([USING_DEVICES, USING_SIMULATION, USING_DIAGNOSTICS])}
# Enchaîne les manches et déclenche la victoire.
round_manager := class(creative_device):

    @editable
    ${nomEditable(timer?.stableId ?? 'minuteur_manche')} : timer_device = timer_device{}

    @editable
    RoundCount : int = ${spec.rounds.count}

    @editable
    RoundDurationSeconds : float = ${spec.rounds.durationSeconds}.0

    var CurrentRound : int = 0

    OnBegin<override>()<suspends> : void =
        Print("[NX] game_started")
        RunRounds()

    RunRounds()<suspends> : void =
        loop:
            if (CurrentRound >= RoundCount):
                Print("[NX] win_condition=survive_rounds")
                break
            set CurrentRound += 1
            Print("[NX] round={CurrentRound}")
            ${nomEditable(timer?.stableId ?? 'minuteur_manche')}.Start()
            Sleep(RoundDurationSeconds)
`;
}

export function zombieSpawner(spec: GameSpec, avecDefaut: boolean): string {
  const spawners = devicesDe(spec, 'enemy_spawn');
  const boss = devicesDe(spec, 'boss_spawn')[0];
  const bossRound = spec.enemies.flatMap((e) => e.waves).find((v) => v.boss)?.round ?? 0;
  const appel = avecDefaut ? 'SpawnZombi' : 'SpawnZombie';
  return `${entete([USING_DEVICES, USING_SIMULATION, USING_DIAGNOSTICS])}
# Fait apparaître les vagues de zombies, et le boss à sa manche.
zombie_spawner := class(creative_device):

${spawners
  .map((d) => `    @editable\n    ${nomEditable(d.stableId)} : creature_spawner_device = creature_spawner_device{}\n`)
  .join('\n')}${
    boss
      ? `
    @editable
    ${nomEditable(boss.stableId)} : creature_spawner_device = creature_spawner_device{}
`
      : ''
  }
    @editable
    BossRound : int = ${bossRound}

    SpawnWave(Round : int) : void =
        Count := ${8} + (Round - 1) * ${4}
        ${appel}(Round, Count)
        if (Round = BossRound):
            Print("[NX] boss_spawned round={Round}")

    SpawnZombie(Round : int, Count : int) : void =
${spawners.map((d) => `        ${nomEditable(d.stableId)}.Enable()`).join('\n')}
        Print("[NX] enemies_spawned round={Round} count={Count}")
`;
}

export function currencySystem(spec: GameSpec, avecDefaut: boolean): string {
  const gain = spec.currency.earnRules.find((r) => r.event === 'elimination')?.amount ?? 10;
  const credit = avecDefaut
    ? '        # Gain calculé mais jamais crédité au joueur.\n        Reward := RewardPerElimination'
    : '        set Gold += RewardPerElimination';
  return `${entete([USING_DEVICES, USING_SIMULATION, USING_DIAGNOSTICS])}
# Crédite l'or à chaque élimination et en fin de manche.
currency_system := class(creative_device):

    @editable
    GestionEliminations : elimination_manager_device = elimination_manager_device{}

    @editable
    RewardPerElimination : int = ${gain}

    var Gold : int = 0

    OnBegin<override>()<suspends> : void =
        GestionEliminations.EliminatedEvent.Subscribe(OnElimination)

    OnElimination(Agent : ?agent) : void =
        Print("[NX] currency_before={Gold}")
${credit}
        Print("[NX] currency_after={Gold}")
`;
}

export function hudManager(spec: GameSpec, avecDefaut: boolean): string {
  const elements = Object.entries(spec.ui)
    .filter(([, actif]) => actif)
    .map(([nom]) => nom)
    .join(',');
  const usings = avecDefaut ? [USING_DEVICES, USING_SIMULATION] : [USING_DEVICES, USING_SIMULATION, USING_DIAGNOSTICS];
  return `${entete(usings)}
# Affiche manche, minuteur, or, score, santé et objectifs.
hud_manager := class(creative_device):

    @editable
    HudMessages : hud_message_device = hud_message_device{}

    OnBegin<override>()<suspends> : void =
        HudMessages.Show()
        Print("[NX] hud_ready elements=${elements}")
`;
}

export function gameManager(spec: GameSpec): string {
  return `${entete([USING_DEVICES, USING_SIMULATION, USING_DIAGNOSTICS])}
# Point d'entrée : relie les modules et gère la fin de partie.
game_manager := class(creative_device):

    @editable
    FinDePartie : end_game_device = end_game_device{}

    @editable
    PlayerCount : int = ${spec.playerCount}

    OnBegin<override>()<suspends> : void =
        Print("[NX] players_spawned count={PlayerCount}")

    OnAllPlayersEliminated() : void =
        Print("[NX] lose_condition=all_eliminated")
        FinDePartie.Activate()
`;
}

/** Module demandé → contenu. `premiere` : première écriture de ce fichier. */
export function genererModule(spec: GameSpec, module: string, premiere: boolean): string {
  switch (module) {
    case 'round_manager':
      return roundManager(spec);
    case 'zombie_spawner':
      return zombieSpawner(spec, premiere);
    case 'currency_system':
      return currencySystem(spec, premiere);
    case 'hud_manager':
      return hudManager(spec, premiere);
    case 'game_manager':
      return gameManager(spec);
    default:
      return `${entete([USING_DEVICES, USING_SIMULATION, USING_DIAGNOSTICS])}
# Module ${module}
${module} := class(creative_device):

    OnBegin<override>()<suspends> : void =
        Print("[NX] module_ready name=${module}")
`;
  }
}

export const USINGS = { USING_DEVICES, USING_SIMULATION, USING_DIAGNOSTICS };
