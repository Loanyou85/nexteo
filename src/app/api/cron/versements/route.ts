import { verserMensualitesAnnuelles } from '@/server/abonnements';

/**
 * Tâche quotidienne (section 7.4) : crédits mensuels des abonnés annuels.
 * Appelée par le planificateur de Vercel avec le secret CRON_SECRET.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Non autorisé', { status: 401 });
  }
  const verses = await verserMensualitesAnnuelles();
  return Response.json({ verses });
}
