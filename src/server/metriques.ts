import 'server-only';
import { db } from '@/server/db';

/**
 * Métriques de viabilité (section 30). Deux chiffres décident si le produit
 * tient : le coût IA moyen par build et le taux d'intervention humaine. Les
 * builds simulés en sont EXCLUS : leur coût est estimé, pas mesuré.
 */
export async function metriques() {
  const sessions = await db.agentSession.findMany({
    where: { status: { in: ['completed', 'stopped', 'failed'] } },
    select: { id: true, status: true, retries: true, costEurMicros: true, startedAt: true, finishedAt: true, provider: true, planId: true },
  });
  const reelles = sessions.filter((s) => s.provider !== 'mock');
  const toutes = sessions;
  const ratio = (a: number, b: number) => (b > 0 ? Math.round((a * 1000) / b) / 10 : null);

  const compiles = await db.buildTask.findMany({ where: { type: 'verse.compile' }, select: { status: true, attempt: true } });
  const tests = await db.buildTask.findMany({ where: { type: 'session.test', status: 'done' }, select: { attempt: true } });
  const interventions = await db.agentEvent.findMany({
    where: {
      OR: [{ type: 'budget' }, { message: { contains: 'Intervention demandée' } }, { message: { contains: 'attend ton accord' } }],
    },
    select: { sessionId: true },
    distinct: ['sessionId'],
  });
  const terminees = toutes.filter((s) => s.startedAt && s.finishedAt);
  const coutMoyen = (liste: typeof toutes) => (liste.length ? Math.round(liste.reduce((n, s) => n + s.costEurMicros, 0) / liste.length) : null);

  return {
    builds: toutes.length,
    buildsReels: reelles.length,
    generationSuccessRate: ratio(toutes.filter((s) => s.status === 'completed').length, toutes.length),
    compileSuccessRate: ratio(compiles.filter((c) => c.status === 'done').length, compiles.reduce((n, c) => n + Math.max(c.attempt, 1), 0)),
    firstPlaytestSuccessRate: ratio(tests.filter((t) => t.attempt <= 1).length, tests.length),
    averageRetries: toutes.length ? Math.round((toutes.reduce((n, s) => n + s.retries, 0) / toutes.length) * 10) / 10 : null,
    averageBuildTimeMs: terminees.length ? Math.round(terminees.reduce((n, s) => n + (s.finishedAt!.getTime() - s.startedAt!.getTime()), 0) / terminees.length) : null,
    averageAiCostPerBuildMicros: coutMoyen(reelles),
    averageAiCostPerBuildSimulatedMicros: coutMoyen(toutes.filter((s) => s.provider === 'mock')),
    humanInterventionRate: ratio(interventions.length, toutes.length),
  };
}

/** Coût IA réel par crédit, mesuré sur les builds non simulés et clôturés. */
export async function coutReelParCredit() {
  const s = await db.agentSession.findMany({
    where: { provider: { not: 'mock' }, creditsDebited: { gt: 0 } },
    select: { costEurMicros: true, creditsDebited: true },
  });
  const cout = s.reduce((n, x) => n + x.costEurMicros, 0);
  const credits = s.reduce((n, x) => n + (x.creditsDebited ?? 0), 0);
  return { builds: s.length, coutEurMicros: cout, credits, parCreditCents: credits > 0 ? Math.round(cout / credits / 10_000) : null };
}
