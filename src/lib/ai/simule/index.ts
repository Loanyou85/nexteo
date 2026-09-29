import { estimerJetons } from '@/lib/ai/tarifs';
import {
  SortieInvalide,
  type AIProvider,
  type Analyse,
  type ErreurAAnalyser,
  type RequeteCode,
  type RequeteStructuree,
  type RequeteTexte,
  type Resultat,
  type Usage,
} from '@/lib/ai/types';
import { specZombie } from '@/lib/gamespec/modeles';
import { ENVIRONNEMENTS, type GameSpec } from '@/lib/gamespec/schema';
import { genererModule, USINGS } from '@/lib/ai/simule/verse';
import type { Parametres } from '@/lib/gamespec/parametres';

/**
 * IA simulée : déterministe, gratuite, et TOUJOURS annoncée comme telle.
 *
 * Elle répond aux mêmes opérations que le vrai modèle, pour que tout le
 * produit fonctionne sans clé. Son usage en jetons est ESTIMÉ à partir de la
 * longueur des échanges et marqué simulé : il fait tourner la chaîne de
 * crédits, mais n'entre jamais dans les mesures de coût réel.
 */

export const MODELE_SIMULE = 'claude-opus-5-5';

function usage(entree: string, sortie: string): Usage {
  return {
    model: MODELE_SIMULE,
    // Un vrai appel porte un prompt système et un contexte bien plus longs que
    // le message utile : le facteur rapproche l'estimation d'un appel réel.
    inputTokens: estimerJetons(entree) * 6,
    outputTokens: estimerJetons(sortie),
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

export type DonneesPlan = { idee: string; titre: string; gameId: string };
export type DonneesMiseAJour = { parametres: Parametres; demande: string };
export type DonneesModule = { spec: GameSpec; module: string; premiere: boolean };

const MOTS_ENVIRONNEMENT: [RegExp, GameSpec['environment']][] = [
  [/h[oô]pital|clinique|urgences/i, 'hopital'],
  [/prison|p[ée]nitencier/i, 'prison'],
  [/base militaire|caserne|bunker/i, 'base_militaire'],
  [/[iî]le|plage|jungle/i, 'ile'],
  [/entrep[oô]t|hangar/i, 'entrepot'],
  [/ar[eè]ne/i, 'arene'],
  [/laboratoire|labo\b/i, 'laboratoire'],
  [/circuit|course/i, 'circuit'],
  [/ville|rue|quartier/i, 'ville'],
];

/** Lit ce qu'une phrase d'idée dit explicitement. Ne devine rien d'autre. */
export function lireIdee(idee: string) {
  const joueurs = /(\d{1,2})\s*joueurs?/i.exec(idee)?.[1];
  const manches = /(\d{1,3})\s*(manches?|vagues?)/i.exec(idee)?.[1];
  const boss =
    /boss[^.\d]{0,40}(?:manche|vague)\s*(\d{1,3})/i.exec(idee)?.[1] ??
    /(?:manche|vague)\s*(\d{1,3})[^.]{0,40}boss/i.exec(idee)?.[1];
  const sansBoss = /sans boss/i.test(idee);
  const env = MOTS_ENVIRONNEMENT.find(([re]) => re.test(idee))?.[1];
  return {
    playerCount: joueurs ? Math.min(Math.max(Number(joueurs), 1), 16) : undefined,
    rounds: manches ? Math.min(Math.max(Number(manches), 1), 50) : undefined,
    bossRound: sansBoss ? null : boss ? Number(boss) : undefined,
    environment: env,
  };
}

function planDepuisIdee(d: DonneesPlan): GameSpec {
  const lu = lireIdee(d.idee);
  const rounds = lu.rounds ?? 10;
  const bossRound = lu.bossRound === undefined ? rounds : lu.bossRound !== null ? Math.min(lu.bossRound, rounds) : null;
  const env = lu.environment && (ENVIRONNEMENTS as readonly string[]).includes(lu.environment) ? lu.environment : 'hopital';
  return specZombie({
    gameId: d.gameId,
    title: d.titre,
    playerCount: lu.playerCount,
    rounds,
    bossRound,
    environment: env,
    description: `${d.idee.trim().replace(/\s+/g, ' ').slice(0, 400)}`,
  });
}

/**
 * Mise à jour demandée en langage courant → nouveaux paramètres. Ne touche
 * qu'à ce que la phrase nomme : « rends les zombies plus rapides » ne change
 * ni les manches ni la monnaie.
 */
export function appliquerDemande(p: Parametres, demande: string): Parametres {
  const n = { ...p, ui: { ...p.ui } };
  const lu = lireIdee(demande);
  if (lu.bossRound !== undefined) n.bossRound = lu.bossRound ?? 0;
  if (lu.playerCount) n.playerCount = lu.playerCount;
  if (lu.rounds) n.rounds = lu.rounds;
  if (lu.environment) n.environment = lu.environment;
  if (n.bossRound > n.rounds) n.rounds = n.bossRound;
  if (/plus rapides?|acc[ée]l[èe]re/i.test(demande)) n.zombieSpeed = Math.min(5, Math.round(p.zombieSpeed * 13) / 10);
  if (/plus lents?|ralenti/i.test(demande)) n.zombieSpeed = Math.max(0.1, Math.round((p.zombieSpeed / 1.3) * 10) / 10);
  if (/plus (r[ée]sistants?|costauds?|solides?)/i.test(demande)) n.zombieHealth = Math.min(10_000, Math.round(p.zombieHealth * 1.5));
  if (/classement|leaderboard/i.test(demande)) n.ui.leaderboard = true;
  const gain = /(\d{1,5})\s*(?:d['’])?(?:or|pi[èe]ces?)\s*par\s*[ée]limination/i.exec(demande)?.[1];
  if (gain) n.rewardElimination = Number(gain);
  return n;
}

function distance(a: string, b: string): number {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i]![j] = Math.min(m[i - 1]![j]! + 1, m[i]![j - 1]! + 1, m[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return m[a.length]![b.length]!;
}

/** Identifiants d'API qui exigent un `using` précis. */
const USING_REQUIS: Record<string, string> = {
  Print: USINGS.USING_DIAGNOSTICS,
  Sleep: USINGS.USING_SIMULATION,
};

/** Corrige un fichier à partir d'une erreur analysée. Rend le contenu inchangé s'il ne sait pas. */
export function corriger(contenu: string, erreur: ErreurAAnalyser): string {
  const ident = /`([^`]+)`/.exec(erreur.brut)?.[1];

  if (ident && USING_REQUIS[ident] && !contenu.includes(USING_REQUIS[ident]!)) {
    const lignes = contenu.split('\n');
    const dernierUsing = lignes.reduce((k, l, i) => (l.startsWith('using ') ? i : k), -1);
    lignes.splice(dernierUsing + 1, 0, USING_REQUIS[ident]!);
    return lignes.join('\n');
  }

  if (ident) {
    const definies = [...contenu.matchAll(/^\s*([A-Z][A-Za-z0-9]*)\s*\(/gm)]
      .map((x) => x[1]!)
      .filter((n) => n !== ident);
    const proche = definies
      .map((n) => ({ n, d: distance(n, ident) }))
      .filter((x) => x.d <= 2)
      .sort((a, b) => a.d - b.d)[0];
    if (proche) return contenu.replace(new RegExp(`\\b${ident}\\(`, 'g'), `${proche.n}(`);
  }

  if (erreur.categorie === 'gameplay_error' && /currency|or\b|monnaie/i.test(erreur.brut)) {
    return contenu
      .replace(/^\s*# Gain calculé mais jamais crédité au joueur\.\n/m, '')
      .replace(/^(\s*)Reward := RewardPerElimination$/m, '$1set Gold += RewardPerElimination');
  }

  return contenu;
}

export class IASimulee implements AIProvider {
  readonly nom = 'simule' as const;

  async generate(req: RequeteTexte): Promise<Resultat<string>> {
    const texte = 'Réponse de l’IA simulée.';
    return { valeur: texte, usage: usage(req.message, texte) };
  }

  async *stream(req: RequeteTexte): AsyncIterable<string> {
    yield (await this.generate(req)).valeur;
  }

  async structuredOutput<T>(req: RequeteStructuree<T>): Promise<Resultat<T>> {
    let brut: unknown;
    if (req.nomSchema === 'GameSpec') brut = planDepuisIdee(req.simulation as DonneesPlan);
    else if (req.nomSchema === 'Parametres') {
      const d = req.simulation as DonneesMiseAJour;
      brut = appliquerDemande(d.parametres, d.demande);
    } else throw new SortieInvalide([`L’IA simulée ne sait pas produire « ${req.nomSchema} ».`]);

    const verif = req.schema.safeParse(brut);
    if (!verif.success) throw new SortieInvalide(verif.error.issues.map((i) => i.message));
    return { valeur: verif.data, usage: usage(req.message, JSON.stringify(brut)) };
  }

  async analyze(erreur: ErreurAAnalyser): Promise<Resultat<Analyse>> {
    const ident = /`([^`]+)`/.exec(erreur.brut)?.[1];
    const a: Analyse =
      erreur.categorie === 'gameplay_error'
        ? {
            cause: 'L’assertion de gameplay échoue : l’état observé dans les logs ne change pas comme attendu.',
            fichier: erreur.fichier,
            strategie: 'Relire le gestionnaire concerné et y appliquer l’effet manquant, sans toucher au reste.',
          }
        : ident && USING_REQUIS[ident]
          ? {
              cause: `\`${ident}\` est une fonction d’API dont le module n’est pas importé.`,
              fichier: erreur.fichier,
              strategie: `Ajouter ${USING_REQUIS[ident]} en tête du fichier.`,
            }
          : {
              cause: ident
                ? `\`${ident}\` n’est défini nulle part : probablement une faute de frappe sur une fonction existante.`
                : 'Erreur de compilation sans identifiant cité.',
              fichier: erreur.fichier,
              strategie: ident
                ? 'Remplacer l’appel par la fonction définie la plus proche.'
                : 'Relire la ligne indiquée.',
            };
    return { valeur: a, usage: usage(erreur.brut + (erreur.contenuFichier ?? ''), JSON.stringify(a)) };
  }

  async codeGeneration(req: RequeteCode): Promise<Resultat<string>> {
    if (req.intention === 'module') {
      const d = req.simulation as DonneesModule;
      const contenu = genererModule(d.spec, d.module, d.premiere);
      return { valeur: contenu, usage: usage(req.consigne + req.contexte, contenu) };
    }
    const contenu = req.erreur && req.contenuActuel ? corriger(req.contenuActuel, req.erreur) : (req.contenuActuel ?? '');
    return { valeur: contenu, usage: usage((req.contenuActuel ?? '') + (req.erreur?.brut ?? ''), contenu) };
  }
}
