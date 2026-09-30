'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod/v4';
import { validerPrixAnnuel } from '@/lib/tarifs/calculs';
import { requireAdmin } from '@/server/auth';
import { configEntier } from '@/server/config';
import { ajusterSolde } from '@/server/credits';
import { db } from '@/server/db';
import { causeProbable } from '@/server/paiement-erreurs';
import { stripe, stripeActif } from '@/server/stripe';

/**
 * Administration des offres (section 10 de l'offre). Toute modification est
 * historisée ; un changement de prix ne touche jamais les abonnés en cours —
 * leur tarif est figé sur leur abonnement, et un nouveau prix Stripe est créé
 * pour les nouvelles souscriptions.
 */

export type EtatAdmin = { erreur?: string; ok?: string };

/** « 39 », « 39,00 », « 39.5 » → centimes entiers ; vide → null. */
function centimes(v: FormDataEntryValue | null): number | null | 'invalide' {
  const t = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return 'invalide';
  return Math.round(Number(t) * 100);
}

const entierOuNull = z.union([z.literal('').transform(() => null), z.coerce.number().int().min(0).max(1_000_000)]);

export async function modifierOffre(planId: string, _e: EtatAdmin, formData: FormData): Promise<EtatAdmin> {
  const admin = await requireAdmin();
  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) return { erreur: 'Offre introuvable.' };

  const mensuel = centimes(formData.get('mensuel'));
  const annuel = centimes(formData.get('annuel'));
  if (mensuel === 'invalide' || annuel === 'invalide' || mensuel === null) return { erreur: 'Montants en euros, deux décimales au plus.' };

  const champs = z
    .object({
      monthlyCredits: z.coerce.number().int().min(0).max(100_000),
      maxProjects: entierOuNull,
      monthlyGamePlans: entierOuNull,
    })
    .safeParse({
      monthlyCredits: formData.get('credits'),
      maxProjects: formData.get('projets'),
      monthlyGamePlans: formData.get('plans'),
    });
  if (!champs.success) return { erreur: champs.error.issues[0]?.message ?? 'Valeurs invalides.' };

  // La remise annuelle est bornée par la configuration — elle-même plafonnée
  // à 20 % par une contrainte en base.
  const v = validerPrixAnnuel({ mensuelCents: mensuel, annuelCents: annuel, remiseMaxPct: await configEntier('MAX_ANNUAL_DISCOUNT') });
  if (!v.ok) return { erreur: v.erreur };

  const apres = {
    monthlyPriceCents: mensuel,
    annualPriceCents: annuel,
    monthlyCredits: champs.data.monthlyCredits,
    maxProjects: champs.data.maxProjects,
    monthlyGamePlans: champs.data.monthlyGamePlans,
    isActive: formData.get('actif') === 'on',
  };
  const changes = (Object.keys(apres) as (keyof typeof apres)[]).filter((k) => plan[k] !== apres[k]);
  if (changes.length === 0) return { ok: 'Aucune modification.' };

  // Nouveau prix Stripe pour les NOUVELLES souscriptions ; les abonnés en cours
  // gardent le leur.
  const nouveauxPrix: { stripeMonthlyPriceId?: string; stripeAnnualPriceId?: string } = {};
  if (stripeActif() && (changes.includes('monthlyPriceCents') || changes.includes('annualPriceCents'))) {
    // Si Stripe refuse, RIEN n'est enregistré : les prix du site ne doivent
    // jamais différer de ceux que Stripe facturera.
    try {
      const s = stripe();
      const existant = plan.stripeMonthlyPriceId ? await s.prices.retrieve(plan.stripeMonthlyPriceId) : null;
      const produit = existant ? (typeof existant.product === 'string' ? existant.product : existant.product.id) : (await s.products.create({ name: `Nexteo ${plan.name}` })).id;
      if (changes.includes('monthlyPriceCents')) {
        nouveauxPrix.stripeMonthlyPriceId = (await s.prices.create({ product: produit, currency: 'eur', unit_amount: mensuel, tax_behavior: 'inclusive', recurring: { interval: 'month' } })).id;
      }
      if (changes.includes('annualPriceCents') && annuel !== null) {
        nouveauxPrix.stripeAnnualPriceId = (await s.prices.create({ product: produit, currency: 'eur', unit_amount: annuel, tax_behavior: 'inclusive', recurring: { interval: 'year' } })).id;
      }
    } catch (e) {
      console.error('[admin] création du prix Stripe impossible', e);
      return { erreur: `Stripe a refusé la création du nouveau prix : ${causeProbable(e)}. Rien n’a été modifié.` };
    }
  }

  await db.$transaction([
    db.plan.update({ where: { id: planId }, data: { ...apres, ...nouveauxPrix } }),
    ...changes.map((k) =>
      db.planChange.create({
        data: { planId, actorId: admin.id, field: k, before: (plan[k] ?? null) as Prisma.InputJsonValue, after: (apres[k] ?? null) as Prisma.InputJsonValue },
      }),
    ),
  ]);
  revalidatePath('/admin/offres');
  revalidatePath('/tarifs');
  return { ok: `${changes.length} champ(s) modifié(s). Les abonnés en cours conservent leur tarif.` };
}

export async function modifierReglage(cle: string, _e: EtatAdmin, formData: FormData): Promise<EtatAdmin> {
  await requireAdmin();
  const MODIFIABLES: Record<string, { min: number; max: number }> = {
    COST_PER_CREDIT: { min: 1, max: 10_000 },
    TOPUP_MARKUP_PCT: { min: 0, max: 200 },
    // Jamais au-delà de 20 % : sur un produit à coût variable, chaque point de
    // remise sort de la marge.
    MAX_ANNUAL_DISCOUNT: { min: 0, max: 20 },
    ROLLOVER_MONTHS: { min: 0, max: 12 },
    USD_EUR_RATE_PPM: { min: 1, max: 10_000_000 },
  };
  const bornes = MODIFIABLES[cle];
  if (!bornes) return { erreur: 'Réglage non modifiable ici.' };
  const n = Number(formData.get('valeur'));
  if (!Number.isInteger(n) || n < bornes.min || n > bornes.max) return { erreur: `Entier entre ${bornes.min} et ${bornes.max}.` };
  await db.pricingConfig.update({ where: { key: cle }, data: { value: String(n) } });
  revalidatePath('/admin/offres');
  revalidatePath('/tarifs');
  return { ok: 'Enregistré.' };
}

export async function ajusterSoldeUtilisateur(_e: EtatAdmin, formData: FormData): Promise<EtatAdmin> {
  const admin = await requireAdmin();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const delta = Number(formData.get('delta'));
  const note = String(formData.get('note') ?? '').trim();
  if (!note) return { erreur: 'Le motif est obligatoire.' };
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) return { erreur: 'Un nombre entier de crédits, non nul.' };
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { erreur: 'Aucun compte avec cette adresse.' };
  try {
    const n = await ajusterSolde({ userId: user.id, delta, note, actorId: admin.id });
    revalidatePath('/admin/offres');
    return { ok: `Solde de ${email} : ${n} crédit(s).` };
  } catch (e) {
    return { erreur: (e as Error).message };
  }
}
