/**
 * Contrat de source d'annonces (section 8.3).
 *
 * Deux implémentations derrière la même interface : l'API officielle Meta, et
 * un jeu de fixtures. Tout le produit se développe et se teste sur la seconde
 * pendant que la vérification d'identité et la revue d'application suivent
 * leur cours chez Meta — et la bascule ne coûte qu'une variable
 * d'environnement, pas une réécriture.
 */

/** Annonce telle que l'API la rend, avant toute interprétation. */
export type AnnonceBrute = {
  id: string;
  page_id: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_captions?: string[];
  ad_snapshot_url: string;
  ad_delivery_start_time: string;
  ad_delivery_stop_time?: string | null;
  publisher_platforms?: string[];
  languages?: string[];
  ad_reached_countries?: string[];
  /** Champs de portée, exposés par Meta pour les annonces diffusées dans l'UE. */
  eu_total_reach?: number;
  [autre: string]: unknown;
};

export type RequeteAnnonces = {
  /**
   * Obligatoire. Il n'existe aucune requête mondiale : hors politique, l'API
   * ne couvre que les annonces diffusées auprès d'utilisateurs de l'Union
   * européenne, et `ad_reached_countries` doit être fourni à chaque appel.
   */
  pays: string;
  /** Cent caractères maximum, sans traduction automatique. */
  terme: string;
  curseur?: string | null;
  taille?: number;
};

export type PageAnnonces = {
  annonces: AnnonceBrute[];
  /** `null` quand il n'y a plus rien à lire. */
  curseurSuivant: string | null;
};

export interface AdSource {
  readonly nom: string;
  /**
   * Vrai quand les données ne sont pas observées.
   *
   * Le pipeline s'en sert pour marquer `isDemo` sur tout ce qu'il écrit. C'est
   * la source qui déclare sa nature, plutôt qu'un appelant qui pense à le
   * faire : un oubli publierait de la donnée inventée comme si elle était
   * réelle, ce que le produit interdit.
   */
  readonly estDemo: boolean;
  recuperer(requete: RequeteAnnonces): Promise<PageAnnonces>;
}

/** L'API refuse la requête pour cause de débit. Le pipeline temporise. */
export class ErreurDebit extends Error {
  constructor(
    message: string,
    /** Délai suggéré par l'API, en millisecondes, quand elle en donne un. */
    readonly attendreMs?: number,
  ) {
    super(message);
    this.name = 'ErreurDebit';
  }
}

/** L'annonce reçue est inexploitable. On la saute, on ne casse pas l'exécution. */
export class AnnonceInvalide extends Error {
  constructor(
    readonly identifiant: string,
    readonly raison: string,
  ) {
    super(`Annonce ${identifiant} ignorée : ${raison}`);
    this.name = 'AnnonceInvalide';
  }
}
