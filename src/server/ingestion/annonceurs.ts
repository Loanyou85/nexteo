import type { Prisma, PrismaClient } from '@prisma/client';
import type { AnnonceNormalisee } from '@/server/source';

/**
 * Création et tenue des annonceurs.
 *
 * On traite des PAGES, pas des personnes (garde-fou n° 4) : rien de ce qui est
 * écrit ici n'identifie un individu.
 */

/**
 * Règles de rattachement à une catégorie.
 *
 * Volontairement grossières, et assumées comme telles : chaque annonceur créé
 * porte `needsReview` et ressort dans /admin. Une règle qui se trompe coûte un
 * clic ; une règle qui prétendrait être sûre d'elle produirait un classement
 * faux affiché comme un fait.
 *
 * Les mots sont cherchés dans le nom de la page, le domaine de destination et
 * les textes d'annonce. Premier groupe qui matche, dans l'ordre : les
 * catégories les plus spécifiques d'abord.
 */
const REGLES: { categorie: string; mots: string[] }[] = [
  { categorie: 'devis-et-facturation', mots: ['factur', 'devis', 'invoice', 'quote'] },
  { categorie: 'comptabilite', mots: ['comptab', 'accounting', 'bilan', 'expert-comptable'] },
  { categorie: 'caisse', mots: ['caisse', 'point de vente', 'pos ', 'tiroir-caisse'] },
  { categorie: 'paiement', mots: ['paiement', 'payment', 'encaiss', 'checkout', 'terminal de paiement'] },
  { categorie: 'gestion-des-depenses', mots: ['note de frais', 'dépense', 'expense', 'budget'] },
  { categorie: 'boutique-en-ligne', mots: ['boutique', 'e-commerce', 'ecommerce', 'vendre en ligne', 'shop'] },
  { categorie: 'logistique', mots: ['stock', 'inventaire', 'logistiq', 'expédition', 'livraison'] },
  { categorie: 'crm', mots: ['crm', 'relation client', 'pipeline commercial'] },
  { categorie: 'prospection', mots: ['prospect', 'lead', 'cold email', 'démarchage'] },
  { categorie: 'emailing', mots: ['emailing', 'e-mailing', 'newsletter', 'campagne e-mail'] },
  { categorie: 'reseaux-sociaux', mots: ['réseaux sociaux', 'social media', 'planifier vos posts'] },
  { categorie: 'referencement', mots: ['seo', 'référencement', 'google'] },
  { categorie: 'publicite', mots: ['publicité', 'ads', 'campagne pub'] },
  { categorie: 'recrutement', mots: ['recrut', 'candidat', 'offre d’emploi', 'offre d\'emploi', 'hiring'] },
  { categorie: 'paie', mots: ['paie', 'bulletin de salaire', 'payroll'] },
  { categorie: 'planning-des-equipes', mots: ['planning', 'horaire', 'roulement', 'shift'] },
  { categorie: 'agenda-et-reunions', mots: ['agenda', 'rendez-vous', 'réunion', 'booking', 'calendrier'] },
  { categorie: 'gestion-de-taches', mots: ['tâche', 'projet', 'to-do', 'kanban'] },
  { categorie: 'notes-et-documents', mots: ['note', 'document', 'signature électronique', 'pdf'] },
  { categorie: 'support-client', mots: ['support', 'service client', 'ticket', 'chat client', 'helpdesk'] },
  { categorie: 'donnees-et-analyse', mots: ['tableau de bord', 'analytics', 'donnée', 'reporting', 'kpi'] },
  { categorie: 'suivi-des-erreurs', mots: ['erreur', 'monitoring', 'supervision', 'log'] },
  { categorie: 'hebergement', mots: ['hébergement', 'serveur', 'hosting', 'nom de domaine'] },
  { categorie: 'automatisation', mots: ['automatis', 'workflow', 'no-code', 'nocode'] },
  { categorie: 'creation-graphique', mots: ['design', 'graphis', 'logo', 'visuel'] },
  { categorie: 'prototypage', mots: ['maquette', 'prototype', 'wireframe'] },
  { categorie: 'video', mots: ['vidéo', 'montage', 'sous-titre'] },
  { categorie: 'education', mots: ['formation', 'cours en ligne', 'apprendre', 'e-learning'] },
  { categorie: 'sante-et-bien-etre', mots: ['patient', 'santé', 'praticien', 'cabinet', 'kiné', 'thérapeute'] },
  { categorie: 'immobilier', mots: ['immobilier', 'location', 'bien immobilier', 'agence immo'] },
  { categorie: 'restauration', mots: ['restaurant', 'menu', 'réservation de table', 'brasserie'] },
  { categorie: 'juridique', mots: ['juridique', 'contrat', 'avocat', 'conformité', 'rgpd'] },
];

function aplatir(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Catégorie déduite par règles. `non-classe` quand rien ne matche. */
export function categoriserParRegles(elements: {
  nom: string;
  domaine?: string | null;
  textes?: (string | null)[];
}): string {
  const corpus = aplatir(
    [elements.nom, elements.domaine ?? '', ...(elements.textes ?? []).map((t) => t ?? '')].join(' '),
  );
  for (const regle of REGLES) {
    if (regle.mots.some((m) => corpus.includes(aplatir(m)))) return regle.categorie;
  }
  return 'non-classe';
}

export function slugifier(nom: string): string {
  return (
    nom
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'annonceur'
  );
}

/**
 * Crée l'annonceur s'il est inconnu, met à jour ses bornes d'observation sinon.
 *
 * `firstSeenAt` ne recule jamais et `lastSeenAt` n'avance que : ce sont les
 * bornes de ce que Nexteo a vu, pas des dates déclarées par Meta.
 */
export async function assurerAnnonceur(
  db: PrismaClient | Prisma.TransactionClient,
  annonce: AnnonceNormalisee,
  options: { estDemo: boolean; maintenant: Date; categories: Map<string, string> },
): Promise<{ id: string; cree: boolean }> {
  const existant = await db.advertiser.findUnique({
    where: { metaPageId: annonce.metaPageId },
    select: { id: true, firstSeenAt: true, websiteUrl: true },
  });

  if (existant) {
    await db.advertiser.update({
      where: { id: existant.id },
      data: {
        lastSeenAt: options.maintenant,
        // Une annonce plus ancienne peut arriver après coup : la première
        // observation recule alors, et c'est légitime.
        ...(annonce.deliveryStartTime < existant.firstSeenAt
          ? { firstSeenAt: annonce.deliveryStartTime }
          : {}),
        ...(!existant.websiteUrl && annonce.landingDomain
          ? { websiteUrl: `https://${annonce.landingDomain}` }
          : {}),
      },
    });
    return { id: existant.id, cree: false };
  }

  const categorie = categoriserParRegles({
    nom: annonce.pageName,
    domaine: annonce.landingDomain,
    textes: [annonce.bodyText, annonce.linkTitle, annonce.linkDescription],
  });

  // Le slug doit rester unique sans jamais faire échouer une ingestion : on
  // suffixe avec l'identifiant de page, qui l'est par construction.
  const base = slugifier(annonce.pageName);
  const pris = await db.advertiser.findUnique({ where: { slug: base }, select: { id: true } });
  const slug = pris ? `${base}-${annonce.metaPageId.slice(-6)}` : base;

  const cree = await db.advertiser.create({
    data: {
      metaPageId: annonce.metaPageId,
      slug,
      name: annonce.pageName,
      websiteUrl: annonce.landingDomain ? `https://${annonce.landingDomain}` : null,
      categoryId: options.categories.get(categorie) ?? options.categories.get('non-classe') ?? null,
      countryCode: annonce.reachedCountries[0] ?? null,
      firstSeenAt: annonce.deliveryStartTime,
      lastSeenAt: options.maintenant,
      isDemo: options.estDemo,
      // Le rattachement vient d'une règle, pas d'un humain : il attend d'être
      // confirmé dans /admin.
      needsReview: true,
    },
    select: { id: true },
  });

  return { id: cree.id, cree: true };
}
