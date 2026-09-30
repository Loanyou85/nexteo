import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

/**
 * Faux serveur MCP, pour développer l'agent sans UEFN.
 *
 *   npx tsx scripts/faux-mcp.ts            # écoute sur http://127.0.0.1:8000/mcp
 *
 * Il parle le protocole MCP (initialize, tools/list en SSE avec pagination,
 * tools/call) mais n'est PAS UEFN : les noms d'outils ci-dessous sont
 * inventés pour l'exercice, et ne disent rien de ceux du vrai éditeur.
 */
const PORT = Number(process.env.PORT ?? 8000);
let session: string | null = null;

createServer((req, res) => {
  let corps = '';
  req.on('data', (c) => (corps += c));
  req.on('end', () => {
    const m = corps ? JSON.parse(corps) : {};
    const ok = (result: unknown, entetes: Record<string, string> = {}) => {
      res.writeHead(200, { 'content-type': 'application/json', ...entetes });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, result }));
    };
    console.log(`[faux-mcp] ${m.method ?? '?'}`);
    if (m.method === 'initialize') {
      session = randomUUID();
      return ok({ protocolVersion: '2025-06-18', serverInfo: { name: 'faux-uefn', version: 'simulé' }, capabilities: { tools: {} } }, { 'mcp-session-id': session });
    }
    if (m.method === 'notifications/initialized') return void res.writeHead(202).end();
    if (req.headers['mcp-session-id'] !== session) return void res.writeHead(404).end();
    if (m.method === 'tools/list') {
      if (!m.params?.cursor) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.end(`data: ${JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'exemple_lister', description: 'Outil d’exemple (inventé)' }, { name: 'exemple_lire', description: 'Autre outil d’exemple (inventé)' }], nextCursor: 'p2' } })}\n\n`);
        return;
      }
      return ok({ tools: [{ name: 'exemple_ecrire', description: 'Troisième outil d’exemple (inventé)' }] });
    }
    if (m.method === 'tools/call') return ok({ content: [{ type: 'text', text: JSON.stringify(m.params) }] });
    res.writeHead(400).end();
  });
}).listen(PORT, '127.0.0.1', () => console.log(`[faux-mcp] http://127.0.0.1:${PORT}/mcp`));
