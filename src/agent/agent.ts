import { ClientMcp, ErreurAgent, type CategorieEchec } from './mcp';

/**
 * Cœur de l'agent Nexteo : il demande ses ordres au site, les exécute contre
 * le MCP local, et rend les résultats.
 *
 * Trois opérations, pas une de plus. Un site compromis ne doit pas pouvoir
 * faire exécuter autre chose que « lister les outils » et « appeler un outil »
 * du MCP d'UEFN sur cette machine : pas de commande shell, pas de fichier lu,
 * pas d'adresse tierce.
 */

export const VERSION_AGENT = '0.1.0';
const METHODES_AUTORISEES = new Set(['mcp.ping', 'mcp.listTools', 'mcp.callTool']);
const DELAI_MAX_APPEL_MS = 120_000;
const DELAI_PAR_DEFAUT_MS = 60_000;

export type ConfigAgent = {
  site: string;
  jeton: string;
  mcpUrl: string;
  fetch?: typeof fetch;
  /** Attente du long-poll, en secondes (25 en production, 0 dans les tests). */
  attenteSecondes?: number;
  journal?: (message: string) => void;
};

type Ordre = { id: string; method: string; params: unknown };
type Resultat = { id: string; ok: boolean; result?: unknown; error?: string; categorie?: CategorieEchec };

export class JetonRefuse extends Error {
  constructor() {
    super('Le site a refusé le jeton de cet agent : il a été révoqué. Relance l’appairage avec un nouveau code.');
    this.name = 'JetonRefuse';
  }
}

export function creerAgent(cfg: ConfigAgent) {
  const f = cfg.fetch ?? globalThis.fetch;
  const site = cfg.site.replace(/\/+$/, '');
  const journal = cfg.journal ?? (() => {});
  const mcp = new ClientMcp(cfg.mcpUrl, DELAI_PAR_DEFAUT_MS);
  let nbOutils: number | undefined;
  let derniereErreurMcp: string | undefined;

  async function api(chemin: string, init?: RequestInit): Promise<Response> {
    const rep = await f(`${site}${chemin}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.jeton}`, ...(init?.headers ?? {}) },
    });
    if (rep.status === 401) throw new JetonRefuse();
    return rep;
  }

  /** Exécute un ordre reçu. Ne lève jamais : tout échec devient un résultat classé. */
  async function traiter(ordre: Ordre): Promise<Resultat> {
    try {
      if (!METHODES_AUTORISEES.has(ordre.method)) {
        return { id: ordre.id, ok: false, categorie: 'outil', error: `Opération refusée par l’agent : ${ordre.method}` };
      }
      const p = (ordre.params ?? {}) as { name?: unknown; arguments?: unknown; delaiMs?: unknown };
      const delai = typeof p.delaiMs === 'number' ? Math.min(Math.max(p.delaiMs, 1000), DELAI_MAX_APPEL_MS) : DELAI_PAR_DEFAUT_MS;

      if (ordre.method === 'mcp.ping') {
        const r = await mcp.initialiser();
        return { id: ordre.id, ok: true, result: r };
      }
      if (ordre.method === 'mcp.listTools') {
        const outils = await mcp.listerOutils();
        nbOutils = outils.length;
        return { id: ordre.id, ok: true, result: { outils, ...mcp.info() } };
      }
      // mcp.callTool
      if (typeof p.name !== 'string' || !p.name || p.name.length > 200) {
        return { id: ordre.id, ok: false, categorie: 'outil', error: 'Nom d’outil manquant ou invalide.' };
      }
      const args = p.arguments && typeof p.arguments === 'object' && !Array.isArray(p.arguments) ? (p.arguments as Record<string, unknown>) : {};
      const r = await mcp.appeler(p.name, args, delai);
      return { id: ordre.id, ok: true, result: r };
    } catch (e) {
      const err = e instanceof ErreurAgent ? e : new ErreurAgent('outil', (e as Error).message);
      if (err.categorie !== 'outil') derniereErreurMcp = err.message;
      return { id: ordre.id, ok: false, categorie: err.categorie, error: err.message };
    }
  }

  /** Bilan envoyé au site. Ne contient que ce que l'agent a MESURÉ. */
  async function battement(): Promise<void> {
    let connecte = false;
    try {
      await mcp.initialiser();
      connecte = true;
      derniereErreurMcp = undefined;
    } catch (e) {
      derniereErreurMcp = (e as Error).message;
    }
    const corps = {
      version: VERSION_AGENT,
      diagnostics: {
        os: process.platform,
        mcp: { connecte, endpoint: mcp.endpoint, ...(connecte ? {} : { erreur: (derniereErreurMcp ?? 'inconnue').slice(0, 300) }), ...(nbOutils !== undefined ? { outils: nbOutils } : {}) },
      },
    };
    await api('/api/agent/heartbeat', { method: 'POST', body: JSON.stringify(corps) });
  }

  async function poster(r: Resultat): Promise<void> {
    const rep = await api('/api/agent/result', { method: 'POST', body: JSON.stringify(r) });
    if (!rep.ok) journal(`Résultat ${r.id} refusé par le site (HTTP ${rep.status}).`);
  }

  /** Un tour : demander des ordres, les exécuter un par un (l'éditeur est mono-fil), rendre les résultats. */
  async function tour(): Promise<number> {
    const rep = await api(`/api/agent/poll?attente=${cfg.attenteSecondes ?? 25}`);
    if (!rep.ok) throw new Error(`Le site a répondu HTTP ${rep.status}.`);
    const { ordres } = (await rep.json()) as { ordres: Ordre[] };
    for (const o of ordres) {
      journal(`Ordre ${o.method}`);
      await poster(await traiter(o));
    }
    return ordres.length;
  }

  /** Boucle principale, jusqu'à annulation. Repli exponentiel en cas de panne réseau. */
  async function tourner(signal: AbortSignal): Promise<void> {
    let attente = 1000;
    let dernierBattement = 0;
    while (!signal.aborted) {
      try {
        if (Date.now() - dernierBattement > 30_000) {
          await battement();
          dernierBattement = Date.now();
        }
        await tour();
        attente = 1000;
      } catch (e) {
        if (e instanceof JetonRefuse) throw e;
        journal(`Site injoignable ou en erreur : ${(e as Error).message}. Nouvelle tentative dans ${Math.round(attente / 1000)} s.`);
        await new Promise((r) => setTimeout(r, attente));
        attente = Math.min(attente * 2, 30_000);
      }
    }
  }

  return { traiter, battement, tour, tourner };
}
