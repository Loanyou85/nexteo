import { authentifierAgent, enregistrerResultat, resultatSchema } from '@/server/agent/canal';
import { json, lireJson, NON_AUTORISE } from '@/server/agent/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const agent = await authentifierAgent(req);
  if (!agent) return NON_AUTORISE();
  const c = await lireJson(req, resultatSchema);
  if (!c.ok) return c.reponse;
  const r = await enregistrerResultat(agent.id, c.data);
  if (r === 'trop_gros') return json({ erreur: 'Résultat trop gros.' }, 413);
  if (r === 'inconnu') return json({ erreur: 'Ordre inconnu, déjà traité ou expiré.' }, 404);
  return json({ ok: true });
}
