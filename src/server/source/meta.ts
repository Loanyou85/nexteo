import { ErreurDebit, type AdSource, type AnnonceBrute, type PageAnnonces, type RequeteAnnonces } from './types';

/**
 * API officielle Meta Ad Library, endpoint Graph `ads_archive` (section 2.1).
 *
 * Aucun scraping : ni de l'interface web de la bibliothèque, ni des stores.
 * Le produit vend de la donnée sourcée et légale, c'est son argument.
 *
 * Deux avertissements honnêtes.
 *
 * Ce client n'a pas pu être exercé : `graph.facebook.com` est refusé par la
 * politique réseau de l'environnement de développement, et l'accès à l'API
 * demande de toute façon une vérification d'identité et une revue
 * d'application côté Meta. Il est donc écrit défensivement — un champ manquant
 * ou renommé est ignoré plutôt que de faire tomber l'exécution, conformément à
 * la consigne « adapte-toi plutôt que d'échouer silencieusement ». Le premier
 * appel réel doit être surveillé.
 *
 * La version de l'API est une constante, pas une valeur codée en dur au
 * milieu d'une URL : Meta en retire régulièrement, et il faut pouvoir la
 * bouger en un endroit.
 */

const VERSION_API = process.env.META_API_VERSION?.trim() || 'v21.0';
const BASE = `https://graph.facebook.com/${VERSION_API}/ads_archive`;

/** Champs demandés (section 2.2). */
const CHAMPS = [
  'id',
  'page_id',
  'page_name',
  'ad_creative_bodies',
  'ad_creative_link_titles',
  'ad_creative_link_descriptions',
  'ad_creative_link_captions',
  'ad_snapshot_url',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'publisher_platforms',
  'languages',
  'ad_reached_countries',
] as const;

/** Champs de portée, exposés seulement pour les annonces diffusées dans l'UE. */
const CHAMPS_UE = ['eu_total_reach'] as const;

type ReponseGraph = {
  data?: unknown;
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message?: string; code?: number; error_subcode?: number };
};

export class MetaAdLibrarySource implements AdSource {
  readonly nom = 'meta';
  readonly estDemo = false;

  constructor(
    private readonly jeton = process.env.META_ACCESS_TOKEN ?? '',
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async recuperer(requete: RequeteAnnonces): Promise<PageAnnonces> {
    if (!this.jeton) {
      throw new Error(
        'META_ACCESS_TOKEN absent. La source `meta` exige un jeton obtenu après ' +
          'vérification d’identité et revue d’application chez Meta.',
      );
    }

    const pays = requete.pays.trim().toUpperCase();
    if (!pays) {
      // Ce n'est pas une précaution de style : l'API rejette la requête, et
      // surtout il n'existe aucune notion de requête mondiale.
      throw new Error('`ad_reached_countries` est obligatoire : aucun appel sans pays.');
    }

    // Cent caractères maximum, sans traduction automatique.
    const terme = requete.terme.trim().slice(0, 100);

    const params = new URLSearchParams({
      access_token: this.jeton,
      ad_reached_countries: JSON.stringify([pays]),
      search_terms: terme,
      ad_type: 'ALL',
      ad_active_status: 'ALL',
      fields: [...CHAMPS, ...CHAMPS_UE].join(','),
      limit: String(Math.min(Math.max(requete.taille ?? 50, 1), 500)),
    });
    if (requete.curseur) params.set('after', requete.curseur);

    const reponse = await this.fetcher(`${BASE}?${params.toString()}`, {
      headers: { accept: 'application/json' },
    });

    const corps = (await reponse.json().catch(() => ({}))) as ReponseGraph;

    if (!reponse.ok || corps.error) {
      const code = corps.error?.code;
      const message = corps.error?.message ?? `HTTP ${reponse.status}`;

      // 613 : quota de débit atteint. Le pipeline temporise et reprend au
      // curseur, il ne perd pas l'exécution en cours.
      if (code === 613 || reponse.status === 429) {
        throw new ErreurDebit(message);
      }
      // 190 : jeton invalide ou expiré. Inutile de réessayer.
      throw new Error(`Meta Ad Library a refusé la requête (${code ?? reponse.status}) : ${message}`);
    }

    const brut = Array.isArray(corps.data) ? corps.data : [];
    const annonces = brut.filter(
      (a): a is AnnonceBrute =>
        typeof a === 'object' && a !== null && typeof (a as { id?: unknown }).id === 'string',
    );

    // Meta signale la fin en omettant `paging.next`, pas en renvoyant une
    // page vide : se fier au seul curseur ferait boucler indéfiniment.
    const curseurSuivant = corps.paging?.next ? (corps.paging.cursors?.after ?? null) : null;

    return { annonces, curseurSuivant };
  }
}
