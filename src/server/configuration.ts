import 'server-only';

/**
 * Auth.js refuse de signer une session sans secret. Sans ce test, l'inscription
 * créait le compte puis échouait en silence à la connexion : la personne
 * atterrissait sur la page de connexion sans un mot d'explication, avec un
 * compte qu'elle ne pouvait jamais ouvrir.
 */
export function secretAuthManquant(): boolean {
  return !(process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim());
}

export const MESSAGE_SECRET_MANQUANT =
  'Le site n’est pas encore configuré pour les connexions : rien n’a été créé. Si tu es l’administrateur, la variable AUTH_SECRET manque.';
