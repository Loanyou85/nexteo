import { writeFileSync } from 'node:fs';
import { db } from '../src/server/db';
import { specZombie } from '../src/lib/gamespec/modeles';
import { lancer } from '../src/server/orchestrateur/lancement';
import { avancer } from '../src/server/orchestrateur/boucle';
import { verserCreditsPeriode } from '../src/server/credits';
import { ETAPES } from '../src/lib/orchestrateur/plan';

/**
 * Enregistre un VRAI build du scénario de référence, contre l'éditeur simulé,
 * avec ses latences simulées. L'accueil le rejoue en accéléré en disant ce
 * que c'est : rien n'y est écrit à la main.
 *
 *   MOCK_LATENCE=1 npx tsx --conditions=react-server scripts/enregistrer-demo.ts
 */

const user = await db.user.create({ data: { email: `demo-${Date.now()}@exemple.invalid`, name: 'Démo' } });
const pro = await db.plan.findUniqueOrThrow({ where: { slug: 'pro' } });
const debut = new Date();
const fin = new Date(Date.now() + 30 * 86_400_000);
const sub = await db.subscription.create({ data: { userId: user.id, planId: pro.id, status: 'active', priceCents: pro.monthlyPriceCents, currentPeriodStart: debut, currentPeriodEnd: fin } });
await verserCreditsPeriode({ userId: user.id, subscriptionId: sub.id, credits: pro.monthlyCredits, debut, fin, moisReport: 1 });
const projet = await db.project.create({ data: { userId: user.id, name: 'Zombie Hospital', genre: 'zombie_survival', currentSpecVersion: 1 } });
const spec = specZombie({ gameId: projet.id });
await db.gameSpec.create({ data: { projectId: projet.id, version: 1, specVersion: spec.specVersion, data: spec as object, author: 'ia' } });

const r = await lancer({ userId: user.id, projectId: projet.id, autonomie: true });
if (!r.ok) throw new Error(r.erreur);
for (let i = 0; i < 500; i++) {
  const e = await avancer(r.sessionId, 10_000);
  if (e === 'termine' || e === 'en_attente') break;
}

const evts = await db.agentEvent.findMany({ where: { sessionId: r.sessionId }, orderBy: { seq: 'asc' } });
const taches = await db.buildTask.findMany({ where: { plan: { sessions: { some: { id: r.sessionId } } } } });
const t0 = evts[0]!.createdAt.getTime();
const etapeDe = (cle: string | null) => {
  const t = taches.find((x) => x.key === cle);
  if (!t) return null;
  if (t.type === 'error.analyze' || t.type === 'fix.apply') return 'debogage';
  return (t.input as { etape?: string }).etape ?? null;
};

const s = await db.agentSession.findUniqueOrThrow({ where: { id: r.sessionId } });
writeFileSync(
  'src/content/build-demo.json',
  JSON.stringify(
    {
      avertissement: 'Enregistrement d’un build réel du scénario de référence, exécuté contre l’éditeur UEFN SIMULÉ avec une IA simulée. Rejoué en accéléré sur l’accueil.',
      enregistreLe: new Date().toISOString().slice(0, 10),
      titre: projet.name,
      dureeMs: (s.finishedAt?.getTime() ?? Date.now()) - (s.startedAt?.getTime() ?? t0),
      etapes: ETAPES.map((e) => ({ cle: e.cle, libelle: e.libelle })),
      evenements: evts
        .filter((e) => e.type !== 'credits')
        .map((e) => ({ t: e.createdAt.getTime() - t0, type: e.type, niveau: e.level, etape: etapeDe(e.taskKey), message: e.message, palier: (e.data as { apres?: number } | null)?.apres ?? null })),
    },
    null,
    1,
  ),
);
console.log(`Enregistré : ${evts.length} événements, statut ${s.status}, palier final`, (await db.project.findUniqueOrThrow({ where: { id: projet.id } })).tier);
await db.$disconnect();
