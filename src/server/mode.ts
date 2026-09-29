import 'server-only';

/**
 * Ce qui tourne vraiment, et ce qui est simulé.
 *
 * Deux choses peuvent être simulées : l'éditeur UEFN (tant que l'agent local
 * et le vrai MCP ne sont pas branchés) et l'IA (tant qu'aucune clé n'est
 * configurée). Chacune est annoncée par une bannière permanente : un build
 * simulé présenté comme réel serait le pire mensonge que ce produit puisse
 * faire (garde-fou n° 1).
 */

export type ModeUefn = 'mock' | 'mcp';
export type ModeIa = 'anthropic' | 'simule';

export function modeUefn(): ModeUefn {
  // Le fournisseur MCP réel arrive en phase F. Tant qu'il n'existe pas, le
  // réclamer par configuration ne doit pas faire croire qu'il tourne.
  return 'mock';
}

export function modeIa(): ModeIa {
  const force = process.env.AI_PROVIDER?.trim();
  if (force === 'simule') return 'simule';
  return process.env.ANTHROPIC_API_KEY?.trim() ? 'anthropic' : 'simule';
}

export function modes() {
  return { uefn: modeUefn(), ia: modeIa() };
}
