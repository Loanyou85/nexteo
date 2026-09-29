import type { Usage } from '@/lib/ai/types';

/**
 * Tarifs des modèles, en micro-dollars par million de jetons (source : table
 * des modèles Anthropic, relevée le 2026-09-25). Ce sont les tarifs du
 * fournisseur, pas les prix de Nexteo : ils servent à ESTIMER le coût d'un
 * appel, que l'administration compare ensuite au coût de référence.
 */
const PAR_MILLION_USD_MICROS: Record<string, { entree: number; sortie: number; cacheLecture: number; cacheEcriture: number }> = {
  'claude-opus-5-5': { entree: 4_000_000, sortie: 20_000_000, cacheLecture: 200_000, cacheEcriture: 5_000_000 },
  'claude-sonnet-5-5': { entree: 2_000_000, sortie: 10_000_000, cacheLecture: 200_000, cacheEcriture: 2_500_000 },
  'claude-haiku-4-5': { entree: 1_000_000, sortie: 5_000_000, cacheLecture: 100_000, cacheEcriture: 1_250_000 },
};

/** Coût d'un appel en millionièmes d'euro, arrondi à l'entier supérieur. */
export function coutEurMicros(u: Usage, tauxUsdEurPpm: number): number {
  const t = PAR_MILLION_USD_MICROS[u.model] ?? PAR_MILLION_USD_MICROS['claude-opus-5-5']!;
  // micro-USD = jetons × (micro-USD par million) / 1 000 000
  const usdMicros =
    (u.inputTokens * t.entree +
      u.outputTokens * t.sortie +
      u.cacheReadTokens * t.cacheLecture +
      u.cacheWriteTokens * t.cacheEcriture) /
    1_000_000;
  return Math.ceil((usdMicros * tauxUsdEurPpm) / 1_000_000);
}

/** Estimation grossière des jetons d'un texte, pour l'IA simulée (≈ 4 caractères par jeton). */
export function estimerJetons(texte: string): number {
  return Math.max(1, Math.ceil(texte.length / 4));
}
