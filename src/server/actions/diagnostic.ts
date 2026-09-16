'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import type { DomainSource, ProfileStatus } from '@prisma/client';
import { db } from '@/server/db';
import { ensureProfile, currentProfile } from '@/server/diagnostic';
import { genererIdees } from '@/server/ideas';
import { normaliserFrictions, frictionsParMotsCles } from '@/lib/ai/signals';
import { QUESTIONS, indexOfQuestion } from '@/lib/diagnostic/questions';
import { MIN_AGE } from '@/lib/guardrails';
import { classer } from '@/lib/panne/classer';

const entier = (value: FormDataEntryValue | null): number | null => {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? Math.round(n) : null;
};

/**
 * Enregistre une réponse et avance d'une question.
 *
 * Chaque réponse est écrite immédiatement : on peut fermer l'onglet et
 * revenir, y compris sans compte (section 8.1).
 */
export async function repondre(formData: FormData): Promise<void> {
  const key = String(formData.get('key') ?? '');
  const index = indexOfQuestion(key);
  if (index < 0) redirect('/diagnostic');

  // Les redirections lèvent une exception que Next intercepte : elles doivent
  // rester hors du bloc qui attrape les erreurs, sinon on les avale.
  let tropJeune = false;

  try {
    const profile = await ensureProfile();
    const data: Prisma.ProfileUpdateInput = { currentQuestionKey: key };

    switch (key) {
      case 'age': {
        const age = entier(formData.get('value'));
        data.age = age;
        // Garde-fou n° 6 : moins de seize ans, pas de compte.
        if (age != null && age < MIN_AGE) tropJeune = true;
        break;
      }
      case 'status':
        data.status = String(formData.get('value') ?? 'other') as ProfileStatus;
        break;
      case 'domains': {
        const slugs = formData.getAll('value').map(String).filter(Boolean).slice(0, 3);
        const domains = await db.domain.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
        await db.$transaction([
          db.userDomain.deleteMany({ where: { profileId: profile.id } }),
          db.userDomain.createMany({
            data: domains.map((d) => ({ profileId: profile.id, domainId: d.id })),
          }),
        ]);
        break;
      }
      case 'domainKnowledge': {
        const [source, annees] = String(formData.get('value') ?? 'passion-1').split('-');
        await db.userDomain.updateMany({
          where: { profileId: profile.id },
          data: { source: (source ?? 'passion') as DomainSource, yearsExposure: Number(annees ?? 1) },
        });
        break;
      }
      case 'skills': {
        const paires = formData.getAll('value').map(String).filter(Boolean);
        const parSlug = new Map<string, number>();
        for (const paire of paires) {
          const [slug, niveau] = paire.split(':');
          if (slug) parSlug.set(slug, Math.min(5, Math.max(1, Number(niveau ?? 3))));
        }
        const skills = await db.skill.findMany({
          where: { slug: { in: [...parSlug.keys()] } },
          select: { id: true, slug: true },
        });
        await db.$transaction([
          db.userSkill.deleteMany({ where: { profileId: profile.id } }),
          db.userSkill.createMany({
            data: skills.map((s) => ({
              profileId: profile.id,
              skillId: s.id,
              level: parSlug.get(s.slug) ?? 3,
            })),
          }),
        ]);
        break;
      }
      case 'interests': {
        const slugs = formData.getAll('value').map(String).filter(Boolean).slice(0, 4);
        const interests = await db.interest.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
        await db.$transaction([
          db.userInterest.deleteMany({ where: { profileId: profile.id } }),
          db.userInterest.createMany({
            data: interests.map((i) => ({ profileId: profile.id, interestId: i.id })),
          }),
        ]);
        break;
      }
      case 'reachableCount':
        data.reachableCount = entier(formData.get('value'));
        break;
      case 'hoursPerWeek':
        data.hoursPerWeek = entier(formData.get('value'));
        break;
      case 'budget':
        data.budget = entier(formData.get('value'));
        break;
      case 'technicalLevel':
        data.technicalLevel = entier(formData.get('value'));
        break;
      case 'goalRevenue':
        data.goalRevenue = entier(formData.get('value'));
        break;
      case 'timeHorizon':
        data.timeHorizon = entier(formData.get('value'));
        break;
      case 'showsFace':
        data.showsFace = String(formData.get('value')) === 'oui';
        break;
      case 'prefersSolo':
        data.prefersSolo = String(formData.get('value')) === 'oui';
        break;
      default: {
        // Questions ouvertes : stockées telles quelles, normalisées à la fin.
        const answer = String(formData.get('value') ?? '').trim();
        if (answer.length > 0) {
          await db.frictionAnswer.upsert({
            where: { profileId_questionKey: { profileId: profile.id, questionKey: key } },
            create: { profileId: profile.id, questionKey: key, answer: answer.slice(0, 2000) },
            update: { answer: answer.slice(0, 2000) },
          });
        }
      }
    }

    await db.profile.update({ where: { id: profile.id }, data });
  } catch (error) {
    console.error(`[diagnostic] enregistrement de la question « ${key} » impossible`, error);
    // On ne lève pas : Next masquerait le message et ne laisserait qu'un
    // identifiant illisible sans accès aux journaux. On envoie vers un écran
    // qui dit ce qui s'est passé, en français.
    redirect(`/diagnostic/probleme?code=${encodeURIComponent(classer(error))}&question=${encodeURIComponent(key)}`);
  }

  if (tropJeune) redirect('/trop-jeune');

  const suivante = index + 1;
  if (suivante >= QUESTIONS.length) redirect('/diagnostic/analyse');
  redirect(`/diagnostic?q=${suivante}`);
}

/**
 * Repart de zéro. Les réponses sont effacées, les idées proposées aussi — mais
 * pas celle qui a été choisie ni le parcours en cours : quelqu'un qui cherche
 * une deuxième idée ne doit pas perdre le SaaS qu'il est en train de
 * construire.
 */
export async function recommencerDiagnostic(): Promise<void> {
  const profile = await currentProfile();
  if (!profile) redirect('/diagnostic');

  const cle = profile.userId ? { userId: profile.userId } : { anonId: profile.anonId! };

  await db.$transaction([
    db.frictionAnswer.deleteMany({ where: { profileId: profile.id } }),
    db.userDomain.deleteMany({ where: { profileId: profile.id } }),
    db.userSkill.deleteMany({ where: { profileId: profile.id } }),
    db.userInterest.deleteMany({ where: { profileId: profile.id } }),
    db.idea.deleteMany({ where: { ...cle, status: { in: ['proposed', 'rejected'] } } }),
    db.profile.update({
      where: { id: profile.id },
      data: {
        currentQuestionKey: null,
        completedAt: null,
        derivedSignals: Prisma.DbNull,
        status: null,
        hoursPerWeek: null,
        budget: null,
        technicalLevel: null,
        goalRevenue: null,
        timeHorizon: null,
        showsFace: null,
        prefersSolo: null,
        reachableCount: null,
      },
    }),
  ]);

  revalidatePath('/mes-idees');
  redirect('/diagnostic');
}

/** Revient d'une question. La barre de progression, elle, ne recule pas. */
export async function revenir(formData: FormData): Promise<void> {
  const index = Number(formData.get('index') ?? 0);
  redirect(`/diagnostic?q=${Math.max(0, index - 1)}`);
}

/**
 * Fin du diagnostic : on normalise les réponses libres, puis on classe.
 * L'IA n'intervient qu'ici, et seulement pour traduire du texte en clés.
 */
export async function terminerDiagnostic(): Promise<void> {
  const profile = await currentProfile();
  if (!profile) redirect('/diagnostic');

  const reponses = await db.frictionAnswer.findMany({ where: { profileId: profile.id } });
  const questions = new Map(QUESTIONS.map((q) => [q.key, q.title]));

  let signaux: string[] = [];
  try {
    signaux = await normaliserFrictions(
      reponses.map((r) => ({ question: questions.get(r.questionKey) ?? r.questionKey, answer: r.answer })),
    );
  } catch (error) {
    // Le classement est déterministe et n'a pas besoin du modèle : une panne
    // ici ne doit jamais empêcher quelqu'un de voir ses idées.
    console.error('[diagnostic] normalisation des irritants impossible', error);
  }
  if (signaux.length === 0) signaux = frictionsParMotsCles(reponses);

  const misAJour = await db.profile.update({
    where: { id: profile.id },
    data: { derivedSignals: { frictions: signaux }, completedAt: new Date() },
  });

  await genererIdees(misAJour);
  revalidatePath('/mes-idees');
  redirect('/mes-idees');
}
