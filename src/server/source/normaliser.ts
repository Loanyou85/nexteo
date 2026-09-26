import { AnnonceInvalide, type AnnonceBrute } from './types';

/**
 * Passage du brut de l'API à la forme stockée.
 *
 * Deux principes.
 *
 * On ne jette rien : la charge complète part dans `rawPayload` de
 * l'AdObservation. Les champs de l'API changent régulièrement, et le jour où
 * l'un d'eux nous intéressera, il faudra pouvoir le relire dans l'historique
 * sans avoir à réinterroger une archive qui l'aura effacé.
 *
 * On n'invente rien : un champ absent vaut `null`, pas une valeur devinée.
 */

export type AnnonceNormalisee = {
  metaAdId: string;
  metaPageId: string;
  pageName: string;
  bodyText: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  linkCaption: string | null;
  landingUrl: string | null;
  landingDomain: string | null;
  snapshotUrl: string;
  deliveryStartTime: Date;
  deliveryStopTime: Date | null;
  publisherPlatforms: string[];
  languages: string[];
  reachedCountries: string[];
  isActive: boolean;
  rawPayload: AnnonceBrute;
};

/**
 * Premier élément exploitable d'un tableau de créations.
 *
 * Une annonce peut porter plusieurs variantes de texte. Le modèle de données
 * en garde une seule ; les autres restent dans `rawPayload`, donc rien n'est
 * perdu, et l'affichage reste lisible.
 */
function premier(valeurs: string[] | undefined): string | null {
  if (!valeurs) return null;
  for (const v of valeurs) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

function date(valeur: string | null | undefined): Date | null {
  const t = valeur?.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function liste(valeurs: string[] | undefined, transformer: (v: string) => string): string[] {
  if (!valeurs) return [];
  const vus = new Set<string>();
  for (const v of valeurs) {
    const t = transformer(v?.trim() ?? '');
    if (t) vus.add(t);
  }
  // Trié pour que deux exécutions produisent la même ligne : sans cela, un
  // simple changement d'ordre ferait croire à une modification de l'annonce.
  return [...vus].sort();
}

/**
 * Domaine de destination.
 *
 * `ad_creative_link_captions` porte en général le domaine affiché sous
 * l'annonce, parfois une URL complète. On accepte les deux et on refuse le
 * reste : mieux vaut aucun domaine qu'un domaine faux.
 */
export function domaineDepuisCaption(caption: string | null): {
  landingUrl: string | null;
  landingDomain: string | null;
} {
  if (!caption) return { landingUrl: null, landingDomain: null };
  const brut = caption.trim();

  const nettoyer = (hote: string) => hote.toLowerCase().replace(/^www\./, '') || null;

  if (/^https?:\/\//i.test(brut)) {
    try {
      const u = new URL(brut);
      return { landingUrl: u.toString(), landingDomain: nettoyer(u.hostname) };
    } catch {
      return { landingUrl: null, landingDomain: null };
    }
  }

  // Domaine nu : « exemple.fr », « app.exemple.fr/tarifs ».
  const candidat = brut.split('/')[0];
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+$/i.test(candidat)) {
    return { landingUrl: null, landingDomain: nettoyer(candidat) };
  }
  return { landingUrl: null, landingDomain: null };
}

export function normaliser(brute: AnnonceBrute, maintenant: Date): AnnonceNormalisee {
  const id = brute.id?.trim();
  if (!id) throw new AnnonceInvalide('(sans identifiant)', 'identifiant absent');

  const pageId = brute.page_id?.trim();
  if (!pageId) throw new AnnonceInvalide(id, 'page_id absent');

  const snapshotUrl = brute.ad_snapshot_url?.trim();
  // Garde-fou n° 3 : toute annonce affichée renvoie vers son instantané
  // officiel. Sans ce lien on ne peut pas la publier, donc on ne la stocke pas.
  if (!snapshotUrl) throw new AnnonceInvalide(id, 'ad_snapshot_url absent');

  const debut = date(brute.ad_delivery_start_time);
  if (!debut) throw new AnnonceInvalide(id, 'date de début illisible');

  const fin = date(brute.ad_delivery_stop_time);
  if (fin && fin < debut) throw new AnnonceInvalide(id, 'date de fin antérieure au début');

  const caption = premier(brute.ad_creative_link_captions);
  const { landingUrl, landingDomain } = domaineDepuisCaption(caption);

  return {
    metaAdId: id,
    metaPageId: pageId,
    pageName: brute.page_name?.trim() || `Page ${pageId}`,
    bodyText: premier(brute.ad_creative_bodies),
    linkTitle: premier(brute.ad_creative_link_titles),
    linkDescription: premier(brute.ad_creative_link_descriptions),
    linkCaption: caption,
    landingUrl,
    landingDomain,
    snapshotUrl,
    deliveryStartTime: debut,
    deliveryStopTime: fin,
    publisherPlatforms: liste(brute.publisher_platforms, (v) => v.toLowerCase()),
    languages: liste(brute.languages, (v) => v.toLowerCase()),
    reachedCountries: liste(brute.ad_reached_countries, (v) => v.toUpperCase()),
    // Pas de date de fin, ou date de fin à venir : l'annonce tourne encore.
    isActive: !fin || fin > maintenant,
    rawPayload: brute,
  };
}
