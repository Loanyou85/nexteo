import 'server-only';
import { calculerPalier, estPalier, type Palier } from '@/lib/palier';
import { lireGameSpec } from '@/lib/gamespec/schema';
import { db } from '@/server/db';

/**
 * Recalcule le palier d'un projet à partir de faits relus en base — jamais
 * d'un état supposé. Un plan modifié après construction redescend au gris :
 * ce qui a été compilé et testé, c'était l'ancien plan.
 */
export async function recalculerPalier(projectId: string): Promise<{ avant: Palier; apres: Palier }> {
  const projet = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const avant = (estPalier(projet.tier) ? projet.tier : 1) as Palier;

  const spec = await db.gameSpec.findUnique({
    where: { projectId_version: { projectId, version: projet.currentSpecVersion } },
  });
  const planExiste = !!spec && lireGameSpec(spec.data).ok;

  // La dernière session construite sur la version courante du plan.
  const session = await db.agentSession.findFirst({
    where: { projectId, plan: { specVersion: projet.currentSpecVersion } },
    orderBy: { createdAt: 'desc' },
    include: {
      plan: { include: { tasks: { where: { type: 'verse.compile' }, orderBy: { finishedAt: 'desc' } } } },
      testRuns: { orderBy: { startedAt: 'desc' }, take: 1, include: { results: { include: { spec: true } } } },
    },
  });

  const compile = session?.plan.tasks.find((t) => t.finishedAt);
  const derniereCompilationReussie = compile ? (compile.result as { ok?: boolean } | null)?.ok === true : null;
  const run = session?.testRuns[0];
  const bloquants = run?.results.filter((r) => r.spec.severity === 'blocking') ?? [];
  const check = session
    ? await db.prePublishCheck.findFirst({ where: { sessionId: session.id }, orderBy: { createdAt: 'desc' } })
    : null;

  const apres = calculerPalier({
    planExiste,
    derniereCompilationReussie,
    playtestAvecLogs: !!run && run.logCount > 0,
    testsBloquants: { total: bloquants.length, reussis: bloquants.filter((r) => r.passed).length },
    prePublicationPrete: check ? check.ready : null,
  });

  if (apres !== avant) await db.project.update({ where: { id: projectId }, data: { tier: apres } });
  return { avant, apres };
}
