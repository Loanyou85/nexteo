/**
 * Client MCP minimal (transport « Streamable HTTP »), côté agent.
 *
 * Volontairement petit : l'agent est un tuyau, il ne connaît aucun outil par
 * son nom. Il sait initialiser une session, lister les outils, en appeler un,
 * et rien d'autre. Ne dépend ni du site ni de Node autrement que par `fetch`.
 *
 * Le MCP d'UEFN est en bêta : son adresse, sa version de protocole et ses
 * outils peuvent changer. Rien de tout cela n'est écrit en dur ici sauf
 * l'adresse par défaut, réglable.
 */

export const MCP_URL_PAR_DEFAUT = 'http://127.0.0.1:8000/mcp';
const PROTOCOLE = '2025-06-18';

export type CategorieEchec = 'mcp_unreachable' | 'mcp_timeout' | 'editor_hang' | 'outil';

/** Échec classé : l'agent le renvoie au site avec sa catégorie. */
export class ErreurAgent extends Error {
  constructor(readonly categorie: CategorieEchec, message: string) {
    super(message);
    this.name = 'ErreurAgent';
  }
}

export type OutilMcp = { name: string; description?: string; inputSchema?: unknown; title?: string };
export type ContenuOutil = { content?: unknown[]; isError?: boolean; structuredContent?: unknown };

/** Seule la machine locale est joignable : l'agent n'est pas un relais vers Internet. */
export function urlLocale(brut: string): URL {
  let u: URL;
  try {
    u = new URL(brut);
  } catch {
    throw new ErreurAgent('mcp_unreachable', `Adresse MCP illisible : ${brut}`);
  }
  const hote = u.hostname.replace(/^\[|\]$/g, '');
  const boucle = hote === 'localhost' || hote === '::1' || /^127\.\d+\.\d+\.\d+$/.test(hote);
  if (u.protocol !== 'http:' || !boucle) {
    throw new ErreurAgent('mcp_unreachable', 'L’agent ne parle qu’à un MCP local (http://127.0.0.1…). Adresse refusée.');
  }
  return u;
}

type Reponse = { result?: unknown; error?: { code: number; message: string } };

export class ClientMcp {
  private session: string | null = null;
  private version: string = PROTOCOLE;
  private initialise = false;
  private prochainId = 1;
  private readonly url: URL;
  private readonly f: typeof fetch;

  constructor(url: string = MCP_URL_PAR_DEFAUT, private readonly delaiMs = 30_000, f: typeof fetch = globalThis.fetch) {
    this.url = urlLocale(url);
    this.f = f;
  }

  get endpoint(): string {
    return this.url.toString();
  }

  private entetes(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    if (this.session) h['Mcp-Session-Id'] = this.session;
    if (this.initialise) h['MCP-Protocol-Version'] = this.version;
    return h;
  }

  private async poster(corps: object, delaiMs = this.delaiMs): Promise<Response> {
    const ctl = new AbortController();
    const minuteur = setTimeout(() => ctl.abort(), delaiMs);
    try {
      return await this.f(this.url, { method: 'POST', headers: this.entetes(), body: JSON.stringify(corps), signal: ctl.signal });
    } catch (e) {
      if (ctl.signal.aborted) throw new ErreurAgent('mcp_timeout', `L’éditeur n’a pas répondu en ${Math.round(delaiMs / 1000)} s (éditeur figé ou occupé).`);
      throw new ErreurAgent('mcp_unreachable', `MCP injoignable sur ${this.url.host} : UEFN est-il ouvert, avec MCP Toolsets activé ? (${(e as Error).message})`);
    } finally {
      clearTimeout(minuteur);
    }
  }

  /** Corps JSON simple, ou flux SSE dont on retient le message qui répond à `id`. */
  private async lire(rep: Response, id: number): Promise<Reponse> {
    const type = rep.headers.get('content-type') ?? '';
    const texte = await rep.text();
    if (type.includes('text/event-stream')) {
      for (const bloc of texte.split(/\r?\n\r?\n/)) {
        const data = bloc
          .split(/\r?\n/)
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trimStart())
          .join('\n');
        if (!data) continue;
        try {
          const m = JSON.parse(data) as Reponse & { id?: number };
          if (m.id === id) return m;
        } catch {
          /* bloc non JSON : on l'ignore */
        }
      }
      throw new ErreurAgent('outil', 'Le flux MCP s’est terminé sans réponse à la requête.');
    }
    try {
      return JSON.parse(texte) as Reponse;
    } catch {
      throw new ErreurAgent('outil', `Réponse MCP illisible (HTTP ${rep.status}).`);
    }
  }

  private async requete(methode: string, params?: object, delaiMs?: number, deuxiemeChance = true): Promise<unknown> {
    const id = this.prochainId++;
    const rep = await this.poster({ jsonrpc: '2.0', id, method: methode, params }, delaiMs);
    // Session perdue (éditeur relancé) : une seule réinitialisation, jamais de boucle.
    if (rep.status === 404 && this.session && deuxiemeChance) {
      this.oublier();
      await this.initialiser();
      return this.requete(methode, params, delaiMs, false);
    }
    if (!rep.ok && !(rep.headers.get('content-type') ?? '').includes('json')) {
      throw new ErreurAgent('mcp_unreachable', `Le MCP a répondu HTTP ${rep.status}.`);
    }
    const r = await this.lire(rep, id);
    if (r.error) throw new ErreurAgent('outil', `MCP ${r.error.code} : ${r.error.message}`);
    return r.result;
  }

  oublier(): void {
    this.session = null;
    this.initialise = false;
  }

  async initialiser(): Promise<{ protocolVersion: string; serverInfo?: unknown; capabilities?: unknown }> {
    this.oublier();
    const id = this.prochainId++;
    const rep = await this.poster({
      jsonrpc: '2.0',
      id,
      method: 'initialize',
      params: { protocolVersion: PROTOCOLE, capabilities: {}, clientInfo: { name: 'nexteo-agent', version: '0.1.0' } },
    });
    if (!rep.ok && !(rep.headers.get('content-type') ?? '').includes('json')) {
      throw new ErreurAgent('mcp_unreachable', `Le MCP a refusé l’initialisation (HTTP ${rep.status}).`);
    }
    const r = await this.lire(rep, id);
    if (r.error) throw new ErreurAgent('outil', `MCP ${r.error.code} : ${r.error.message}`);
    const res = (r.result ?? {}) as { protocolVersion?: string; serverInfo?: unknown; capabilities?: unknown };
    this.session = rep.headers.get('mcp-session-id');
    this.version = res.protocolVersion ?? PROTOCOLE;
    this.initialise = true;
    // Notification : pas d'id, pas de réponse attendue (HTTP 202).
    await this.poster({ jsonrpc: '2.0', method: 'notifications/initialized' }).then((n) => n.text());
    return { protocolVersion: this.version, serverInfo: res.serverInfo, capabilities: res.capabilities };
  }

  private async assurer(): Promise<void> {
    if (!this.initialise) await this.initialiser();
  }

  async listerOutils(): Promise<OutilMcp[]> {
    await this.assurer();
    const tous: OutilMcp[] = [];
    let curseur: string | undefined;
    // Pagination MCP : `nextCursor` jusqu'à épuisement, avec un plafond de sécurité.
    for (let page = 0; page < 50; page++) {
      const r = (await this.requete('tools/list', curseur ? { cursor: curseur } : {})) as { tools?: OutilMcp[]; nextCursor?: string };
      tous.push(...(r.tools ?? []));
      if (!r.nextCursor) break;
      curseur = r.nextCursor;
    }
    return tous;
  }

  async appeler(nom: string, args: Record<string, unknown> = {}, delaiMs?: number): Promise<ContenuOutil> {
    await this.assurer();
    return (await this.requete('tools/call', { name: nom, arguments: args }, delaiMs)) as ContenuOutil;
  }

  info() {
    return { protocolVersion: this.version, session: this.session !== null };
  }
}
