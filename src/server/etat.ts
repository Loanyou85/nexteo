import 'server-only';
import { db } from '@/server/db';

/**
 * Diagnostic de la base, lisible par quelqu'un qui n'ouvrira jamais les
 * journaux de l'hébergeur.
 *
 * Le build ne s'arrête plus quand la base n'est pas prête — il n'en a pas
 * besoin, et un déploiement rouge ne dit rien à qui doit agir. C'est donc au
 * site de le dire, sur la page, en français, avec la manœuvre.
 */

export type EtatBase =
  | { pret: true }
  | { pret: false; titre: string; explication: string; aFaire: string[] };

const MARQUEURS_V1 = ['Idea', 'IdeaBlueprint', 'Journey', 'Profile', 'VideoScript'];

export async function etatBase(): Promise<EtatBase> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      pret: false,
      titre: 'Aucune base de données configurée',
      explication:
        'Le site est en ligne mais n’est relié à aucune base. Il ne peut donc afficher aucun annonceur.',
      aFaire: [
        'Créer une base PostgreSQL vierge, dédiée à cette version.',
        'Renseigner DATABASE_URL (la chaîne avec « pooler ») et DIRECT_URL (celle sans).',
        'Redéployer.',
      ],
    };
  }

  try {
    const tables = (
      await db.$queryRawUnsafe<{ tablename: string }[]>(
        `SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`,
      )
    ).map((t) => t.tablename);

    const v1 = MARQUEURS_V1.filter((t) => tables.includes(t));
    if (v1.length > 0) {
      return {
        pret: false,
        titre: 'Le site pointe sur l’ancienne base',
        explication:
          `Cette base contient les tables de l’ancien produit (${v1.join(', ')}). ` +
          'Le schéma de cette version est incompatible, et rien n’y a été écrit : ' +
          'les données de l’ancien site sont intactes.',
        aFaire: [
          'Créer une base PostgreSQL vierge, dédiée à cette version.',
          'Y pointer DATABASE_URL et DIRECT_URL.',
          'Redéployer.',
        ],
      };
    }

    if (!tables.includes('Advertiser')) {
      return {
        pret: false,
        titre: 'La base est vide',
        explication:
          'La base est joignable mais le schéma n’y a pas été posé : la migration n’a pas pu s’exécuter au dernier déploiement.',
        aFaire: [
          'Vérifier que DIRECT_URL est bien la chaîne SANS « pooler » : un répartiteur de connexions ne sait pas exécuter une migration.',
          'Redéployer, puis relire le journal de build — la raison exacte y est écrite en clair.',
        ],
      };
    }

    return { pret: true };
  } catch (e) {
    const brut = String((e as Error).message)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !/^Invalid `.*` invocation/.test(l));

    return {
      pret: false,
      titre: 'La base ne répond pas',
      explication: brut[0] ?? 'Connexion impossible.',
      aFaire: [
        'Vérifier que DATABASE_URL et DIRECT_URL pointent sur une base en service.',
        'Vérifier que l’hébergeur de la base n’a pas mis l’instance en veille.',
      ],
    };
  }
}
