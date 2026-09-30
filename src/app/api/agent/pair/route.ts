import { appairageSchema, appairer } from '@/server/agent/canal';
import { json, lireJson } from '@/server/agent/http';

export const dynamic = 'force-dynamic';

/** L'agent échange son code d'appairage contre un jeton. Seule route ouverte sans jeton. */
export async function POST(req: Request) {
  const c = await lireJson(req, appairageSchema);
  if (!c.ok) return c.reponse;
  const r = await appairer(c.data);
  return r.ok ? json({ jeton: r.jeton, agentId: r.agentId }) : json({ erreur: r.erreur }, 400);
}
