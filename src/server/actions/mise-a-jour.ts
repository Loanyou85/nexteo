'use server';

import type { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { z } from 'zod/v4';
import { appliquerParametres, parametresDe, parametresSchema } from '@/lib/gamespec/parametres';
import { differences, lireGameSpec } from '@/lib/gamespec/schema';
import { requireUser } from '@/server/auth';
import { db } from '@/server/db';
import { appelIA } from '@/server/ia';

/**
 * « Ajoute un boss à la vague 10 » (section 21) — la fonction qui fait revenir
 * l'utilisateur. La demande devient de nouveaux paramètres, donc une nouvelle
 * version du plan, que l'utilisateur relit avant de lancer. La construction
 * qui suit ne refait que ce qui a changé.
 */

export type EtatMiseAJour = { erreur?: string };

const demandeSchema = z.string().trim().min(6, 'Décris la modification en quelques mots.').max(600);

export async function demanderMiseAJour(projectId: string, _e: EtatMiseAJour, formData: FormData): Promise<EtatMiseAJour> {
  const user = await requireUser();
  const demande = demandeSchema.safeParse(formData.get('demande'));
  if (!demande.success) return { erreur: demande.error.issues[0]?.message };

  const projet = await db.project.findFirst({ where: { id: projectId, userId: user.id } });
  if (!projet) return { erreur: 'Projet introuvable.' };
  const ligne = await db.gameSpec.findUnique({ where: { projectId_version: { projectId, version: projet.currentSpecVersion } } });
  const lu = ligne ? lireGameSpec(ligne.data) : null;
  if (!lu?.ok) return { erreur: 'Le plan actuel est illisible.' };

  const actuels = parametresDe(lu.spec);
  let suivant;
  try {
    const r = await appelIA({ userId: user.id, projectId, type: 'plan' }, (ia) =>
      ia.structuredOutput({
        systeme:
          'Tu modifies les paramètres d’un jeu UEFN selon une demande. Ne change QUE ce que la demande nomme ; recopie tout le reste à l’identique.',
        message: `Paramètres actuels : ${JSON.stringify(actuels)}\nDemande : ${demande.data}`,
        schema: parametresSchema,
        nomSchema: 'Parametres',
        simulation: { parametres: actuels, demande: demande.data },
      }),
    );
    suivant = appliquerParametres(lu.spec, r.valeur);
  } catch {
    return { erreur: 'La demande n’a pas pu être traduite en un plan valide. Reformule-la, ou modifie le plan directement.' };
  }

  const changes = differences(lu.spec, suivant);
  if (changes.length === 0) {
    return { erreur: 'Cette demande ne change rien au plan actuel. Précise ce qui doit changer (joueurs, manches, boss, vitesse, gains…).' };
  }

  const version = projet.currentSpecVersion + 1;
  await db.$transaction([
    db.gameSpec.create({
      data: {
        projectId,
        version,
        specVersion: suivant.specVersion,
        data: { ...suivant, version } as unknown as Prisma.InputJsonValue,
        author: 'ia',
        note: `Mise à jour demandée : « ${demande.data} ». Modifié : ${changes.join(', ')}.`,
      },
    }),
    db.project.update({ where: { id: projectId }, data: { currentSpecVersion: version } }),
  ]);
  redirect(`/creer/${projectId}`);
}
