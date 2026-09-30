'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/server/auth';
import { db } from '@/server/db';
import { semer } from '@/server/semis';

export type EtatReparation = { ok?: string; erreur?: string };

/**
 * Crée les offres, réglages, environnements, devices et modèles qui manquent.
 *
 * Même code que le semis du déploiement, donc même résultat : il ne crée que
 * ce qui est absent et ne modifie ni n'efface jamais rien — un prix changé en
 * administration n'est pas touché. Réservé aux administrateurs.
 */
export async function reparerBase(): Promise<EtatReparation> {
  await requireAdmin();
  try {
    const crees = await semer(db);
    revalidatePath('/', 'layout');
    return { ok: crees > 0 ? `${crees} élément(s) créé(s). Le site est de nouveau utilisable : recharge la page tarifs.` : 'Rien à créer : tout est déjà en place.' };
  } catch (e) {
    console.error('[reparation] semis impossible', e);
    const lignes = String((e as Error).message).split('\n').map((l) => l.trim()).filter((l) => l && !/^Invalid `.*` invocation/.test(l));
    return { erreur: `Le remplissage a échoué : ${(lignes[0] ?? 'erreur inconnue').slice(0, 240)}` };
  }
}
