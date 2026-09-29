import { hostname } from 'node:os';
import { db } from '../src/server/db';
import { avancer, EXECUTANT } from '../src/server/orchestrateur/boucle';

/**
 * Worker dédié (section 3.2 : table de jobs en base, worker dédié).
 *
 * Il prend les générations actives, la plus prioritaire d'abord (file
 * prioritaire des offres Pro et Studio), et les fait avancer par tranches.
 * Le bail sur le projet garantit qu'un seul exécutant touche un éditeur à la
 * fois, même si la console fait avancer la même session en parallèle.
 */

const TRANCHE_MS = 20_000;
const REPOS_MS = 1_000;

async function battement(debut: Date) {
  await db.workerHeartbeat.upsert({
    where: { id: EXECUTANT },
    create: { id: EXECUTANT, host: hostname(), version: '1', seenAt: new Date(), startedAt: debut },
    update: { seenAt: new Date() },
  });
}

async function suivante() {
  const actives = await db.agentSession.findMany({
    where: { status: { in: ['queued', 'running', 'stopping'] } },
    include: { project: { include: { user: { include: { subscription: { include: { plan: true } } } } } } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  return actives.sort(
    (a, b) => (b.project.user.subscription?.plan.queuePriority ?? 0) - (a.project.user.subscription?.plan.queuePriority ?? 0),
  );
}

async function main() {
  const debut = new Date();
  console.log(`[worker] ${EXECUTANT} démarré`);
  let arret = false;
  process.on('SIGINT', () => (arret = true));
  process.on('SIGTERM', () => (arret = true));

  while (!arret) {
    await battement(debut);
    const file = await suivante();
    if (file.length === 0) {
      await new Promise((r) => setTimeout(r, REPOS_MS));
      continue;
    }
    for (const s of file) {
      const r = await avancer(s.id, TRANCHE_MS);
      if (r !== 'occupe') console.log(`[worker] ${s.id} → ${r}`);
      if (arret) break;
    }
  }
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error('[worker] arrêt sur erreur', e);
  await db.$disconnect();
  process.exit(1);
});
