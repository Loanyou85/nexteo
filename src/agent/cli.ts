import { existsSync, unlinkSync } from 'node:fs';
import { cheminConfig, ecrireConfig, hostname, identifiantMachine, lireConfig } from './config';
import { creerAgent, JetonRefuse, VERSION_AGENT } from './agent';
import { ClientMcp, MCP_URL_PAR_DEFAUT } from './mcp';

/**
 *   nexteo-agent pair CODE --site https://ton-site   appairer cette machine
 *   nexteo-agent run                                  démarrer l'agent
 *   nexteo-agent test                                 tester la connexion au MCP d'UEFN
 *   nexteo-agent unpair                               oublier cet appairage
 */

const [, , commande, ...reste] = process.argv;
const option = (nom: string) => {
  const i = reste.indexOf(nom);
  return i >= 0 ? reste[i + 1] : undefined;
};

async function main(): Promise<number> {
  if (commande === 'pair') {
    const code = reste.find((a) => !a.startsWith('--'));
    const site = option('--site');
    if (!code || !site) {
      console.error('Usage : nexteo-agent pair CODE --site https://adresse-du-site');
      return 2;
    }
    const chemin = cheminConfig();
    const machineId = identifiantMachine(chemin);
    const rep = await fetch(`${site.replace(/\/+$/, '')}/api/agent/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, machineName: hostname(), machineId, version: VERSION_AGENT }),
    }).catch((e: Error) => {
      console.error(`Site injoignable : ${e.message}`);
      return null;
    });
    if (!rep) return 1;
    const corps = (await rep.json().catch(() => ({}))) as { jeton?: string; erreur?: string };
    if (!rep.ok || !corps.jeton) {
      console.error(corps.erreur ?? `Appairage refusé (HTTP ${rep.status}).`);
      return 1;
    }
    ecrireConfig({ site, jeton: corps.jeton, machineId, machineName: hostname(), mcpUrl: option('--mcp') ?? MCP_URL_PAR_DEFAUT }, chemin);
    console.log(`Appairé. Réglages enregistrés dans ${chemin}\nLance maintenant : nexteo-agent run`);
    return 0;
  }

  const config = lireConfig();
  if (commande === 'unpair') {
    if (existsSync(cheminConfig())) unlinkSync(cheminConfig());
    console.log('Appairage oublié sur cette machine. Révoque aussi l’agent sur le site.');
    return 0;
  }
  if (!config) {
    console.error('Cette machine n’est pas appairée. Génère un code sur le site (page Connexion UEFN) puis : nexteo-agent pair CODE --site …');
    return 2;
  }

  if (commande === 'test') {
    try {
      const c = new ClientMcp(config.mcpUrl, 15_000);
      const info = await c.initialiser();
      const outils = await c.listerOutils();
      console.log(`MCP joignable sur ${c.endpoint} (protocole ${info.protocolVersion}) — ${outils.length} outil(s) annoncé(s).`);
      for (const o of outils.slice(0, 20)) console.log(`  • ${o.name}`);
      return 0;
    } catch (e) {
      console.error((e as Error).message);
      return 1;
    }
  }

  if (commande === 'run') {
    const agent = creerAgent({ site: config.site, jeton: config.jeton, mcpUrl: config.mcpUrl, journal: (m) => console.log(`[${new Date().toLocaleTimeString()}] ${m}`) });
    const stop = new AbortController();
    process.on('SIGINT', () => stop.abort());
    process.on('SIGTERM', () => stop.abort());
    console.log(`Agent Nexteo ${VERSION_AGENT} — ${config.site} — MCP ${config.mcpUrl}\nCtrl+C pour arrêter.`);
    try {
      await agent.tourner(stop.signal);
    } catch (e) {
      if (e instanceof JetonRefuse) {
        console.error(e.message);
        return 3;
      }
      throw e;
    }
    return 0;
  }

  console.error('Commandes : pair, run, test, unpair');
  return 2;
}

main().then((code) => process.exit(code), (e) => {
  console.error((e as Error).message);
  process.exit(1);
});
