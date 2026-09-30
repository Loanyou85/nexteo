import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { preparerBaseTest, URL_TEST } from '@/test/base';
import { ClientMcp, ErreurAgent } from '@/agent/mcp';

/**
 * Phase E, de bout en bout : appairage, jetons, file d'ordres, agent réel et
 * faux serveur MCP. Les routes du site sont appelées directement, contre la
 * vraie base de test ; seul l'éditeur UEFN est simulé (par un serveur HTTP qui
 * parle le protocole MCP, en JSON et en SSE).
 */

function fauxMcp() {
  let session: string | null = null;
  const appels: string[] = [];
  const serveur: Server = createServer((req, res) => {
    let corps = '';
    req.on('data', (c) => (corps += c));
    req.on('end', async () => {
      const m = corps ? JSON.parse(corps) : {};
      appels.push(m.method);
      const json = (result: unknown, entetes: Record<string, string> = {}) => {
        res.writeHead(200, { 'content-type': 'application/json', ...entetes });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, result }));
      };
      if (m.method === 'initialize') {
        session = `sess-${randomUUID()}`;
        return json({ protocolVersion: '2025-06-18', serverInfo: { name: 'faux-uefn', version: '0' }, capabilities: { tools: {} } }, { 'mcp-session-id': session });
      }
      if (m.method === 'notifications/initialized') {
        res.writeHead(202).end();
        return;
      }
      if (req.headers['mcp-session-id'] !== session) {
        res.writeHead(404).end();
        return;
      }
      if (m.method === 'tools/list') {
        if (!m.params?.cursor) {
          // Première page en SSE, avec curseur.
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'echo' }, { name: 'lent' }], nextCursor: 'p2' } })}\n\n`);
          return;
        }
        return json({ tools: [{ name: 'casse', description: 'échoue toujours' }] });
      }
      if (m.method === 'tools/call') {
        const { name, arguments: a } = m.params;
        if (name === 'echo') return json({ content: [{ type: 'text', text: JSON.stringify(a) }] });
        if (name === 'lent') {
          await new Promise((r) => setTimeout(r, 2500));
          return json({ content: [] });
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, error: { code: -32000, message: 'outil cassé' } }));
        return;
      }
      res.writeHead(400).end();
    });
  });
  return {
    serveur,
    appels,
    expirerSession: () => (session = null),
    demarrer: () => new Promise<string>((ok) => serveur.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${(serveur.address() as AddressInfo).port}/mcp`))),
    arreter: () => new Promise<void>((ok) => serveur.close(() => ok())),
  };
}

describe.skipIf(!URL_TEST)('canal agent local (phase E)', () => {
  let db: typeof import('@/server/db').db;
  let canal: typeof import('@/server/agent/canal');
  let routes: Record<string, Record<string, (r: Request) => Promise<Response>>>;
  let creerAgent: typeof import('@/agent/agent').creerAgent;
  let PanneEditeur: typeof import('@/lib/uefn/provider').PanneEditeur;
  let estPannePlateforme: typeof import('@/lib/uefn/provider').estPannePlateforme;
  const mcp = fauxMcp();
  let urlMcp = '';
  const arrets: AbortController[] = [];

  beforeAll(async () => {
    preparerBaseTest();
    ({ db } = await import('@/server/db'));
    canal = await import('@/server/agent/canal');
    ({ creerAgent } = await import('@/agent/agent'));
    ({ PanneEditeur, estPannePlateforme } = await import('@/lib/uefn/provider'));
    const [pair, hb, poll, result] = await Promise.all([
      import('@/app/api/agent/pair/route'),
      import('@/app/api/agent/heartbeat/route'),
      import('@/app/api/agent/poll/route'),
      import('@/app/api/agent/result/route'),
    ]);
    routes = {
      '/api/agent/pair': { POST: pair.POST },
      '/api/agent/heartbeat': { POST: hb.POST },
      '/api/agent/poll': { GET: poll.GET },
      '/api/agent/result': { POST: result.POST },
    };
    urlMcp = await mcp.demarrer();
  });

  afterAll(async () => {
    arrets.forEach((a) => a.abort());
    await mcp.arreter();
  });

  const fetchSite: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const h = routes[url.pathname]?.[(init?.method ?? 'GET').toUpperCase()];
    if (!h) return new Response('introuvable', { status: 404 });
    return h(new Request(url, init));
  };

  const utilisateur = () => db.user.create({ data: { email: `agent-${randomUUID()}@exemple.invalid` } });

  async function appairer(userId: string) {
    const { code } = await canal.creerCodeAppairage(userId);
    const r = await canal.appairer({ code, machineName: 'PC-test', machineId: randomUUID(), version: '0.1.0' });
    if (!r.ok) throw new Error(r.erreur);
    return { ...r, code };
  }

  /** Lance un vrai agent en arrière-plan contre le faux MCP. */
  function lancerAgent(jeton: string, mcpUrl = urlMcp) {
    const stop = new AbortController();
    arrets.push(stop);
    const agent = creerAgent({ site: 'http://site.test', jeton, mcpUrl, fetch: fetchSite, attenteSecondes: 1 });
    const fini = agent.tourner(stop.signal).catch(() => {});
    return { agent, arreter: async () => (stop.abort(), fini) };
  }

  // ── Appairage ─────────────────────────────────────────────────────────────

  it('un code ne sert qu’une fois, et un code faux est refusé', async () => {
    const u = await utilisateur();
    const { code } = await canal.creerCodeAppairage(u.id);
    const machineId = randomUUID();
    const a = await canal.appairer({ code, machineName: 'PC', machineId });
    expect(a.ok).toBe(true);
    const b = await canal.appairer({ code, machineName: 'PC2', machineId: randomUUID() });
    expect(b).toMatchObject({ ok: false });
    const faux = await canal.appairer({ code: 'ZZZZ-ZZZZ', machineName: 'PC', machineId: randomUUID() });
    expect(faux).toMatchObject({ ok: false });
    // Le message ne distingue pas « faux » de « déjà utilisé ».
    expect((b as { erreur: string }).erreur).toBe((faux as { erreur: string }).erreur);
  });

  it('un code expiré est refusé, et la saisie tolère minuscules et espaces', async () => {
    const u = await utilisateur();
    const { code } = await canal.creerCodeAppairage(u.id);
    const tolerant = await canal.appairer({ code: ` ${code.toLowerCase().replace('-', ' ')} `, machineName: 'PC', machineId: randomUUID() });
    expect(tolerant.ok).toBe(true);

    const v = await utilisateur();
    const { code: vieux } = await canal.creerCodeAppairage(v.id);
    await db.pairingCode.updateMany({ where: { userId: v.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await canal.appairer({ code: vieux, machineName: 'PC', machineId: randomUUID() })).toMatchObject({ ok: false });
  });

  it('ni le code ni le jeton ne sont stockés en clair', async () => {
    const u = await utilisateur();
    const { code, jeton, agentId } = await appairer(u.id);
    const c = await db.pairingCode.findFirstOrThrow({ where: { userId: u.id } });
    expect(c.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(c.codeHash).not.toContain(code.replace('-', ''));
    const a = await db.localAgent.findUniqueOrThrow({ where: { id: agentId } });
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.tokenHash).not.toBe(jeton);
    expect(jeton.startsWith('nxa_')).toBe(true);
  });

  it('un nouveau code invalide les anciens non utilisés', async () => {
    const u = await utilisateur();
    const { code: ancien } = await canal.creerCodeAppairage(u.id);
    await canal.creerCodeAppairage(u.id);
    expect(await canal.appairer({ code: ancien, machineName: 'PC', machineId: randomUUID() })).toMatchObject({ ok: false });
  });

  it('réappairer la même machine remplace le jeton sans créer de doublon', async () => {
    const u = await utilisateur();
    const machineId = randomUUID();
    const { code: c1 } = await canal.creerCodeAppairage(u.id);
    const r1 = (await canal.appairer({ code: c1, machineName: 'PC', machineId })) as { jeton: string; agentId: string };
    const { code: c2 } = await canal.creerCodeAppairage(u.id);
    const r2 = (await canal.appairer({ code: c2, machineName: 'PC', machineId })) as { jeton: string; agentId: string };
    expect(r2.agentId).toBe(r1.agentId);
    expect(await db.localAgent.count({ where: { userId: u.id } })).toBe(1);
    const req = (j: string) => new Request('http://x', { headers: { authorization: `Bearer ${j}` } });
    expect(await canal.authentifierAgent(req(r1.jeton))).toBeNull();
    expect(await canal.authentifierAgent(req(r2.jeton))).not.toBeNull();
  });

  it('limite le nombre d’agents par compte', async () => {
    const u = await utilisateur();
    for (let i = 0; i < canal.MAX_AGENTS_PAR_UTILISATEUR; i++) await appairer(u.id);
    const { code } = await canal.creerCodeAppairage(u.id);
    expect(await canal.appairer({ code, machineName: 'de trop', machineId: randomUUID() })).toMatchObject({ ok: false });
  });

  // ── Authentification des routes ───────────────────────────────────────────

  it('les routes refusent sans jeton, avec un faux jeton, et après révocation', async () => {
    const u = await utilisateur();
    const { jeton, agentId } = await appairer(u.id);
    const appeler = (j?: string) => fetchSite('http://site.test/api/agent/heartbeat', { method: 'POST', body: JSON.stringify({ diagnostics: {} }), headers: j ? { authorization: `Bearer ${j}` } : {} });
    expect((await appeler()).status).toBe(401);
    expect((await appeler('nxa_' + 'x'.repeat(50))).status).toBe(401);
    expect((await appeler('pas-un-jeton')).status).toBe(401);
    expect((await appeler(jeton)).status).toBe(200);
    expect(await canal.revoquerAgent(u.id, agentId)).toBe(true);
    expect((await appeler(jeton)).status).toBe(401);
    // Un autre utilisateur ne peut pas révoquer l'agent de celui-ci.
    const autre = await utilisateur();
    const { agentId: a2 } = await appairer(u.id);
    expect(await canal.revoquerAgent(autre.id, a2)).toBe(false);
  });

  it('la route d’appairage refuse un corps invalide ou démesuré', async () => {
    const rep = (corps: string, entetes: Record<string, string> = {}) => fetchSite('http://site.test/api/agent/pair', { method: 'POST', body: corps, headers: entetes });
    expect((await rep('pas du json')).status).toBe(400);
    expect((await rep('{}')).status).toBe(400);
    expect((await rep('{}', { 'content-length': '99999999' })).status).toBe(413);
  });

  // ── Relais MCP, de bout en bout ───────────────────────────────────────────

  it('découvre le catalogue d’outils (SSE + pagination) et le conserve', async () => {
    const u = await utilisateur();
    const { jeton, agentId } = await appairer(u.id);
    const a = lancerAgent(jeton);
    const n = await canal.decouvrirCatalogue(agentId);
    expect(n).toBe(3);
    const ligne = await db.localAgent.findUniqueOrThrow({ where: { id: agentId } });
    const cat = ligne.catalogue as { protocolVersion: string; outils: { name: string }[] };
    expect(cat.outils.map((o) => o.name)).toEqual(['echo', 'lent', 'casse']);
    expect(cat.protocolVersion).toBe('2025-06-18');
    expect(ligne.catalogueAt).not.toBeNull();
    await a.arreter();
  });

  it('appelle un outil, rend son résultat, et remonte le bilan mesuré', async () => {
    const u = await utilisateur();
    const { jeton, agentId } = await appairer(u.id);
    const a = lancerAgent(jeton);
    const r = (await canal.envoyerOrdre(agentId, 'mcp.callTool', { name: 'echo', arguments: { x: 1 } })) as { content: { text: string }[] };
    expect(JSON.parse(r.content[0]!.text)).toEqual({ x: 1 });
    const ligne = await db.localAgent.findUniqueOrThrow({ where: { id: agentId } });
    const d = ligne.diagnostics as { mcp: { connecte: boolean; endpoint: string } };
    expect(d.mcp.connecte).toBe(true);
    expect(d.mcp.endpoint).toContain('127.0.0.1');
    await a.arreter();
  });

  it('une erreur d’outil est une vraie erreur, pas une panne de plateforme', async () => {
    const u = await utilisateur();
    const { jeton, agentId } = await appairer(u.id);
    const a = lancerAgent(jeton);
    const e = await canal.envoyerOrdre(agentId, 'mcp.callTool', { name: 'casse' }).catch((x) => x);
    expect(e).toBeInstanceOf(Error);
    expect(estPannePlateforme(e)).toBe(false);
    expect((e as Error).message).toContain('outil cassé');
    await a.arreter();
  });

  it('session MCP perdue (éditeur relancé) : réinitialisation transparente', async () => {
    const u = await utilisateur();
    const { jeton, agentId } = await appairer(u.id);
    const a = lancerAgent(jeton);
    await canal.envoyerOrdre(agentId, 'mcp.callTool', { name: 'echo', arguments: { a: 1 } });
    mcp.expirerSession();
    const r = (await canal.envoyerOrdre(agentId, 'mcp.callTool', { name: 'echo', arguments: { a: 2 } })) as { content: { text: string }[] };
    expect(JSON.parse(r.content[0]!.text)).toEqual({ a: 2 });
    await a.arreter();
  });

  it('un outil qui dépasse son délai est une panne de plateforme (mcp_timeout)', async () => {
    const u = await utilisateur();
    const { jeton, agentId } = await appairer(u.id);
    const a = lancerAgent(jeton);
    const e = await canal.envoyerOrdre(agentId, 'mcp.callTool', { name: 'lent', delaiMs: 1000 }, { delaiMs: 20_000 }).catch((x) => x);
    expect(e).toBeInstanceOf(PanneEditeur);
    expect((e as InstanceType<typeof PanneEditeur>).categorie).toBe('mcp_timeout');
    expect(estPannePlateforme(e)).toBe(true);
    await a.arreter();
  });

  it('éditeur fermé : panne de plateforme (mcp_unreachable), pas une erreur d’outil', async () => {
    const u = await utilisateur();
    const { jeton, agentId } = await appairer(u.id);
    const a = lancerAgent(jeton, 'http://127.0.0.1:1/mcp');
    const e = await canal.envoyerOrdre(agentId, 'mcp.callTool', { name: 'echo' }).catch((x) => x);
    expect(e).toBeInstanceOf(PanneEditeur);
    expect((e as InstanceType<typeof PanneEditeur>).categorie).toBe('mcp_unreachable');
    const ligne = await db.localAgent.findUniqueOrThrow({ where: { id: agentId } });
    expect((ligne.diagnostics as { mcp: { connecte: boolean } }).mcp.connecte).toBe(false);
    await a.arreter();
  });

  // ── Garde-fous ────────────────────────────────────────────────────────────

  it('l’agent refuse toute opération hors de sa liste, même envoyée par le site', async () => {
    const u = await utilisateur();
    const { jeton, agentId } = await appairer(u.id);
    const ordre = await db.agentCommand.create({ data: { agentId, method: 'shell.exec', params: { cmd: 'whoami' }, expiresAt: new Date(Date.now() + 30_000) } });
    const a = lancerAgent(jeton);
    for (let i = 0; i < 40; i++) {
      const o = await db.agentCommand.findUniqueOrThrow({ where: { id: ordre.id } });
      if (o.status !== 'pending' && o.status !== 'taken') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const fini = await db.agentCommand.findUniqueOrThrow({ where: { id: ordre.id } });
    expect(fini.status).toBe('failed');
    expect(fini.error).toContain('Opération refusée');
    await a.arreter();
  });

  it('l’agent ne parle qu’à un MCP local', () => {
    expect(() => new ClientMcp('http://example.com/mcp')).toThrow(ErreurAgent);
    expect(() => new ClientMcp('https://127.0.0.1:8000/mcp')).toThrow(ErreurAgent);
    expect(() => new ClientMcp('http://192.168.1.10:8000/mcp')).toThrow(ErreurAgent);
    expect(() => new ClientMcp('http://127.0.0.1:8000/mcp')).not.toThrow();
    expect(() => new ClientMcp('http://localhost:8000/mcp')).not.toThrow();
  });

  it('un agent ne peut répondre qu’à ses propres ordres', async () => {
    const u = await utilisateur();
    const A = await appairer(u.id);
    const B = await appairer(u.id);
    const ordre = await db.agentCommand.create({ data: { agentId: A.agentId, method: 'mcp.ping', params: {}, expiresAt: new Date(Date.now() + 30_000) } });
    const pris = await canal.prendreOrdres(A.agentId, 0);
    expect(pris.map((o) => o.id)).toEqual([ordre.id]);
    expect(await canal.enregistrerResultat(B.agentId, { id: ordre.id, ok: true, result: { pirate: true } })).toBe('inconnu');
    expect(await canal.enregistrerResultat(A.agentId, { id: ordre.id, ok: true, result: { bon: true } })).toBe('ok');
    // Une seule réponse par ordre.
    expect(await canal.enregistrerResultat(A.agentId, { id: ordre.id, ok: true, result: { deux: true } })).toBe('inconnu');
    expect((await db.agentCommand.findUniqueOrThrow({ where: { id: ordre.id } })).result).toEqual({ bon: true });
  });

  it('deux prises simultanées ne se partagent jamais le même ordre', async () => {
    const u = await utilisateur();
    const { agentId } = await appairer(u.id);
    for (let i = 0; i < 6; i++) await db.agentCommand.create({ data: { agentId, method: 'mcp.ping', params: { i }, expiresAt: new Date(Date.now() + 30_000) } });
    const [x, y] = await Promise.all([canal.prendreOrdres(agentId, 0), canal.prendreOrdres(agentId, 0)]);
    const ids = [...x, ...y].map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(6);
    const reste = await canal.prendreOrdres(agentId, 0);
    expect(new Set([...ids, ...reste.map((o) => o.id)]).size).toBe(6);
  });

  it('un ordre périmé n’est jamais remis à l’agent', async () => {
    const u = await utilisateur();
    const { agentId } = await appairer(u.id);
    await db.agentCommand.create({ data: { agentId, method: 'mcp.ping', params: {}, expiresAt: new Date(Date.now() - 1000) } });
    expect(await canal.prendreOrdres(agentId, 0)).toEqual([]);
  });

  it('un résultat démesuré est refusé', async () => {
    const u = await utilisateur();
    const { agentId } = await appairer(u.id);
    const o = await db.agentCommand.create({ data: { agentId, method: 'mcp.ping', params: {}, status: 'taken', expiresAt: new Date(Date.now() + 30_000) } });
    expect(await canal.enregistrerResultat(agentId, { id: o.id, ok: true, result: 'x'.repeat(1_100_000) })).toBe('trop_gros');
  });

  // ── Pannes côté plateforme ────────────────────────────────────────────────

  it('agent hors ligne : refus immédiat, sans ordre en attente', async () => {
    const u = await utilisateur();
    const { agentId } = await appairer(u.id);
    await db.localAgent.update({ where: { id: agentId }, data: { lastSeenAt: new Date(Date.now() - 10 * 60_000) } });
    const t0 = Date.now();
    const e = await canal.envoyerOrdre(agentId, 'mcp.ping', {}).catch((x) => x);
    expect(e).toBeInstanceOf(PanneEditeur);
    expect((e as InstanceType<typeof PanneEditeur>).categorie).toBe('mcp_unreachable');
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(await db.agentCommand.count({ where: { agentId } })).toBe(0);
  });

  it('agent vivant mais muet : délai dépassé, ordre marqué échoué (mcp_timeout)', async () => {
    const u = await utilisateur();
    const { agentId } = await appairer(u.id); // lastSeenAt = maintenant, mais aucune boucle ne tourne
    const e = await canal.envoyerOrdre(agentId, 'mcp.ping', {}, { delaiMs: 700 }).catch((x) => x);
    expect(e).toBeInstanceOf(PanneEditeur);
    expect((e as InstanceType<typeof PanneEditeur>).categorie).toBe('mcp_timeout');
    const o = await db.agentCommand.findFirstOrThrow({ where: { agentId } });
    expect(o.status).toBe('failed');
  });

  it('révoquer un agent échoue ses ordres en attente au lieu de les laisser pendre', async () => {
    const u = await utilisateur();
    const { agentId } = await appairer(u.id);
    const o = await db.agentCommand.create({ data: { agentId, method: 'mcp.ping', params: {}, expiresAt: new Date(Date.now() + 60_000) } });
    await canal.revoquerAgent(u.id, agentId);
    const apres = await db.agentCommand.findUniqueOrThrow({ where: { id: o.id } });
    expect(apres.status).toBe('failed');
    expect(apres.error).toContain('révoqué');
  });

  it('l’agent s’arrête proprement quand le site révoque son jeton', async () => {
    const u = await utilisateur();
    const { jeton, agentId } = await appairer(u.id);
    await canal.revoquerAgent(u.id, agentId);
    const stop = new AbortController();
    arrets.push(stop);
    const agent = creerAgent({ site: 'http://site.test', jeton, mcpUrl: urlMcp, fetch: fetchSite, attenteSecondes: 1 });
    await expect(agent.tourner(stop.signal)).rejects.toThrow(/révoqué/);
  });
});
