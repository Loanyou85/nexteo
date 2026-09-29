/**
 * Compilateur Verse SIMULÉ.
 *
 * Il ne remplace pas le vrai compilateur : il en reproduit la forme de sortie
 * et vérifie un petit nombre de choses réelles sur le code écrit —
 * délimiteurs équilibrés, `using` requis par les API employées, appels à des
 * fonctions définies. C'est assez pour que le parseur d'erreurs et la boucle
 * de correction travaillent sur de vraies erreurs de vrais fichiers, pas sur
 * des échecs scénarisés.
 */

const USING_DEVICES = '/Fortnite.com/Devices';
const USING_SIMULATION = '/Verse.org/Simulation';
const USING_DIAGNOSTICS = '/UnrealEngine.com/Temporary/Diagnostics';

/** Fonctions d'API connues, avec le `using` qui les rend visibles. */
const API: Record<string, string | null> = {
  Print: USING_DIAGNOSTICS,
  Sleep: USING_SIMULATION,
  Start: null,
  Enable: null,
  Disable: null,
  Show: null,
  Hide: null,
  Activate: null,
  Subscribe: null,
  Spawn: null,
};

const MOTS_CLES = new Set(['if', 'loop', 'for', 'block', 'set', 'var', 'return', 'break', 'class', 'option', 'array', 'map', 'case', 'spawn', 'defer', 'race', 'sync', 'rush', 'branch', 'not', 'and', 'or', 'then', 'else']);

export type FichierSource = { path: string; content: string };

function diagnostic(prefixe: string, path: string, l: number, c1: number, c2: number, code: number, message: string) {
  return `${prefixe}/${path}(${l},${c1}, ${l},${c2}): Script error ${code}: ${message}`;
}

export function compilerSimule(fichiers: FichierSource[], racine = 'Projet'): { ok: boolean; output: string } {
  const sortie: string[] = ['Verse build started'];
  let erreurs = 0;

  // Fonctions définies dans tout le projet : `Nom(...)... :` en début de ligne.
  const definies = new Set<string>();
  for (const f of fichiers) {
    for (const m of f.content.matchAll(/^\s*([A-Z][A-Za-z0-9_]*)\s*(?:<[^>]*>)?\s*\([^)]*\)[^:\n]*:/gm)) definies.add(m[1]!);
  }

  for (const f of fichiers) {
    const lignes = f.content.split('\n');
    const usings = new Set(
      lignes.filter((l) => l.startsWith('using ')).map((l) => /\{\s*([^}\s]+)\s*\}/.exec(l)?.[1] ?? ''),
    );

    // 1. Délimiteurs équilibrés, fichier par fichier.
    let parens = 0;
    lignes.forEach((l) => {
      for (const ch of l.replace(/"[^"]*"/g, '').replace(/#.*$/, '')) {
        if (ch === '(') parens++;
        if (ch === ')') parens--;
      }
    });
    if (parens !== 0) {
      erreurs++;
      sortie.push(diagnostic(`/${racine}`, f.path, lignes.length, 1, 1, 3100, `Unbalanced parentheses: ${parens > 0 ? 'missing )' : 'unexpected )'}.`));
    }

    // 2. Devices utilisés sans le using des devices.
    lignes.forEach((l, i) => {
      if (/\bclass\(creative_device\)|:\s*[a-z_]+_device\b/.test(l) && !usings.has(USING_DEVICES)) {
        const col = l.search(/creative_device|[a-z_]+_device/) + 1;
        const nom = /creative_device|[a-z_]+_device/.exec(l)?.[0] ?? 'creative_device';
        erreurs++;
        sortie.push(diagnostic(`/${racine}`, f.path, i + 1, col, col + nom.length, 3506, `Unknown identifier \`${nom}\`.`));
      }
    });

    // 3. Appels : fonction définie, ou API dont le using est présent.
    lignes.forEach((l, i) => {
      if (l.trimStart().startsWith('#') || l.startsWith('using ')) return;
      const sansChaines = l.replace(/"[^"]*"/g, (s) => ' '.repeat(s.length));
      for (const m of sansChaines.matchAll(/(^|[^.\w])([A-Z][A-Za-z0-9_]*)\s*\(/g)) {
        const nom = m[2]!;
        const col = (m.index ?? 0) + m[1]!.length + 1;
        // Une définition n'est pas un appel.
        if (new RegExp(`^\\s*${nom}\\s*(<[^>]*>)?\\s*\\([^)]*\\)[^:\\n]*:`).test(l)) continue;
        if (MOTS_CLES.has(nom.toLowerCase())) continue;
        if (definies.has(nom)) continue;
        if (nom in API) {
          const requis = API[nom];
          if (requis && !usings.has(requis)) {
            erreurs++;
            sortie.push(diagnostic(`/${racine}`, f.path, i + 1, col, col + nom.length, 3506, `Unknown identifier \`${nom}\`.`));
          }
          continue;
        }
        erreurs++;
        sortie.push(diagnostic(`/${racine}`, f.path, i + 1, col, col + nom.length, 3506, `Unknown identifier \`${nom}\`.`));
      }
    });
  }

  sortie.push(erreurs === 0 ? 'Build succeeded: 0 errors, 0 warnings' : `Build failed: ${erreurs} error${erreurs > 1 ? 's' : ''}, 0 warnings`);
  return { ok: erreurs === 0, output: sortie.join('\n') };
}
