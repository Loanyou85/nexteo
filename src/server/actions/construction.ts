'use server';

import type { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/server/auth';
import { reserverPourBuild, solde } from '@/server/credits';
import { db } from '@/server/db';
import { modeUefn } from '@/server/mode';
import { offreDe } from '@/server/offre';
import { emettre } from '@/server/orchestrateur/evenements';
import { lancer } from '@/server/orchestrateur/lancement';

export type EtatLancement = { erreur?: string };

export async function lancerConstruction(projectId: string, _e: EtatLancement, formData: FormData): Promise<EtatLancement> {
  const user = await requireUser();
  const autonomie = formData.get('autonomie') === 'on';
  if (autonomie && formData.get('confirmation') !== 'on') {
    return { erreur: 'La construction autonome demande une confirmation explicite.' };
  }
  const r = await lancer({ userId: user.id, projectId, autonomie });
  if (!r.ok) return { erreur: r.erreur };
  redirect(`/projet/${projectId}/build/${r.sessionId}`);
}

export type Commande = 'pause' | 'continuer' | 'stop' | 'annuler' | 'appliquer' | 'reessayer';

/**
 * Commandes humaines (section 20). Elles ne coupent jamais une tâche en
 * cours : elles sont déposées, et la boucle les applique entre deux tâches.
 */
export async function commander(sessionId: string, commande: Commande): Promise<{ erreur?: string }> {
  const user = await requireUser();
  const s = await db.agentSession.findFirst({ where: { id: sessionId, project: { userId: user.id } }, include: { plan: { include: { tasks: true } } } });
  if (!s) return { erreur: 'Construction introuvable.' };
  const ev = { sessionId, projectId: s.projectId };

  switch (commande) {
    case 'pause':
      if (s.status !== 'running' && s.status !== 'queued') return { erreur: 'Rien à mettre en pause.' };
      await db.agentSession.update({ where: { id: sessionId }, data: { pendingCommand: 'pause' } });
      await emettre(ev, 'session', 'Pause demandée : elle prendra effet après la tâche en cours.', { niveau: 'warn' });
      break;

    case 'stop':
    case 'annuler':
      if (['completed', 'stopped', 'failed'].includes(s.status)) return { erreur: 'Cette construction est déjà terminée.' };
      if (s.status === 'running' || s.status === 'queued') {
        await db.agentSession.update({ where: { id: sessionId }, data: { pendingCommand: commande } });
      } else {
        await db.agentSession.update({ where: { id: sessionId }, data: { status: 'stopping', pendingCommand: commande } });
      }
      await emettre(ev, 'session', commande === 'stop' ? 'Arrêt demandé : après la tâche en cours, jamais au milieu d’une écriture.' : 'Annulation demandée.', { niveau: 'warn' });
      break;

    case 'appliquer': {
      if (s.status !== 'awaiting_human' || s.stopReason !== 'correctif_a_valider') return { erreur: 'Aucun correctif en attente.' };
      const t = s.plan.tasks.filter((x) => x.type === 'fix.apply' && x.status === 'pending').sort((a, b) => a.order - b.order)[0];
      if (!t) return { erreur: 'Aucun correctif en attente.' };
      await db.buildTask.update({ where: { id: t.id }, data: { input: { ...(t.input as object), approuve: true } as Prisma.InputJsonValue } });
      await db.agentSession.update({ where: { id: sessionId }, data: { status: 'running', stopReason: null } });
      await emettre(ev, 'correctif', 'Correctif approuvé : l’agent l’applique.', { niveau: 'info', taskKey: t.key });
      break;
    }

    case 'continuer': {
      if (s.status === 'paused') {
        await db.agentSession.update({ where: { id: sessionId }, data: { status: 'running' } });
        await emettre(ev, 'session', 'Reprise.', { niveau: 'info' });
        break;
      }
      if (s.status !== 'awaiting_human') return { erreur: 'Rien à reprendre.' };

      // Continuer après une limite consomme davantage : on réserve un
      // complément, jamais à découvert, avec l'accord explicite donné ici.
      const offre = await offreDe(user.id);
      const budget = offre.plan.budget;
      const dispo = (await solde(user.id)).total;
      const complement = Math.min(budget?.maxCreditsPerBuild || 10, dispo);
      if (complement <= 0) return { erreur: 'Solde épuisé : recharge ou change d’offre pour continuer.' };
      await reserverPourBuild({ userId: user.id, buildId: sessionId, credits: complement, simulated: modeUefn() === 'mock' });
      await db.agentSession.update({
        where: { id: sessionId },
        data: {
          status: 'running',
          stopReason: null,
          creditsReserved: { increment: complement },
          ...(s.stopReason === 'budget_etapes' ? { stepsAllowance: { increment: Math.ceil((budget?.maxAgentSteps ?? 150) / 3) } } : {}),
          ...(s.stopReason === 'budget_temps' ? { minutesAllowance: { increment: Math.ceil((budget?.maxBuildMinutes ?? 60) / 3) } } : {}),
        },
      });
      await emettre(ev, 'credits', `${complement} crédits supplémentaires réservés à ta demande. Reprise.`, { niveau: 'info' });
      break;
    }

    case 'reessayer': {
      if (s.status !== 'awaiting_human' && s.status !== 'failed') return { erreur: 'Rien à réessayer.' };
      if (s.status === 'failed') return { erreur: 'Cette construction est close : lance-en une nouvelle depuis le projet.' };
      const echouees = s.plan.tasks.filter((t) => t.status === 'failed' && t.type !== 'verse.compile' && t.type !== 'session.test');
      await db.buildTask.updateMany({ where: { id: { in: echouees.map((t) => t.id) } }, data: { status: 'pending', attempt: 0 } });
      await db.agentSession.update({ where: { id: sessionId }, data: { status: 'running', stopReason: null } });
      await emettre(ev, 'session', `Nouvelle tentative sur ${echouees.length} tâche(s).`, { niveau: 'info' });
      break;
    }
  }

  revalidatePath(`/projet/${s.projectId}/build/${sessionId}`);
  return {};
}
