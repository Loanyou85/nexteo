/**
 * Garde-fous (sections 1.2, 10 et 11).
 *
 * La règle centrale de ce produit : **aucun montant attribué à une entreprise
 * tierce, nulle part.** Ni calculé, ni estimé, ni déduit, ni en fourchette, ni
 * sous une formulation détournée du type « potentiel de revenu ».
 *
 * Ce n'est pas une préférence éditoriale. Personne ne connaît le chiffre
 * d'affaires d'un SaaS privé : les outils qui en affichent un affichent une
 * supposition. Nexteo mesure un fait observable — depuis combien de temps une
 * entreprise paie pour diffuser — et c'est à la fois son positionnement et sa
 * protection juridique. Une seule phrase qui parle d'argent les détruit tous
 * les deux.
 */

/** Vocabulaire banni partout, y compris e-mails et métadonnées (section 10). */
const MOTS_BANNIS: { motif: RegExp; pourquoi: string }[] = [
  { motif: /\bgagne(?:r|nt|z)?\b/i, pourquoi: 'promesse de gain' },
  { motif: /\brevenus?\b/i, pourquoi: 'donnée de revenu' },
  { motif: /\brentab(?:le|ilité|les)\b/i, pourquoi: 'jugement de rentabilité' },
  { motif: /\bmrr\b/i, pourquoi: 'revenu récurrent' },
  { motif: /\bchiffre d[’']affaires\b/i, pourquoi: 'donnée de revenu' },
  { motif: /\bargent\b/i, pourquoi: 'référence monétaire' },
  { motif: /\briche(?:s)?\b/i, pourquoi: 'promesse d’enrichissement' },
  { motif: /\bpassif(?:s|ve)?\b/i, pourquoi: 'promesse de revenu passif' },
  { motif: /\bgaranti(?:e|s|es)?\b/i, pourquoi: 'garantie de résultat' },
];

/**
 * Formulations détournées. Elles ne contiennent aucun mot banni et disent
 * pourtant la même chose — c'est exactement contre celles-ci que la
 * section 1.2 met en garde.
 */
const DETOURNEMENTS: { motif: RegExp; pourquoi: string }[] = [
  { motif: /\bpotentiel (?:de|financier)\b/i, pourquoi: 'revenu déguisé en potentiel' },
  { motif: /\btaille estimée\b/i, pourquoi: 'estimation de taille financière' },
  { motif: /\bvaloris\w+\b/i, pourquoi: 'valorisation estimée' },
  { motif: /\bencaisse\w*\s+\d/i, pourquoi: 'montant attribué' },
  { motif: /\d\s?(?:€|eur\b|k€|euros?)\s*(?:\/|par\s)\s*mois/i, pourquoi: 'montant mensuel attribué' },
];

export type Violation = { extrait: string; pourquoi: string };

/**
 * Cherche le vocabulaire interdit dans un texte destiné à l'utilisateur.
 *
 * `contexteTarifaire` désactive les motifs purement monétaires : la page des
 * tarifs affiche légitimement 19 € par mois, et c'est le prix de Nexteo, pas
 * un montant attribué à un annonceur.
 */
export function chercherViolations(
  texte: string,
  options: { contexteTarifaire?: boolean } = {},
): Violation[] {
  const regles = options.contexteTarifaire
    ? [...MOTS_BANNIS, ...DETOURNEMENTS].filter((r) => !/€|euros?|encaisse/i.test(r.motif.source))
    : [...MOTS_BANNIS, ...DETOURNEMENTS];

  const trouvees: Violation[] = [];
  for (const regle of regles) {
    const m = regle.motif.exec(texte);
    if (m) trouvees.push({ extrait: m[0], pourquoi: regle.pourquoi });
  }
  return trouvees;
}

export function refuserSiInterdit(texte: string, provenance: string): void {
  const violations = chercherViolations(texte);
  if (violations.length > 0) {
    throw new Error(
      `Vocabulaire interdit dans ${provenance} : ` +
        violations.map((v) => `« ${v.extrait} » (${v.pourquoi})`).join(', '),
    );
  }
}

/**
 * Mention obligatoire sous la barre de recherche de l'accueil (section 6.1).
 * Elle dit d'où vient la donnée et ce que Nexteo ne publie pas.
 */
export const MENTION_SOURCE =
  'Données issues de la bibliothèque publicitaire de Meta. ' +
  'Aucune donnée de revenu n’est publiée par Nexteo.';

/** Étiquette apposée à toute donnée de démonstration (garde-fou n° 2). */
export const ETIQUETTE_DEMO = 'Démonstration';

/**
 * Vocabulaire imposé sur /opportunites (section 6.5).
 * Le produit ne prétend jamais qu'une idée sera rentable : il décrit ce qu'il
 * a observé, et s'arrête là.
 */
export const VOCABULAIRE_OPPORTUNITES = {
  titre: 'Signaux de marché',
  observations: 'Éléments observés',
  piste: 'Angle possible',
} as const;
