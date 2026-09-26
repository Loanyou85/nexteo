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

/**
 * Vocabulaire banni dans les textes que Nexteo ÉCRIT.
 *
 * « MRR » et « revenu » n'y figurent plus : le fondateur a décidé d'afficher
 * ces montants, et ils ont désormais des composants dédiés qui portent leur
 * provenance — déclaré avec sa source, ou estimé avec sa méthode et sa
 * fourchette. Les bannir ici empêcherait de les nommer correctement.
 *
 * Ce qui reste banni, c'est la PROMESSE : un gain annoncé, une rentabilité
 * affirmée, une garantie de résultat. Afficher un montant sourcé et afficher
 * « tu vas gagner » ne sont pas la même chose, et seule la seconde est
 * indéfendable.
 */
const MOTS_BANNIS: { motif: RegExp; pourquoi: string }[] = [
  { motif: /\bgagne(?:r|nt|z)?\b/i, pourquoi: 'promesse de gain' },
  { motif: /\brentab(?:le|ilité|les)\b/i, pourquoi: 'jugement de rentabilité' },
  { motif: /\briche(?:s)?\b/i, pourquoi: 'promesse d’enrichissement' },
  { motif: /\bpassif(?:s|ve)?\b/i, pourquoi: 'promesse de revenu passif' },
  { motif: /\bgaranti(?:e|s|es)?\b/i, pourquoi: 'garantie de résultat' },
  { motif: /\bargent facile\b/i, pourquoi: 'promesse d’enrichissement' },
];

/**
 * Formulations détournées. Elles ne contiennent aucun mot banni et disent
 * pourtant la même chose — c'est exactement contre celles-ci que la
 * section 1.2 met en garde.
 */
const DETOURNEMENTS: { motif: RegExp; pourquoi: string }[] = [
  { motif: /\bpotentiel (?:de|financier)\b/i, pourquoi: 'revenu déguisé en potentiel' },
  { motif: /\bvaloris\w+\b/i, pourquoi: 'valorisation estimée' },
];

/**
 * Un montant n'est publiable que s'il porte sa provenance.
 *
 * C'est la règle qui remplace l'interdiction pure : afficher « 42 k€/mois »
 * seul est indéfendable ; afficher « 42 k€/mois, déclaré par l'entreprise le
 * 12 mars » ou « 18–110 k€/mois, estimé, méthode ci-contre » l'est.
 */
export type Provenance =
  | { type: 'declare'; source: string; releveLe: Date }
  | { type: 'estime'; methode: string; fiabilite: 'faible' | 'moyenne' };

export function provenanceComplete(p: Provenance): boolean {
  return p.type === 'declare'
    ? Boolean(p.source?.startsWith('http')) && !Number.isNaN(p.releveLe?.getTime?.())
    : Boolean(p.methode && p.methode.length > 40);
}

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
 * Mention affichée sous la recherche et en pied de page.
 *
 * Elle disait « aucune donnée de revenu n'est publiée par Nexteo ». Depuis que
 * le produit affiche des montants, cette phrase est devenue fausse — et une
 * mention fausse est pire que pas de mention. Elle dit maintenant exactement
 * ce qui est publié et à quel titre.
 */
export const MENTION_SOURCE =
  'Données issues de la bibliothèque publicitaire de Meta. ' +
  'Les montants déclarés proviennent des entreprises elles-mêmes ; ' +
  'les estimations sont calculées par Nexteo et signalées comme telles.';

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
