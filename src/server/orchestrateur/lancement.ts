import 'server-only';
import type { Prisma } from '@prisma/client';
import { SoldeInsuffisant } from '@/lib/credits/registre';
import { lireGameSpec } from '@/lib/gamespec/schema';
import { construirePlan, type Environnement } from '@/lib/orchestrateur/plan';
import { configEntier } from '@/server/config';
import { reserverPourBuild, solde } from '@/server/credits';
import { db } from '@/server/db';
import { modeUefn } from '@/server/mode';
import { offreDe } from '@/server/offre';
import { emettre } from '@/server/orchestrateur/evenements';

/**
 * Lancement d'une construction (règles 1 et 2 de l'offre).
 *
 * 1. Estimation annoncée avant lancement, jamais de lancement à découvert.
 * 2. Réservation du plafond du build : elle retire du solde disponible sans
 *    rien débiter. Le débit se fait au réel, à la clôture.
 */

export type Estimation = {
  estimation: number;
  plafond: number;
  solde: number;
  premiereConstruction: boolean;
  autorise: boolean;
  raison: string | null;
};

export async function estimer(userId: string, projectId: string): Promise<Estimation> {
  const [offre, s, dejaConstruit] = await Promise.all([
    offreDe(userId),
    solde(userId),
    db.agentSession.count({ where: { projectId, status: 'completed' } }),
  ]);
  const premiere = dejaConstruit === 0;
  const estimation = await configEntier(premiere ? 'CREDITS_ESTIMATE_FULL' : 'CREDITS_ESTIMATE_UPDATE');
  const plafondOffre = offre.plan.budget?.maxCreditsPerBuild ?? 0;
  // En simulation, aucun appel payant n'est fait : l'offre gratuite peut
  // construire si un administrateur lui a crédité un solde. Contre le vrai
  // éditeur, seules les offres payantes construisent.
  const simulation = modeUefn() === 'mock';
  const plafond = Math.min(Math.max(plafondOffre, simulation ? estimation * 2 : 0), s.total);

  let raison: string | null = null;
  if (!offre.plan.realBuilds && !simulation) raison = `L’offre ${offre.plan.name} ne comprend aucun build réel.`;
  else if (s.total < estimation) raison = `Ce build devrait consommer environ ${estimation} crédits et il t’en reste ${s.total}.`;

  return { estimation, plafond, solde: s.total, premiereConstruction: premiere, autorise: raison === null, raison };
}

export async function lancer(args: {
  userId: string;
  projectId: string;
  autonomie: boolean;
}): Promise<{ ok: true; sessionId: string } | { ok: false; erreur: string }> {
  const projet = await db.project.findFirst({ where: { id: args.projectId, userId: args.userId } });
  if (!projet) return { ok: false, erreur: 'Projet introuvable.' };

  const active = await db.agentSession.findFirst({
    where: { projectId: projet.id, status: { in: ['queued', 'running', 'paused', 'stopping', 'awaiting_human'] } },
  });
  if (active) return { ok: true, sessionId: active.id };

  const est = await estimer(args.userId, projet.id);
  if (!est.autorise) return { ok: false, erreur: est.raison ?? 'Lancement impossible.' };

  const specLigne = await db.gameSpec.findUnique({
    where: { projectId_version: { projectId: projet.id, version: projet.currentSpecVersion } },
  });
  const lu = specLigne ? lireGameSpec(specLigne.data) : null;
  if (!lu?.ok) return { ok: false, erreur: 'Le plan de map est illisible : corrige-le avant de lancer.' };

  const env = await db.environmentTemplate.findUnique({ where: { id: lu.spec.environment } });
  if (!env) return { ok: false, erreur: `Environnement « ${lu.spec.environment} » absent du référentiel.` };
  const taches = construirePlan(lu.spec, env.layout as unknown as Environnement);

  // Mise à jour : on transmet à chaque module l'empreinte de ses données et
  // celle du fichier tels qu'à la dernière génération réussie.
  const derniere = est.premiereConstruction
    ? null
    : await db.agentSession.findFirst({
        where: { projectId: projet.id, status: 'completed' },
        orderBy: { finishedAt: 'desc' },
        include: { plan: { include: { tasks: { where: { type: { in: ['verse.write', 'ui.build'] } } } } }, version: true },
      });
  if (derniere) {
    const fichiers = ((derniere.version?.snapshot as { fichiers?: { path: string; contentHash: string }[] } | null)?.fichiers ?? []);
    for (const t of taches) {
      if (t.type !== 'verse.write' && t.type !== 'ui.build') continue;
      const avant = derniere.plan.tasks.find((x) => x.key === t.key);
      const empreinteAvant = (avant?.input as { empreinte?: string } | null)?.empreinte;
      const hash = fichiers.find((f) => f.path === t.input.path)?.contentHash;
      if (empreinteAvant && hash) t.input.anterieur = { empreinte: empreinteAvant, hash };
    }
  }

  // Niveau 5 : confirmation explicite et datée, exigée aussi par la base.
  await db.project.update({
    where: { id: projet.id },
    data: args.autonomie
      ? { permissionLevel: 5, autonomyConfirmedAt: new Date() }
      : { permissionLevel: 4 },
  });

  const plan = await db.buildPlan.create({
    data: {
      projectId: projet.id,
      specVersion: projet.currentSpecVersion,
      kind: est.premiereConstruction ? 'initial' : 'mise-a-jour',
      tasks: {
        create: taches.map((t) => ({
          key: t.key,
          type: t.type,
          description: t.description,
          dependsOn: t.dependsOn,
          order: t.order,
          maxAttempts: t.maxAttempts,
          input: { ...t.input, etape: t.etape } as Prisma.InputJsonValue,
        })),
      },
    },
  });

  let sessionId: string;
  try {
    const session = await db.agentSession.create({
      data: {
        projectId: projet.id,
        planId: plan.id,
        provider: modeUefn(),
        status: 'queued',
        creditsEstimated: est.estimation,
      },
    });
    sessionId = session.id;
  } catch {
    // L'index unique partiel a refusé : une autre génération vient de démarrer.
    await db.buildPlan.delete({ where: { id: plan.id } });
    return { ok: false, erreur: 'Une construction est déjà en cours sur ce projet.' };
  }

  try {
    await reserverPourBuild({ userId: args.userId, buildId: sessionId, credits: est.plafond, simulated: modeUefn() === 'mock' });
  } catch (e) {
    await db.buildPlan.delete({ where: { id: plan.id } });
    if (e instanceof SoldeInsuffisant) return { ok: false, erreur: e.message };
    throw e;
  }

  await db.agentSession.update({ where: { id: sessionId }, data: { creditsReserved: est.plafond } });
  await emettre({ sessionId, projectId: projet.id }, 'credits', `${est.plafond} crédits réservés (estimation : ${est.estimation}). Une réservation n’est pas un débit : seul le coût réel sera prélevé.`, { niveau: 'info' });
  await emettre({ sessionId, projectId: projet.id }, 'session', `Plan de construction : ${taches.length} tâches. Niveau d’autorisation ${args.autonomie ? '5 — construction autonome, correctifs appliqués sans attendre' : '4 — chaque correctif attendra ton accord'}.`, { niveau: 'info' });

  return { ok: true, sessionId };
}
