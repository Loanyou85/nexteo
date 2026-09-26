import { PrismaClient } from '@prisma/client';

/**
 * Semis des référentiels : poids du signal et arbre des catégories.
 *
 * Il ne crée aucune annonce ni aucun annonceur. La donnée du produit vient
 * exclusivement du pipeline d'ingestion — inventer un annonceur ici
 * reviendrait à publier une donnée fausse, ce que le produit refuse.
 *
 * Idempotent, et protégé par un verrou consultatif : le script tourne pendant
 * le build, et deux déploiements simultanés se marcheraient dessus.
 */
const db = new PrismaClient();

/** Verrou arbitraire mais stable, propre à ce semis. */
const VERROU = 4_820_117;

/**
 * Poids du signal Nexteo (section 3). Ils vivent en base pour être réglables
 * sans déploiement ; la fonction de calcul reste pure et les reçoit en
 * argument. Le semis ne les écrase pas s'ils ont déjà été ajustés.
 */
const POIDS: { key: string; weight: number }[] = [
  { key: 'persistance', weight: 35 },
  { key: 'continuite', weight: 20 },
  { key: 'volumeActif', weight: 15 },
  { key: 'rythmeTest', weight: 15 },
  { key: 'etendue', weight: 10 },
  { key: 'fraicheur', weight: 5 },
];

/** Arbre des catégories. `null` en second membre = catégorie racine. */
const CATEGORIES: { slug: string; label: string; parent: string | null }[] = [
  { slug: 'productivite', label: 'Productivité', parent: null },
  { slug: 'gestion-de-taches', label: 'Gestion de tâches', parent: 'productivite' },
  { slug: 'notes-et-documents', label: 'Notes et documents', parent: 'productivite' },
  { slug: 'agenda-et-reunions', label: 'Agenda et réunions', parent: 'productivite' },

  { slug: 'marketing', label: 'Marketing', parent: null },
  { slug: 'emailing', label: 'E-mailing', parent: 'marketing' },
  { slug: 'reseaux-sociaux', label: 'Réseaux sociaux', parent: 'marketing' },
  { slug: 'referencement', label: 'Référencement', parent: 'marketing' },
  { slug: 'publicite', label: 'Publicité', parent: 'marketing' },

  { slug: 'vente', label: 'Vente', parent: null },
  { slug: 'crm', label: 'CRM', parent: 'vente' },
  { slug: 'prospection', label: 'Prospection', parent: 'vente' },
  { slug: 'devis-et-facturation', label: 'Devis et facturation', parent: 'vente' },

  { slug: 'finance', label: 'Finance', parent: null },
  { slug: 'comptabilite', label: 'Comptabilité', parent: 'finance' },
  { slug: 'paiement', label: 'Paiement', parent: 'finance' },
  { slug: 'gestion-des-depenses', label: 'Gestion des dépenses', parent: 'finance' },

  { slug: 'ressources-humaines', label: 'Ressources humaines', parent: null },
  { slug: 'recrutement', label: 'Recrutement', parent: 'ressources-humaines' },
  { slug: 'paie', label: 'Paie', parent: 'ressources-humaines' },
  { slug: 'planning-des-equipes', label: 'Planning des équipes', parent: 'ressources-humaines' },

  { slug: 'developpement', label: 'Développement', parent: null },
  { slug: 'hebergement', label: 'Hébergement', parent: 'developpement' },
  { slug: 'suivi-des-erreurs', label: 'Suivi des erreurs', parent: 'developpement' },
  { slug: 'automatisation', label: 'Automatisation', parent: 'developpement' },

  { slug: 'design', label: 'Design', parent: null },
  { slug: 'creation-graphique', label: 'Création graphique', parent: 'design' },
  { slug: 'prototypage', label: 'Prototypage', parent: 'design' },
  { slug: 'video', label: 'Vidéo', parent: 'design' },

  { slug: 'commerce', label: 'Commerce', parent: null },
  { slug: 'boutique-en-ligne', label: 'Boutique en ligne', parent: 'commerce' },
  { slug: 'logistique', label: 'Logistique', parent: 'commerce' },
  { slug: 'caisse', label: 'Caisse', parent: 'commerce' },

  { slug: 'support-client', label: 'Support client', parent: null },
  { slug: 'donnees-et-analyse', label: 'Données et analyse', parent: null },
  { slug: 'education', label: 'Éducation', parent: null },
  { slug: 'sante-et-bien-etre', label: 'Santé et bien-être', parent: null },
  { slug: 'immobilier', label: 'Immobilier', parent: null },
  { slug: 'restauration', label: 'Restauration', parent: null },
  { slug: 'juridique', label: 'Juridique', parent: null },

  // Refuge des pages qu'aucune règle ne sait classer. Elles ressortent dans
  // /admin avec `needsReview`, plutôt que d'être rangées au hasard.
  { slug: 'non-classe', label: 'Non classé', parent: null },
];

async function main(): Promise<void> {
  const lignes = await db.$queryRawUnsafe<{ pg_try_advisory_lock: boolean }[]>(
    `SELECT pg_try_advisory_lock(${VERROU})`,
  );

  if (!lignes[0]?.pg_try_advisory_lock) {
    console.log('Semis déjà en cours ailleurs, on laisse faire.');
    return;
  }

  try {
    for (const { key, weight } of POIDS) {
      // `create` seulement : un poids ajusté depuis /admin ne doit pas être
      // remis à sa valeur d'usine par le déploiement suivant.
      await db.signalWeight.upsert({
        where: { key },
        update: {},
        create: { key, weight },
      });
    }

    // Deux passes : les racines d'abord, sinon un enfant cherche un parent
    // qui n'existe pas encore.
    for (const c of CATEGORIES.filter((c) => c.parent === null)) {
      await db.category.upsert({
        where: { slug: c.slug },
        update: { label: c.label },
        create: { slug: c.slug, label: c.label },
      });
    }

    for (const c of CATEGORIES.filter((c) => c.parent !== null)) {
      const parent = await db.category.findUnique({ where: { slug: c.parent! } });
      if (!parent) throw new Error(`Catégorie parente absente : ${c.parent}`);
      await db.category.upsert({
        where: { slug: c.slug },
        update: { label: c.label, parentId: parent.id },
        create: { slug: c.slug, label: c.label, parentId: parent.id },
      });
    }

    console.log(`Semis : ${POIDS.length} poids, ${CATEGORIES.length} catégories.`);
  } finally {
    await db.$queryRawUnsafe(`SELECT pg_advisory_unlock(${VERROU})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
