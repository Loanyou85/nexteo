import type { GameSpec } from '@/lib/gamespec/schema';
import type { LogEntry } from '@/lib/uefn/provider';

/**
 * Moteur de tests (section 17).
 *
 * Les tests sont GÉNÉRÉS depuis les exigences du GameSpec, jamais écrits à la
 * main. L'observation repose sur les lignes `[NX] cle=valeur` que l'agent
 * insère dans le Verse ; les assertions se vérifient sur les logs du client.
 *
 * Les assertions sont de petites expressions (`currency_after > currency_before`)
 * évaluées par un analyseur dédié — jamais par `eval`, qui exécuterait
 * n'importe quel texte venu d'un modèle.
 */

export type TestGenere = {
  key: string;
  description: string;
  trigger: string;
  assertion: string;
  expected: string;
  severity: 'blocking' | 'warning';
};

export function genererTests(spec: GameSpec): TestGenere[] {
  return spec.testRequirements.map((t) => {
    const base = { key: t.id, description: t.description, severity: t.severity };
    switch (t.kind) {
      case 'round_starts':
        return { ...base, trigger: 'un joueur rejoint la partie', assertion: `first_round == ${t.param ?? 1}`, expected: `manche ${t.param ?? 1}` };
      case 'players_spawn':
        return { ...base, trigger: 'début de partie', assertion: `players_spawned >= ${t.param ?? spec.playerCount}`, expected: `${t.param ?? spec.playerCount} joueurs apparus` };
      case 'enemies_spawn':
        return { ...base, trigger: `manche ${t.param ?? 1}`, assertion: `enemies_round_${t.param ?? 1} > 0`, expected: 'au moins un ennemi' };
      case 'elimination_rewards':
        return { ...base, trigger: 'une élimination', assertion: 'currency_after > currency_before', expected: 'l’or augmente' };
      case 'boss_appears':
        return { ...base, trigger: `manche ${t.param}`, assertion: `boss_round == ${t.param}`, expected: `boss à la manche ${t.param}` };
      case 'hud_ready':
        return { ...base, trigger: 'début de partie', assertion: 'hud_ready == true', expected: 'HUD affiché' };
      case 'win_reachable':
        return { ...base, trigger: `fin de la manche ${t.param ?? spec.rounds.count}`, assertion: `win_after_round == ${t.param ?? spec.rounds.count}`, expected: 'victoire déclenchée' };
      case 'lose_possible':
        return { ...base, trigger: 'tous les joueurs éliminés', assertion: 'lose_handler == true', expected: 'défaite déclenchée' };
    }
  });
}

export type Mesures = Record<string, number | boolean>;

/** Extrait les mesures des lignes `[NX] …` d'une partie. */
export function mesurer(logs: LogEntry[]): { mesures: Mesures; preuves: Record<string, string[]> } {
  const m: Mesures = {};
  const preuves: Record<string, string[]> = {};
  const noter = (cle: string, ligne: string) => {
    (preuves[cle] ??= []).push(ligne);
  };
  let derniereManche = 0;

  for (const l of logs) {
    const i = l.text.indexOf('[NX] ');
    if (i < 0) continue;
    const corps = l.text.slice(i + 5).trim();
    const champs = Object.fromEntries(
      corps.split(/\s+/).flatMap((p) => {
        const [k, v] = p.split('=');
        return k && v !== undefined ? [[k, v]] : [[k ?? p, 'true']];
      }),
    );

    if ('game_started' in champs) m.game_started = true;
    if ('players_spawned' in champs) {
      m.players_spawned = Number(champs.count ?? 0);
      noter('players_spawned', l.text);
    }
    if ('round' in champs && !('enemies_spawned' in champs) && !('boss_spawned' in champs)) {
      const r = Number(champs.round);
      derniereManche = r;
      if (m.first_round === undefined) m.first_round = r;
      m.last_round = r;
      noter('first_round', l.text);
    }
    if ('enemies_spawned' in champs) {
      m[`enemies_round_${champs.round}`] = Number(champs.count ?? 0);
      noter(`enemies_round_${champs.round}`, l.text);
    }
    if ('boss_spawned' in champs) {
      m.boss_round = Number(champs.round);
      noter('boss_round', l.text);
    }
    if ('currency_before' in champs && m.currency_before === undefined) {
      m.currency_before = Number(champs.currency_before);
      noter('currency_before', l.text);
    }
    if ('currency_after' in champs && m.currency_after === undefined) {
      m.currency_after = Number(champs.currency_after);
      noter('currency_after', l.text);
    }
    if ('hud_ready' in champs) {
      m.hud_ready = true;
      noter('hud_ready', l.text);
    }
    if ('win_condition' in champs) {
      m.win_after_round = derniereManche;
      noter('win_after_round', l.text);
    }
    if ('lose_condition' in champs) {
      m.lose_handler = true;
      noter('lose_handler', l.text);
    }
  }
  return { mesures: m, preuves };
}

const OPERATEURS = ['==', '!=', '>=', '<=', '>', '<'] as const;
type Operateur = (typeof OPERATEURS)[number];

type Terme = { type: 'mesure'; nom: string } | { type: 'valeur'; valeur: number | boolean };

function terme(brut: string): Terme {
  const t = brut.trim();
  if (t === 'true' || t === 'false') return { type: 'valeur', valeur: t === 'true' };
  if (/^-?\d+(\.\d+)?$/.test(t)) return { type: 'valeur', valeur: Number(t) };
  if (/^[a-z][a-z0-9_]*$/.test(t)) return { type: 'mesure', nom: t };
  throw new Error(`Terme d’assertion invalide : « ${t} »`);
}

/** Analyse `gauche op droite`. Rien d'autre n'est accepté. */
export function analyserAssertion(expr: string): { gauche: Terme; op: Operateur; droite: Terme } {
  for (const op of OPERATEURS) {
    const i = expr.indexOf(` ${op} `);
    if (i > 0) return { gauche: terme(expr.slice(0, i)), op, droite: terme(expr.slice(i + op.length + 2)) };
  }
  throw new Error(`Assertion invalide : « ${expr} »`);
}

export type Verdict = { passe: boolean; observe: string; preuves: string[] };

export function evaluer(test: TestGenere, mesures: Mesures, preuves: Record<string, string[]>): Verdict {
  const a = analyserAssertion(test.assertion);
  const valeur = (t: Terme) => (t.type === 'valeur' ? t.valeur : mesures[t.nom]);
  const g = valeur(a.gauche);
  const d = valeur(a.droite);
  const nomme = (t: Terme) => (t.type === 'mesure' ? `${t.nom} = ${String(mesures[t.nom] ?? 'absent')}` : String(t.valeur));
  const observe = [a.gauche, a.droite].filter((t) => t.type === 'mesure').map(nomme).join(', ') || 'rien';
  const lignes = [a.gauche, a.droite].flatMap((t) => (t.type === 'mesure' ? (preuves[t.nom] ?? []) : []));

  // Une mesure absente n'est jamais « égale à zéro » : le test échoue, et le
  // verdict dit ce qui manque au lieu de comparer un vide.
  if (g === undefined || d === undefined) return { passe: false, observe, preuves: lignes };

  let passe: boolean;
  switch (a.op) {
    case '==':
      passe = g === d;
      break;
    case '!=':
      passe = g !== d;
      break;
    case '>':
      passe = Number(g) > Number(d);
      break;
    case '>=':
      passe = Number(g) >= Number(d);
      break;
    case '<':
      passe = Number(g) < Number(d);
      break;
    case '<=':
      passe = Number(g) <= Number(d);
      break;
  }
  return { passe, observe, preuves: lignes };
}
