'use server';

import { redirect } from 'next/navigation';
import { requireUser, signOut } from '@/server/auth';
import { db } from '@/server/db';
import { stripe, stripeActif } from '@/server/stripe';

export type EtatSuppression = { erreur?: string };

/**
 * Suppression définitive du compte (garde-fou n° 7, RGPD).
 *
 * L'abonnement Stripe est résilié d'abord : supprimer le compte sans arrêter
 * la facturation serait le pire des deux mondes. Puis tout part en cascade —
 * y compris le registre de crédits, en ajout seul partout ailleurs, dont le
 * déclencheur n'autorise la suppression que dans cette transaction précise.
 */
export async function supprimerMonCompte(_e: EtatSuppression, formData: FormData): Promise<EtatSuppression> {
  const user = await requireUser();
  const confirmation = String(formData.get('confirmation') ?? '').trim().toLowerCase();
  if (!user.email || confirmation !== user.email.toLowerCase()) {
    return { erreur: 'Recopie exactement ton adresse e-mail pour confirmer.' };
  }

  const abonnement = await db.subscription.findUnique({ where: { userId: user.id } });
  if (abonnement?.stripeSubscriptionId && stripeActif() && ['active', 'trialing', 'past_due'].includes(abonnement.status)) {
    try {
      await stripe().subscriptions.cancel(abonnement.stripeSubscriptionId);
    } catch (e) {
      console.error('[compte] résiliation Stripe impossible', e);
      return { erreur: 'La résiliation de l’abonnement a échoué : rien n’a été supprimé. Réessaie, ou résilie depuis le portail de paiement.' };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL nexteo.suppression_compte = 'on'`);
    await tx.user.delete({ where: { id: user.id } });
  });

  await signOut({ redirect: false });
  redirect('/?compte=supprime');
}
