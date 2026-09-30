import { authentifierAgent, prendreOrdres } from '@/server/agent/canal';
import { json, NON_AUTORISE } from '@/server/agent/http';

export const dynamic = 'force-dynamic';
// Limite d'une fonction Vercel sans « Fluid » : le long-poll attend 25 s au plus.
export const maxDuration = 60;

/** L'agent demande ses ordres ; la réponse arrive dès qu'il y en a un, ou vide après ~25 s. */
export async function GET(req: Request) {
  const agent = await authentifierAgent(req);
  if (!agent) return NON_AUTORISE();
  const demande = Number(new URL(req.url).searchParams.get('attente') ?? '25');
  const ordres = await prendreOrdres(agent.id, (Number.isFinite(demande) ? demande : 25) * 1000);
  return json({ ordres });
}
