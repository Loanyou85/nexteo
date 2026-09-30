import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MCP_URL_PAR_DEFAUT } from './mcp';

/** Réglages de l'agent, sur le disque de l'utilisateur. Le jeton n'existe que là. */
export type ConfigDisque = { site: string; jeton: string; machineId: string; machineName: string; mcpUrl: string };

export function cheminConfig(env: NodeJS.ProcessEnv = process.env, plateforme = process.platform): string {
  if (env.NEXTEO_AGENT_CONFIG) return env.NEXTEO_AGENT_CONFIG;
  if (plateforme === 'win32') return join(env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Nexteo', 'agent.json');
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'nexteo', 'agent.json');
}

export function lireConfig(chemin = cheminConfig()): ConfigDisque | null {
  if (!existsSync(chemin)) return null;
  try {
    const c = JSON.parse(readFileSync(chemin, 'utf8')) as Partial<ConfigDisque>;
    if (!c.site || !c.jeton || !c.machineId) return null;
    return { site: c.site, jeton: c.jeton, machineId: c.machineId, machineName: c.machineName ?? hostname(), mcpUrl: c.mcpUrl ?? MCP_URL_PAR_DEFAUT };
  } catch {
    return null;
  }
}

export function ecrireConfig(c: ConfigDisque, chemin = cheminConfig()): void {
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, JSON.stringify(c, null, 2), { mode: 0o600 });
  try {
    chmodSync(chemin, 0o600);
  } catch {
    /* Windows : les droits Unix ne s'y appliquent pas */
  }
}

/** Identifiant stable de cette machine : le même à chaque appairage, pour ne pas créer de doublon. */
export function identifiantMachine(chemin = cheminConfig()): string {
  return lireConfig(chemin)?.machineId ?? randomUUID();
}

export { hostname };
