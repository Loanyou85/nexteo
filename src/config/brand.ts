/**
 * La marque, en un seul endroit (section 1.2).
 *
 * Le nom ne contient pas la marque d'Epic, et c'est voulu : un produit payant
 * qui porte le nom d'un tiers s'expose à une mise en demeure au moment précis
 * où il commence à marcher. Décrire la compatibilité est admis ; s'approprier
 * le nom ne l'est pas. Changer de nom se fait ici, et nulle part ailleurs.
 */
export const MARQUE = {
  nom: 'Nexteo',
  domaine: 'nexteo.app',
  promesse: 'Décris ton jeu. L’agent le construit.',
  compatibilite: 'Pour UEFN — construit sur le MCP officiel d’Epic Games.',
  emailSupport: 'bonjour@nexteo.app',
  /**
   * Mention d'absence d'affiliation. Elle figure en pied de chaque page :
   * nommer un produit tiers pour décrire une compatibilité est permis, laisser
   * croire à un partenariat ne l'est pas.
   */
  mentionMarques:
    'Nexteo n’est ni affilié à Epic Games, ni approuvé ou sponsorisé par Epic Games. Fortnite, Unreal Editor for Fortnite (UEFN) et Unreal Engine sont des marques d’Epic Games, Inc.',
} as const;
