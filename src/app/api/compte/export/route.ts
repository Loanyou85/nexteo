import { sessionOuNull } from '@/server/auth';
import { db } from '@/server/db';

/**
 * Export de tout ce que Nexteo détient sur le compte (garde-fou n° 7) :
 * profil, abonnement, registre de crédits, projets avec leurs plans, leur
 * code Verse relu et l'historique de leurs générations.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await sessionOuNull();
  if (!session?.user?.id) return new Response('Non connecté', { status: 401 });

  const donnees = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      createdAt: true,
      consentAcceptedAt: true,
      consentVersion: true,
      subscription: { select: { interval: true, status: true, priceCents: true, currentPeriodEnd: true, plan: { select: { name: true } } } },
      credits: { select: { delta: true, bucket: true, reason: true, note: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      usageEvents: { select: { type: true, model: true, inputTokens: true, outputTokens: true, costEurMicros: true, simulated: true, createdAt: true } },
      projects: {
        select: {
          name: true,
          genre: true,
          tier: true,
          createdAt: true,
          specs: { select: { version: true, author: true, note: true, data: true, createdAt: true } },
          verseFiles: { select: { path: true, content: true, observedAt: true } },
          sessions: { select: { status: true, createdAt: true, finishedAt: true, creditsDebited: true, provider: true } },
        },
      },
    },
  });

  return new Response(JSON.stringify({ exporteLe: new Date().toISOString(), compte: donnees }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="nexteo-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
