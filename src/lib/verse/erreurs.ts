/**
 * Parseur des diagnostics du compilateur Verse (section 12).
 *
 * Forme attendue, une ligne par diagnostic :
 *   C:/…/Content/zombie_spawner.verse(26,9, 26,19): Script error 3506: Unknown identifier `SpawnZombi`.
 *
 * Une erreur mal lue envoie l'agent corriger le mauvais fichier et coûte des
 * itérations payantes : le parseur est donc strict sur ce qu'il reconnaît, et
 * garde TOUJOURS la ligne brute. Ce qu'il ne sait pas lire n'est pas jeté —
 * il le rend en « non reconnu » pour que l'humain le voie.
 */

export type NiveauDiagnostic = 'error' | 'warning';

export type CategorieCompilation = 'compile_error' | 'verse_error' | 'invalid_reference';

export type Diagnostic = {
  brut: string;
  niveau: NiveauDiagnostic;
  code: number | null;
  message: string;
  /** Chemin tel qu'écrit par le compilateur. */
  chemin: string | null;
  /** Chemin relatif au dossier Content du projet, avec des « / ». */
  fichier: string | null;
  ligne: number | null;
  colonne: number | null;
  ligneFin: number | null;
  colonneFin: number | null;
  categorie: CategorieCompilation;
  /** Identifiant cité entre accents graves, s'il y en a un. */
  identifiant: string | null;
};

export type ResultatAnalyse = {
  diagnostics: Diagnostic[];
  /** Lignes qui ressemblent à une erreur mais que le parseur ne sait pas lire. */
  nonReconnues: string[];
};

const AVEC_POSITION =
  /^(?<chemin>.+?\.verse)\((?<l1>\d+),\s*(?<c1>\d+)(?:,\s*(?<l2>\d+),\s*(?<c2>\d+))?\)\s*:\s*Script\s+(?<niveau>error|warning)\s+(?<code>\d+)\s*:\s*(?<message>.+)$/i;

const SANS_POSITION = /^Script\s+(?<niveau>error|warning)\s+(?<code>\d+)\s*:\s*(?<message>.+)$/i;

/** Une ligne qui parle d'erreur sans avoir la forme attendue mérite d'être montrée. */
const SUSPECTE = /\b(error|erreur)\b/i;

function fichierRelatif(chemin: string): string {
  const normal = chemin.replace(/\\/g, '/');
  const i = normal.toLowerCase().lastIndexOf('/content/');
  if (i >= 0) return normal.slice(i + '/content/'.length);
  return normal.split('/').pop() ?? normal;
}

function categoriser(message: string): CategorieCompilation {
  if (/unknown identifier|unknown member|could not find|is not defined|no such/i.test(message)) {
    return 'invalid_reference';
  }
  if (/expected .* (but )?(found|got)|type mismatch|incompatible|cannot convert|is not a subtype/i.test(message)) {
    return 'verse_error';
  }
  return 'compile_error';
}

function identifiant(message: string): string | null {
  return /`([^`]+)`/.exec(message)?.[1] ?? null;
}

export function analyserSortieCompilateur(sortie: string): ResultatAnalyse {
  const diagnostics: Diagnostic[] = [];
  const nonReconnues: string[] = [];

  for (const brute of sortie.split(/\r?\n/)) {
    const ligne = brute.trim();
    if (!ligne) continue;

    const m = AVEC_POSITION.exec(ligne);
    if (m?.groups) {
      const g = m.groups;
      const message = g.message!.trim();
      diagnostics.push({
        brut: ligne,
        niveau: g.niveau!.toLowerCase() as NiveauDiagnostic,
        code: Number(g.code),
        message,
        chemin: g.chemin!,
        fichier: fichierRelatif(g.chemin!),
        ligne: Number(g.l1),
        colonne: Number(g.c1),
        ligneFin: g.l2 ? Number(g.l2) : null,
        colonneFin: g.c2 ? Number(g.c2) : null,
        categorie: categoriser(message),
        identifiant: identifiant(message),
      });
      continue;
    }

    const s = SANS_POSITION.exec(ligne);
    if (s?.groups) {
      const message = s.groups.message!.trim();
      diagnostics.push({
        brut: ligne,
        niveau: s.groups.niveau!.toLowerCase() as NiveauDiagnostic,
        code: Number(s.groups.code),
        message,
        chemin: null,
        fichier: null,
        ligne: null,
        colonne: null,
        ligneFin: null,
        colonneFin: null,
        categorie: categoriser(message),
        identifiant: identifiant(message),
      });
      continue;
    }

    // Les résumés du compilateur (« Build failed: 2 errors ») ne sont pas des
    // diagnostics : les compter en double ferait croire à trois erreurs.
    if (/^(build|compilation|verse build)\b.*\b(failed|succeeded|finished|started)\b/i.test(ligne)) continue;
    if (SUSPECTE.test(ligne)) nonReconnues.push(ligne);
  }

  return { diagnostics, nonReconnues };
}

export function erreursSeulement(r: ResultatAnalyse): Diagnostic[] {
  return r.diagnostics.filter((d) => d.niveau === 'error');
}
