'use server';

import { revalidatePath } from 'next/cache';
import { mrrDeclareSchema, oubliMrrSchema } from '@/lib/validation/mrr';
import { requireAdmin } from '@/server/auth';
import { db } from '@/server/db';

/**
 * Saisie manuelle des revenus mensuels déclarés.
 *
 * Il n'y a pas d'API pour ça, et il n'y en aura pas : un MRR déclaré se
 * trouve dans un tweet, une page « open startup », une interview de podcast.
 * C'est de la recherche à la main, une entreprise à la fois — donc un
 * formulaire, et pas un import automatique qui donnerait l'illusion d'une
 * source froide.
 *
 * Réservé aux administrateurs : ce champ est la seule donnée de Nexteo qui
 * n'est pas dérivée de l'API Meta, donc la seule qu'un humain puisse salir.
 */

export type ResultatMrr = { ok: true; nom: string } | { ok: false; erreur: string };

export async function enregistrerMrrDeclare(
  _precedent: ResultatMrr | null,
  formulaire: FormData,
): Promise<ResultatMrr> {
  await requireAdmin();

  const analyse = mrrDeclareSchema.safeParse({
    advertiserId: formulaire.get('advertiserId'),
    montantEuros: formulaire.get('montantEuros'),
    source: formulaire.get('source'),
    releveLe: formulaire.get('releveLe'),
  });

  if (!analyse.success) {
    return { ok: false, erreur: analyse.error.issues[0]?.message ?? 'Saisie invalide.' };
  }

  const { advertiserId, montantEuros, source, releveLe } = analyse.data;

  const annonceur = await db.advertiser.findUnique({
    where: { id: advertiserId },
    select: { id: true, name: true, slug: true },
  });
  if (!annonceur) return { ok: false, erreur: 'Cet annonceur n’existe plus.' };

  await db.advertiser.update({
    where: { id: annonceur.id },
    data: {
      // Arrondi au centime : la saisie est en euros, le stockage en centimes,
      // et un flottant traîné jusqu'en base finirait par afficher 4 999,99 €.
      mrrDeclaredCents: Math.round(montantEuros * 100),
      mrrDeclaredSource: source,
      mrrDeclaredAt: releveLe,
    },
  });

  revalidatePath('/admin/mrr');
  revalidatePath(`/annonceur/${annonceur.slug}`);
  revalidatePath('/explore');
  return { ok: true, nom: annonceur.name };
}

/** Retrait d'un montant saisi par erreur : on efface les trois champs ensemble. */
export async function oublierMrrDeclare(
  _precedent: ResultatMrr | null,
  formulaire: FormData,
): Promise<ResultatMrr> {
  await requireAdmin();

  const analyse = oubliMrrSchema.safeParse({ advertiserId: formulaire.get('advertiserId') });
  if (!analyse.success) return { ok: false, erreur: 'Annonceur manquant.' };

  const annonceur = await db.advertiser.findUnique({
    where: { id: analyse.data.advertiserId },
    select: { id: true, name: true, slug: true },
  });
  if (!annonceur) return { ok: false, erreur: 'Cet annonceur n’existe plus.' };

  await db.advertiser.update({
    where: { id: annonceur.id },
    data: { mrrDeclaredCents: null, mrrDeclaredSource: null, mrrDeclaredAt: null },
  });

  revalidatePath('/admin/mrr');
  revalidatePath(`/annonceur/${annonceur.slug}`);
  revalidatePath('/explore');
  return { ok: true, nom: annonceur.name };
}
