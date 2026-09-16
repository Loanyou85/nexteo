import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import type { Profile } from '@prisma/client';
import { db } from '@/server/db';
import { sessionOuNull } from '@/server/auth';
import { QUESTIONS, indexOfQuestion } from '@/lib/diagnostic/questions';

/**
 * Le diagnostic est public et sans inscription (section 8.1). Un identifiant
 * anonyme est posé en cookie et porte le profil jusqu'à la création du compte,
 * où il lui est rattaché (section 14.7).
 */
const COOKIE = 'nexteo_diagnostic';
const DUREE = 60 * 60 * 24 * 90;

export async function anonId(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

/** Profil courant, sans en créer : pour les écrans qui lisent seulement. */
export async function currentProfile(): Promise<Profile | null> {
  // Le cookie anonyme d'abord : c'est le cas courant, et il n'a besoin de rien
  // d'autre que la base.
  const id = await anonId();
  if (id) {
    const anonyme = await db.profile.findUnique({ where: { anonId: id } });
    if (anonyme) return anonyme;
  }

  const session = await sessionOuNull();
  if (session?.user?.id) {
    return db.profile.findUnique({ where: { userId: session.user.id } });
  }
  return null;
}

/**
 * Profil courant, créé au besoin. Le cookie est posé ici, donc uniquement
 * depuis une Server Action ou un gestionnaire de route : Next refuse d'écrire
 * un cookie pendant le rendu d'une page.
 */
export async function ensureProfile(): Promise<Profile> {
  const existant = await currentProfile();
  if (existant) return existant;

  const session = await sessionOuNull();
  if (session?.user?.id) {
    return db.profile.create({ data: { userId: session.user.id } });
  }

  const id = randomUUID();
  const profile = await db.profile.create({ data: { anonId: id } });
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DUREE,
    path: '/',
  });
  return profile;
}

/**
 * Rattache un diagnostic anonyme au compte qui vient d'être créé.
 *
 * Si la personne avait déjà un profil sur ce compte, on garde le sien et on
 * jette l'anonyme : écraser ce qu'elle a déjà répondu serait pire que de
 * perdre un diagnostic qu'elle vient de refaire.
 */
export async function rattacherProfil(userId: string): Promise<void> {
  const id = await anonId();
  if (!id) return;

  const anonyme = await db.profile.findUnique({ where: { anonId: id } });
  if (!anonyme) return;

  const existant = await db.profile.findUnique({ where: { userId } });
  if (existant) {
    await db.profile.delete({ where: { id: anonyme.id } });
  } else {
    await db.$transaction([
      db.profile.update({ where: { id: anonyme.id }, data: { userId, anonId: null } }),
      db.idea.updateMany({ where: { anonId: id }, data: { userId, anonId: null } }),
    ]);
  }

  (await cookies()).delete(COOKIE);
}

/** Position dans le diagnostic, pour la barre de progression et la reprise. */
export function progressionDe(profile: Profile | null): { index: number; percent: number } {
  if (!profile?.currentQuestionKey) return { index: 0, percent: 0 };
  const index = indexOfQuestion(profile.currentQuestionKey);
  // `currentQuestionKey` porte la dernière question **répondue** : la
  // prochaine est la suivante.
  const prochain = index < 0 ? 0 : Math.min(index + 1, QUESTIONS.length);
  return { index: prochain, percent: Math.round((prochain / QUESTIONS.length) * 100) };
}

/** Le référentiel affiché par les questions à choix multiples. */
export async function referentiel(source: 'domains' | 'interests' | 'skills') {
  if (source === 'domains') {
    return db.domain.findMany({ orderBy: [{ family: 'asc' }, { label: 'asc' }] });
  }
  if (source === 'interests') return db.interest.findMany({ orderBy: { label: 'asc' } });
  return db.skill.findMany({ orderBy: [{ category: 'asc' }, { label: 'asc' }] });
}
