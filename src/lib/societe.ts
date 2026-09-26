/**
 * Mentions légales et informations d'éditeur.
 *
 * Les valeurs entre crochets sont à compléter par le fondateur : elles ne
 * peuvent pas être devinées, et une mention légale inventée serait pire que
 * pas de mention du tout. Les pages les affichent telles quelles, crochets
 * compris, pour qu'un oubli se voie immédiatement.
 */
export const SOCIETE = {
  nom: '[Raison sociale]',
  formeJuridique: '[Forme juridique]',
  siege: '[Adresse du siège social]',
  siret: '[SIRET]',
  tva: '[Numéro de TVA intracommunautaire]',
  directeurPublication: '[Nom du directeur de la publication]',
  hebergeur: 'Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis',
  /** Hébergement des données personnelles, exigé en UE (garde-fou n° 5). */
  hebergeurDonnees: '[Hébergeur de la base, région UE]',
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'bonjour@nexteo.app',
} as const;

/** Durées de conservation documentées (garde-fou n° 5). */
export const CONSERVATION = {
  compte: '36 mois après la dernière connexion',
  facturation: '10 ans, obligation comptable',
  journauxTechniques: '12 mois',
} as const;

/** Une mention non renseignée se repère à ses crochets. */
export function estAComplete(valeur: string): boolean {
  return valeur.startsWith('[') && valeur.endsWith(']');
}
