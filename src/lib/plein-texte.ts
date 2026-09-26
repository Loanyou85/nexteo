/**
 * Traduction d'une saisie libre en requête `to_tsquery`.
 *
 * Chaque mot devient un préfixe : « stri » doit trouver « Stripe ». Sans le
 * `:*`, le plein texte ne rattrape que les mots entiers, et personne ne tape
 * un nom de marque en entier avant d'attendre un résultat.
 *
 * La ponctuation est retirée plutôt qu'échappée : un guillemet ou une
 * parenthèse laissés dans l'expression font échouer `to_tsquery` côté
 * PostgreSQL, ce qui transformerait une faute de frappe en erreur 500.
 *
 * Les mots de un ou deux caractères sont écartés : leur préfixe sélectionne
 * une part énorme de l'index, et l'index cesse alors de servir à quoi que ce
 * soit.
 */
export function requetePrefixe(saisie: string): string | null {
  const expression = saisie
    .split(/\s+/)
    .map((mot) => mot.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((mot) => mot.length > 2)
    .map((mot) => `${mot}:*`)
    .join(' & ');

  return expression || null;
}
