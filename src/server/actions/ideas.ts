'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { sessionOuNull } from '@/server/auth';
import { currentProfile } from '@/server/diagnostic';
import { genererIdees, redigerJustification } from '@/server/ideas';
import { demarrerParcours } from '@/server/journey';
import { MAX_REJETS } from '@/lib/ideas/politique';

async function cle() {
  const profile = await currentProfile();
  if (!profile) redirect('/diagnostic');
  return profile.userId ? { userId: profile.userId } : { anonId: profile.anonId! };
}

/**
 * Choisir une idée. C'est le point de bascule (section 13) : à partir d'ici,
 * il faut un compte — mais la personne a déjà reçu ses trois idées et leur
 * justification avant qu'on lui demande quoi que ce soit.
 */
export async function choisirIdee(formData: FormData): Promise<void> {
  const ideaId = String(formData.get('ideaId') ?? '');
  const filtre = await cle();

  const idea = await db.idea.findFirst({ where: { id: ideaId, ...filtre } });
  if (!idea) redirect('/mes-idees');

  await db.idea.updateMany({ where: { ...filtre, status: 'selected' }, data: { status: 'proposed' } });
  await db.idea.update({ where: { id: idea.id }, data: { status: 'selected' } });

  const session = await sessionOuNull();
  if (!session?.user?.id) redirect(`/inscription?idee=${idea.id}`);

  await demarrerParcours(session.user.id, idea.id);
  revalidatePath('/app');
  redirect('/offres');
}

/** Rejeter, avec une raison qui alimente le moteur. */
export async function rejeterIdee(formData: FormData): Promise<void> {
  const ideaId = String(formData.get('ideaId') ?? '');
  const raison = String(formData.get('raison') ?? '').slice(0, 200);
  const filtre = await cle();

  const idea = await db.idea.findFirst({ where: { id: ideaId, ...filtre } });
  if (!idea) redirect('/mes-idees');

  await db.idea.update({
    where: { id: idea.id },
    data: { status: 'rejected', rejectionReason: raison },
  });

  const rejets = await db.idea.count({ where: { ...filtre, status: 'rejected' } });
  if (rejets >= MAX_REJETS) {
    revalidatePath('/mes-idees');
    redirect('/mes-idees?completer=1');
  }

  const profile = await currentProfile();
  if (profile) await genererIdees(profile);
  revalidatePath('/mes-idees');
  redirect('/mes-idees');
}

/** Rédige la justification d'une idée à la demande, sans bloquer l'affichage. */
export async function expliquerIdee(formData: FormData): Promise<void> {
  const ideaId = String(formData.get('ideaId') ?? '');
  await redigerJustification(ideaId);
  revalidatePath('/mes-idees');
}
