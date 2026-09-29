'use server';

import type { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod/v4';
import { appliquerParametres, parametresSchema } from '@/lib/gamespec/parametres';
import { differences, lireGameSpec } from '@/lib/gamespec/schema';
import { requireUser } from '@/server/auth';
import { db } from '@/server/db';
import { offreDe, periodeCourante, plansDuMois } from '@/server/offre';
import { planifier } from '@/server/planificateur';

export type EtatCreation = { erreur?: string; champ?: 'titre' | 'idee' };

const ideeSchema = z.object({
  titre: z.string().trim().min(2, 'Donne un titre d’au moins deux caractères.').max(60, 'Soixante caractères au maximum.'),
  idee: z
    .string()
    .trim()
    .min(12, 'Décris ta map en une phrase au moins.')
    .max(1200, 'Garde l’idée sous 1 200 caractères : le détail se règle à l’étape suivante.'),
});

export async function genererPlan(_e: EtatCreation, formData: FormData): Promise<EtatCreation> {
  const user = await requireUser();
  const analyse = ideeSchema.safeParse({ titre: formData.get('titre'), idee: formData.get('idee') });
  if (!analyse.success) {
    const i = analyse.error.issues[0];
    return { erreur: i?.message ?? 'Saisie invalide.', champ: i?.path[0] as EtatCreation['champ'] };
  }

  // Quotas lus en base, jamais en dur.
  const offre = await offreDe(user.id);
  if (offre.plan.monthlyGamePlans !== null && (await plansDuMois(user.id)) >= offre.plan.monthlyGamePlans) {
    return {
      erreur: `Tu as utilisé tes ${offre.plan.monthlyGamePlans} plans de map du mois en ${offre.plan.name}. Ils reviennent le mois prochain, ou dès maintenant avec une offre payante.`,
    };
  }
  if (offre.plan.maxProjects !== null) {
    const projets = await db.project.count({ where: { userId: user.id } });
    if (projets >= offre.plan.maxProjects) {
      return {
        erreur: `L’offre ${offre.plan.name} permet ${offre.plan.maxProjects} projets actifs. Supprime-en un ou passe à l’offre supérieure.`,
      };
    }
  }

  const projet = await db.project.create({
    data: { userId: user.id, name: analyse.data.titre, genre: 'zombie_survival', templateId: 'zombie_survival' },
  });

  try {
    const plan = await planifier({
      userId: user.id,
      projectId: projet.id,
      titre: analyse.data.titre,
      idee: analyse.data.idee,
      gameId: projet.id,
    });

    await db.$transaction([
      db.gameSpec.create({
        data: {
          projectId: projet.id,
          version: 1,
          specVersion: plan.spec.specVersion,
          data: plan.spec as unknown as Prisma.InputJsonValue,
          author: 'ia',
          note: plan.genreDemande
            ? `Genre demandé (« ${plan.genreDemande} ») pas encore disponible : plan construit sur la survie zombie.`
            : null,
        },
      }),
      db.project.update({ where: { id: projet.id }, data: { currentSpecVersion: 1, name: plan.spec.title } }),
      db.usageCounter.upsert({
        where: { userId_period: { userId: user.id, period: periodeCourante() } },
        create: { userId: user.id, period: periodeCourante(), plans: 1 },
        update: { plans: { increment: 1 } },
      }),
    ]);
  } catch (e) {
    // Pas de projet orphelin sans plan : on le retire, et on dit pourquoi.
    await db.project.delete({ where: { id: projet.id } });
    console.error('[plan] échec', e);
    return {
      erreur:
        'Le plan de map n’a pas pu être généré : la réponse de l’IA n’a pas passé la validation. Rien n’a été décompté, tu peux réessayer.',
    };
  }

  redirect(`/creer/${projet.id}`);
}

export type EtatParametres = { erreur?: string; ok?: string };

function booleen(v: FormDataEntryValue | null) {
  return v === 'on' || v === 'true';
}

export async function enregistrerParametres(
  projectId: string,
  _e: EtatParametres,
  formData: FormData,
): Promise<EtatParametres> {
  const user = await requireUser();
  const projet = await db.project.findFirst({ where: { id: projectId, userId: user.id } });
  if (!projet) return { erreur: 'Projet introuvable.' };

  const courant = await db.gameSpec.findUnique({
    where: { projectId_version: { projectId, version: projet.currentSpecVersion } },
  });
  const lu = courant ? lireGameSpec(courant.data) : null;
  if (!lu?.ok) return { erreur: 'Le plan actuel est illisible : il ne peut pas servir de base.' };

  const brut = Object.fromEntries(formData.entries());
  const p = parametresSchema.safeParse({
    ...brut,
    ui: Object.fromEntries(
      ['score', 'health', 'currency', 'timer', 'round', 'objectives', 'leaderboard'].map((k) => [k, booleen(formData.get(`ui_${k}`))]),
    ),
  });
  if (!p.success) {
    const i = p.error.issues[0];
    return { erreur: `${i?.path.join('.') ?? ''} : ${i?.message ?? 'valeur invalide'}` };
  }

  let suivant;
  try {
    suivant = appliquerParametres(lu.spec, p.data);
  } catch (e) {
    return { erreur: `Plan incohérent : ${(e as Error).message.slice(0, 200)}` };
  }

  const changes = differences(lu.spec, suivant);
  if (changes.length === 0) return { ok: 'Aucune modification.' };

  const version = projet.currentSpecVersion + 1;
  await db.$transaction([
    db.gameSpec.create({
      data: {
        projectId,
        version,
        specVersion: suivant.specVersion,
        data: { ...suivant, version } as unknown as Prisma.InputJsonValue,
        author: 'utilisateur',
        note: `Modifié : ${changes.join(', ')}`,
      },
    }),
    db.project.update({ where: { id: projectId }, data: { currentSpecVersion: version, name: suivant.title } }),
  ]);

  revalidatePath(`/creer/${projectId}`);
  revalidatePath(`/projet/${projectId}`);
  return { ok: `Version ${version} enregistrée (${changes.length} champ${changes.length > 1 ? 's' : ''} modifié${changes.length > 1 ? 's' : ''}).` };
}

export async function restaurerVersion(projectId: string, version: number): Promise<void> {
  const user = await requireUser();
  const projet = await db.project.findFirst({ where: { id: projectId, userId: user.id } });
  if (!projet) return;
  const ancienne = await db.gameSpec.findUnique({ where: { projectId_version: { projectId, version } } });
  if (!ancienne) return;

  // Restaurer crée une nouvelle version : l'historique ne se réécrit pas.
  const nouvelle = projet.currentSpecVersion + 1;
  await db.$transaction([
    db.gameSpec.create({
      data: {
        projectId,
        version: nouvelle,
        specVersion: ancienne.specVersion,
        data: { ...(ancienne.data as object), version: nouvelle } as Prisma.InputJsonValue,
        author: 'restauration',
        note: `Restauration de la version ${version}`,
      },
    }),
    db.project.update({ where: { id: projectId }, data: { currentSpecVersion: nouvelle } }),
  ]);
  revalidatePath(`/projet/${projectId}`);
}
