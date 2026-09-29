import type { LogEntry } from '@/lib/uefn/provider';

/**
 * Exécution SIMULÉE d'une partie.
 *
 * Elle « joue » le code réellement écrit : un Print n'apparaît dans les logs
 * que s'il existe dans un module compilé, et le gain d'or n'augmente que si le
 * gestionnaire d'élimination crédite vraiment l'or. Un module absent, un
 * device manquant ou un gain oublié se voient donc dans les logs — c'est ce
 * que les tests générés vont lire.
 */

export type ContexteExecution = {
  fichiers: Record<string, string>;
  /** Types de devices réellement présents dans le projet, avec leur nombre. */
  devices: Record<string, number>;
  joueurs: number;
};

function log(text: string, level: LogEntry['level'] = 'info', t = 0): LogEntry {
  return { at: new Date(Date.UTC(2026, 0, 1, 0, 0, t)).toISOString(), level, text: `LogVerse: ${text}` };
}

function entier(contenu: string, nom: string): number | null {
  const m = new RegExp(`${nom}\\s*:\\s*(?:int|float)\\s*=\\s*(\\d+)`).exec(contenu);
  return m ? Number(m[1]) : null;
}

export function executerPartie(ctx: ContexteExecution): LogEntry[] {
  const f = ctx.fichiers;
  const logs: LogEntry[] = [log('Session started (simulated client)', 'info', 0)];
  let t = 1;

  const game = f['game_manager.verse'];
  const rounds = f['round_manager.verse'];
  const spawner = f['zombie_spawner.verse'];
  const currency = f['currency_system.verse'];
  const hud = f['hud_manager.verse'];

  if (rounds?.includes('Print("[NX] game_started")')) logs.push(log('[NX] game_started', 'info', t++));

  const apparitions = ctx.devices['player_spawner_device'] ?? 0;
  if (game?.includes('[NX] players_spawned')) {
    // Chaque joueur apparaît sur un point libre : au-delà, il n'apparaît pas.
    logs.push(log(`[NX] players_spawned count=${Math.min(ctx.joueurs, apparitions)}`, 'info', t++));
    if (apparitions < ctx.joueurs) {
      logs.push(log(`Player spawn failed: no free player_spawner_device (${apparitions} for ${ctx.joueurs} players)`, 'error', t++));
    }
  }

  if (hud?.includes('[NX] hud_ready')) {
    const el = /hud_ready elements=([a-z,]+)/.exec(hud)?.[1] ?? '';
    logs.push(log(`[NX] hud_ready elements=${el}`, 'info', t++));
  }

  const nbManches = rounds ? (entier(rounds, 'RoundCount') ?? 0) : 0;
  const bossRound = spawner ? (entier(spawner, 'BossRound') ?? 0) : 0;
  const creatures = ctx.devices['creature_spawner_device'] ?? 0;
  const gain = currency ? (entier(currency, 'RewardPerElimination') ?? 0) : 0;
  const credite = !!currency && /set Gold \+= RewardPerElimination/.test(currency);
  let or = 0;

  // La partie simulée est compressée : chaque manche dure une ligne de log.
  for (let r = 1; r <= nbManches && rounds?.includes('[NX] round='); r++) {
    logs.push(log(`[NX] round=${r}`, 'info', t++));
    if (spawner?.includes('[NX] enemies_spawned') && creatures > 0) {
      logs.push(log(`[NX] enemies_spawned round=${r} count=${8 + (r - 1) * 4}`, 'info', t++));
      if (r === bossRound && spawner.includes('[NX] boss_spawned')) logs.push(log(`[NX] boss_spawned round=${r}`, 'info', t++));
    }
    if (r === 1 && currency?.includes('[NX] currency_before')) {
      logs.push(log(`[NX] currency_before=${or}`, 'info', t++));
      if (credite) or += gain;
      logs.push(log(`[NX] currency_after=${or}`, 'info', t++));
    }
  }

  if (rounds?.includes('[NX] win_condition=survive_rounds') && nbManches > 0) {
    logs.push(log('[NX] win_condition=survive_rounds', 'info', t++));
  }
  // Dernier scénario joué : tous les joueurs éliminés, pour vérifier la défaite.
  if (game?.includes('[NX] lose_condition=all_eliminated')) logs.push(log('[NX] lose_condition=all_eliminated', 'info', t++));

  logs.push(log('Session ended (simulated client)', 'info', t++));
  return logs;
}
