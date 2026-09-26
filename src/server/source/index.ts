import { FixtureSource } from './fixture';
import { MetaAdLibrarySource } from './meta';
import type { AdSource } from './types';

export * from './types';
export { FixtureSource } from './fixture';
export { MetaAdLibrarySource } from './meta';
export { normaliser, domaineDepuisCaption, type AnnonceNormalisee } from './normaliser';

/**
 * Choix de la source, par variable d'environnement (section 8.3).
 *
 * Le défaut est `fixture`, volontairement. Basculer sur l'API réelle est une
 * décision explicite : si `AD_SOURCE` est mal orthographié, on veut tomber sur
 * des données de démonstration clairement marquées, pas commencer à brûler le
 * quota Meta en silence.
 */
export function sourceAnnonces(): AdSource {
  const choix = (process.env.AD_SOURCE ?? 'fixture').trim().toLowerCase();
  if (choix === 'meta') return new MetaAdLibrarySource();
  if (choix !== 'fixture') {
    console.warn(`[source] AD_SOURCE="${choix}" inconnu, on reste sur les fixtures.`);
  }
  return new FixtureSource();
}
