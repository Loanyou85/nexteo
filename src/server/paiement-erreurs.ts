import 'server-only';

/**
 * Message affiché quand un appel à Stripe échoue.
 *
 * Une erreur de paiement ne doit JAMAIS faire tomber la page : avant ce
 * module, une clé réelle avec des prix de test, une TVA non configurée ou un
 * Stripe injoignable levaient une exception, et la personne qui venait de
 * créer son compte atterrissait sur « Quelque chose s'est mal passé ».
 *
 * Le visiteur lit un message neutre. L'administrateur, lui, lit la cause
 * probable — c'est lui qui peut la corriger, et il n'a pas forcément accès
 * aux journaux de l'hébergeur.
 */

type ErreurStripe = { type?: string; code?: string; message?: string; param?: string };

export const MESSAGE_PAIEMENT_INDISPONIBLE =
  'Le paiement est momentanément indisponible. Rien n’a été facturé. Réessaie dans quelques minutes.';

export function causeProbable(e: unknown): string {
  const err = (e ?? {}) as ErreurStripe;
  const texte = err.message ?? '';
  if (err.code === 'resource_missing') {
    return 'Un identifiant de prix n’existe pas dans ce mode de Stripe : clé réelle avec des prix de test, ou l’inverse';
  }
  if (err.type === 'StripeAuthenticationError' || err.code === 'api_key_expired') return 'Stripe refuse la clé secrète (STRIPE_SECRET_KEY)';
  if (/tax/i.test(texte)) return 'Le calcul automatique de la TVA n’est pas configuré dans Stripe (Settings, Tax, adresse de l’entreprise)';
  if (/portal|configuration/i.test(texte)) return 'Le portail client n’est pas activé dans Stripe (Settings, Billing, Customer portal)';
  if (err.type === 'StripeConnectionError' || err.type === 'StripeAPIError') return 'Stripe est injoignable ou a répondu de travers';
  return 'Erreur Stripe inattendue';
}

export function messagePaiement(e: unknown, admin: boolean): string {
  const err = (e ?? {}) as ErreurStripe;
  // Dans les journaux du serveur : type, code et message, jamais la clé.
  console.error('[paiement] échec Stripe —', err.type ?? 'erreur', err.code ?? '', (err.message ?? String(e)).slice(0, 300));
  if (!admin) return MESSAGE_PAIEMENT_INDISPONIBLE;
  return `${MESSAGE_PAIEMENT_INDISPONIBLE} [Visible des administrateurs seulement] ${causeProbable(e)}. Détail : ${(err.message ?? '').slice(0, 160)}. Contrôle : /api/sante?stripe=1`;
}
