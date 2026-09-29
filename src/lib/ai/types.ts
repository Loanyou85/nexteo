import type { z } from 'zod/v4';

/**
 * Abstraction du fournisseur d'IA (section 23).
 *
 * Toute réponse structurée est validée par Zod AVANT usage : une sortie de
 * modèle non validée qui part dans une écriture de fichier est un bug en
 * attente. Chaque appel rend son usage en jetons, pour que le coût soit
 * enregistré — sans cette mesure, impossible de fixer les prix.
 */

export type Usage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type Resultat<T> = { valeur: T; usage: Usage };

export type RequeteTexte = {
  systeme: string;
  message: string;
  maxTokens?: number;
  /**
   * Données structurées réservées à l'IA simulée, qui ne lit pas la prose.
   * Le fournisseur réel les ignore : tout ce qu'il doit savoir est dans
   * `message`.
   */
  simulation?: unknown;
};

export type RequeteStructuree<T> = RequeteTexte & { schema: z.ZodType<T>; nomSchema: string };

export type ErreurAAnalyser = {
  brut: string;
  fichier: string | null;
  ligne: number | null;
  contenuFichier: string | null;
  categorie: string;
};

export type Analyse = {
  cause: string;
  fichier: string | null;
  strategie: string;
};

export type RequeteCode = {
  /** « module » pour écrire un module Verse, « correctif » pour réparer un fichier. */
  intention: 'module' | 'correctif';
  chemin: string;
  consigne: string;
  contexte: string;
  contenuActuel?: string;
  erreur?: ErreurAAnalyser;
  simulation?: unknown;
};

export interface AIProvider {
  readonly nom: 'anthropic' | 'simule';
  generate(req: RequeteTexte): Promise<Resultat<string>>;
  stream(req: RequeteTexte): AsyncIterable<string>;
  structuredOutput<T>(req: RequeteStructuree<T>): Promise<Resultat<T>>;
  analyze(erreur: ErreurAAnalyser): Promise<Resultat<Analyse>>;
  codeGeneration(req: RequeteCode): Promise<Resultat<string>>;
}

export class SortieInvalide extends Error {
  constructor(readonly details: string[]) {
    super(`Sortie du modèle refusée par la validation : ${details.slice(0, 3).join(' ; ')}`);
    this.name = 'SortieInvalide';
  }
}
