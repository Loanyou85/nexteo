import 'server-only';
import { db } from '@/server/db';

/**
 * Diagnostic de la base, lisible par quelqu'un qui n'ouvrira jamais les
 * journaux de l'hébergeur.
 *
 * Le build ne s'arrête pas quand la base n'est pas prête — il n'en a pas
 * besoin, et un déploiement rouge ne dit rien à qui doit agir. C'est donc au
 * site de le dire, sur la page, en français, avec la manœuvre.
 */

export type EtatBase =
  | { pret: true }
  | { pret: false; titre: string; explication: string; aFaire: string[] };

const ANCIENS_PRODUITS: { nom: string; marqueurs: string[] }[] = [
  { nom: 'la toute première version de Nexteo', marqueurs: ['Idea', 'IdeaBlueprint', 'Journey', 'VideoScript'] },
  { nom: 'l’ancienne base de publicités', marqueurs: ['Advertiser', 'Ad', 'AdObservation'] },
];

export async function etatBase(): Promise<EtatBase> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      pret: false,
      titre: 'Aucune base de données configurée',
      explication: 'Le site est en ligne mais n’est relié à aucune base : impossible de créer un compte ou un projet.',
      aFaire: [
        'Créer une base PostgreSQL vierge, hébergée en Europe.',
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

    if (!tables.includes('Project')) {
      const ancien = ANCIENS_PRODUITS.map((p) => ({
        ...p,
        trouvees: p.marqueurs.filter((t) => tables.includes(t)),
      })).find((p) => p.trouvees.length > 0);

      if (ancien) {
        return {
          pret: false,
          titre: 'Le site pointe sur l’ancienne base',
          explication:
            `Cette base contient les tables de ${ancien.nom} (${ancien.trouvees.join(', ')}). ` +
            'Le nouveau schéma n’y a pas été posé, et rien n’y a été écrit : les anciennes données sont intactes.',
          aFaire: [
            'Créer une base PostgreSQL vierge, dédiée au nouveau produit.',
            'Y pointer DATABASE_URL et DIRECT_URL.',
            'Redéployer.',
          ],
        };
      }

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

    // Le schéma existe ; encore faut-il que les offres et les réglages chiffrés
    // y soient. Un semis manqué laissait les pages qui les lisent lever une
    // exception (« Réglage BAREME absent ») : tout plantait sauf l'accueil.
    const [ref] = await db.$queryRaw<{ plans: bigint; bareme: bigint }[]>`
      SELECT (SELECT count(*) FROM "Plan") AS plans,
             (SELECT count(*) FROM "PricingConfig" WHERE "key" = 'BAREME') AS bareme`;
    if (!ref || Number(ref.plans) === 0 || Number(ref.bareme) === 0) {
      return {
        pret: false,
        titre: 'La base est créée, mais elle est vide',
        explication:
          'Les offres et les réglages chiffrés n’y ont pas été créés au dernier déploiement : le remplissage a échoué. ' +
          'Sans eux, seules l’accueil, l’inscription et la connexion peuvent s’afficher.',
        aFaire: [
          'Connecte-toi avec l’adresse de ADMIN_EMAILS, puis ouvre /reparation et clique sur « Créer les offres et réglages manquants ». Rien n’est effacé.',
          'Ou redéploie après avoir vérifié que DIRECT_URL est bien la chaîne SANS « pooler ».',
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
