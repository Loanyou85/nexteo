'use server';

import { revalidatePath } from 'next/cache';
import { SavedItemType } from '@prisma/client';
import { z } from 'zod';
import { aLeDroit, DROITS } from '@/lib/plans';
import { requireUser } from '@/server/auth';
import { db } from '@/server/db';
import { planActif } from '@/server/quota';

/**
 * Enregistrer, ranger, suivre.
 *
 * Toutes ces actions vérifient le plan côté serveur. Masquer un bouton n'est
 * pas une protection : un appel direct à l'action passerait, et le quota
 * deviendrait décoratif.
 *
 * Les limites sont contrôlées avant l'écriture, jamais après. Écrire puis
 * compter laisserait passer un élément à chaque fois.
 */

export type Resultat = { ok: true; message?: string } | { ok: false; erreur: string };

const idSchema = z.string().min(1).max(64);
const typeSchema = z.nativeEnum(SavedItemType);

async function limiteAtteinte(userId: string): Promise<string | null> {
  const plan = await planActif(userId);
  const plafond = DROITS[plan].elementsEnregistres;

  if (plafond === 0) {
    return 'Enregistrer un élément demande un abonnement. Il n’y a pas d’offre gratuite.';
  }

  if (plafond === Infinity) return null;

  const deja = await db.savedItem.count({ where: { userId } });
  return deja >= plafond
    ? `Ton offre plafonne à ${plafond} éléments enregistrés. Retire-en un, ou passe à Pro Plus.`
    : null;
}

export async function enregistrerElement(
  _precedent: Resultat | null,
  formulaire: FormData,
): Promise<Resultat> {
  const user = await requireUser();

  const analyse = z
    .object({
      itemType: typeSchema,
      itemId: idSchema,
      collectionId: z.string().max(64).optional(),
      note: z.string().max(500).optional(),
    })
    .safeParse({
      itemType: formulaire.get('itemType'),
      itemId: formulaire.get('itemId'),
      collectionId: formulaire.get('collectionId') || undefined,
      note: formulaire.get('note') || undefined,
    });

  if (!analyse.success) return { ok: false, erreur: 'Élément invalide.' };
  const { itemType, itemId, collectionId, note } = analyse.data;

  // La collection doit appartenir au compte : sinon n'importe qui rangerait un
  // élément dans la collection d'un autre en devinant son identifiant.
  if (collectionId) {
    const sienne = await db.collection.findFirst({
      where: { id: collectionId, userId: user.id },
      select: { id: true },
    });
    if (!sienne) return { ok: false, erreur: 'Cette collection n’existe pas.' };
  }

  const existe = await db.savedItem.findFirst({
    where: { userId: user.id, itemType, itemId, collectionId: collectionId ?? null },
    select: { id: true },
  });

  if (existe) {
    await db.savedItem.delete({ where: { id: existe.id } });
    revalidatePath('/collections');
    return { ok: true, message: 'Retiré.' };
  }

  const refus = await limiteAtteinte(user.id);
  if (refus) return { ok: false, erreur: refus };

  await db.savedItem.create({
    data: { userId: user.id, itemType, itemId, collectionId: collectionId ?? null, note: note ?? null },
  });

  revalidatePath('/collections');
  return { ok: true, message: 'Enregistré.' };
}

export async function retirerElement(
  _precedent: Resultat | null,
  formulaire: FormData,
): Promise<Resultat> {
  const user = await requireUser();
  const id = idSchema.safeParse(formulaire.get('savedItemId'));
  if (!id.success) return { ok: false, erreur: 'Élément invalide.' };

  // `deleteMany` avec le propriétaire dans le filtre : un `delete` par
  // identifiant seul supprimerait l'élément de quelqu'un d'autre.
  const { count } = await db.savedItem.deleteMany({ where: { id: id.data, userId: user.id } });
  if (count === 0) return { ok: false, erreur: 'Cet élément n’est plus là.' };

  revalidatePath('/collections');
  return { ok: true, message: 'Retiré.' };
}

export async function creerCollection(
  _precedent: Resultat | null,
  formulaire: FormData,
): Promise<Resultat> {
  const user = await requireUser();

  const analyse = z
    .string()
    .trim()
    .min(1, 'Donne un nom à la collection.')
    .max(60, 'Soixante caractères au maximum.')
    .safeParse(formulaire.get('name'));

  if (!analyse.success) {
    return { ok: false, erreur: analyse.error.issues[0]?.message ?? 'Nom invalide.' };
  }

  const plan = await planActif(user.id);
  if (DROITS[plan].elementsEnregistres === 0) {
    return { ok: false, erreur: 'Les collections demandent un abonnement.' };
  }

  const doublon = await db.collection.findFirst({
    where: { userId: user.id, name: analyse.data },
    select: { id: true },
  });
  if (doublon) return { ok: false, erreur: 'Tu as déjà une collection de ce nom.' };

  await db.collection.create({ data: { userId: user.id, name: analyse.data } });
  revalidatePath('/collections');
  return { ok: true, message: 'Collection créée.' };
}

export async function supprimerCollection(
  _precedent: Resultat | null,
  formulaire: FormData,
): Promise<Resultat> {
  const user = await requireUser();
  const id = idSchema.safeParse(formulaire.get('collectionId'));
  if (!id.success) return { ok: false, erreur: 'Collection invalide.' };

  // `onDelete: SetNull` sur SavedItem : les éléments rangés dedans ne
  // disparaissent pas avec le classeur, ils retournent dans « sans collection ».
  const { count } = await db.collection.deleteMany({ where: { id: id.data, userId: user.id } });
  if (count === 0) return { ok: false, erreur: 'Cette collection n’existe plus.' };

  revalidatePath('/collections');
  return { ok: true, message: 'Collection supprimée, ses éléments sont conservés.' };
}

export async function basculerSuivi(
  _precedent: Resultat | null,
  formulaire: FormData,
): Promise<Resultat> {
  const user = await requireUser();
  const id = idSchema.safeParse(formulaire.get('advertiserId'));
  if (!id.success) return { ok: false, erreur: 'Annonceur invalide.' };

  const plan = await planActif(user.id);
  if (!aLeDroit(plan, 'suiviAnnonceurs')) {
    return { ok: false, erreur: 'Le suivi d’annonceurs demande l’offre Pro Plus.' };
  }

  const existe = await db.watch.findFirst({
    where: { userId: user.id, advertiserId: id.data },
    select: { id: true },
  });

  if (existe) {
    await db.watch.delete({ where: { id: existe.id } });
    revalidatePath('/dashboard');
    return { ok: true, message: 'Suivi arrêté.' };
  }

  const annonceur = await db.advertiser.findUnique({
    where: { id: id.data },
    select: { id: true, slug: true },
  });
  if (!annonceur) return { ok: false, erreur: 'Cet annonceur n’existe plus.' };

  await db.watch.create({ data: { userId: user.id, advertiserId: annonceur.id } });
  revalidatePath('/dashboard');
  revalidatePath(`/annonceur/${annonceur.slug}`);
  return { ok: true, message: 'Suivi. Les nouvelles annonces seront comptées à partir de maintenant.' };
}
