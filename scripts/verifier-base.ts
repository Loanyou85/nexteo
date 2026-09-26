import { PrismaClient } from '@prisma/client';

/**
 * Contrôle avant migration.
 *
 * La V2 vise une base DÉDIÉE et vierge : son schéma n'a rien à voir avec celui
 * de la V1 et la migration initiale ne supprime rien. Jouée par erreur sur la
 * base de la V1, elle s'arrête sur sa toute première instruction avec
 * « type "Role" already exists » — une transaction annulée, donc aucune donnée
 * touchée, mais un message que personne ne relie à sa cause réelle.
 *
 * Ce script dit la cause à la place de Postgres, et donne la manœuvre. Il ne
 * répare rien tout seul : basculer une base de production est une décision,
 * pas un effet de bord d'un déploiement.
 */

/** Tables qui n'existent que dans l'ancien produit. */
const MARQUEURS_V1 = ['Idea', 'IdeaBlueprint', 'Journey', 'Profile', 'VideoScript'];
/** Tables qui n'existent que dans le nouveau. */
const MARQUEURS_V2 = ['Advertiser', 'Ad', 'AdObservation'];

const MIGRATION_V2 = '20260926120000_nexteo_ad_library';

function echouer(lignes: string[]): never {
  console.error('\n' + '─'.repeat(72));
  for (const l of lignes) console.error(l);
  console.error('─'.repeat(72) + '\n');
  process.exit(1);
}

async function main(): Promise<void> {
  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log('[base] Aucune URL configurée : Prisma dira mieux que nous ce qui manque.');
    return;
  }

  const db = new PrismaClient({ datasources: { db: { url } } });

  let tables: string[];
  try {
    const lignes = await db.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`,
    );
    tables = lignes.map((l) => l.tablename);
  } catch (e) {
    // Base injoignable au moment du build : ce n'est pas à ce script de
    // trancher. `migrate deploy` produira l'erreur de connexion, qui est
    // déjà explicite.
    console.log(`[base] Vérification impossible (${(e as Error).message.split('\n')[0]}).`);
    await db.$disconnect();
    return;
  }

  const aV1 = MARQUEURS_V1.filter((t) => tables.includes(t));
  const aV2 = MARQUEURS_V2.every((t) => tables.includes(t));

  // Migration restée en échec : Prisma refusera tout tant qu'elle n'est pas
  // déclarée annulée à la main.
  let bloquee = false;
  if (tables.includes('_prisma_migrations')) {
    try {
      const [{ n }] = await db.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM "_prisma_migrations"
          WHERE "migration_name" = $1 AND "finished_at" IS NULL AND "rolled_back_at" IS NULL`,
        MIGRATION_V2,
      );
      bloquee = n > 0;
    } catch {
      // Journal illisible : on n'en tire aucune conclusion.
    }
  }

  await db.$disconnect();

  if (aV1.length > 0) {
    echouer([
      'La base visée est celle de la V1, pas celle de la V2.',
      '',
      `Tables de l'ancien produit trouvées : ${aV1.join(', ')}.`,
      '',
      "La V2 est un autre produit : une base de publicités construite sur la Meta",
      "Ad Library. Son schéma est incompatible, et sa migration initiale ne",
      "supprime rien — elle s'arrête plutôt que d'écraser tes données. Elles sont",
      'donc intactes.',
      '',
      'À faire :',
      '  1. Créer une base PostgreSQL vierge (branche Neon ou Supabase).',
      '  2. Y pointer DATABASE_URL et DIRECT_URL dans les variables du projet.',
      '  3. Relancer le déploiement.',
      ...(bloquee
        ? [
            '',
            "Cette tentative a laissé une ligne d'échec dans le journal de l'ANCIENNE",
            'base. Elle ne gêne que si tu redéploies la V1 dessus. Pour la nettoyer :',
            `  npx prisma migrate resolve --rolled-back ${MIGRATION_V2}`,
          ]
        : []),
    ]);
  }

  const vierge = tables.length === 0 || tables.every((t) => t === '_prisma_migrations');

  if (!vierge && !aV2) {
    echouer([
      "La base visée n'est ni vierge ni une base V2 reconnaissable.",
      '',
      `Tables présentes : ${tables.slice(0, 12).join(', ')}${tables.length > 12 ? '…' : ''}`,
      '',
      'Par prudence on ne migre pas : si cette base contient autre chose, une',
      'migration initiale la laisserait dans un état bâtard. Vérifie DATABASE_URL.',
    ]);
  }

  if (bloquee) {
    echouer([
      "La migration V2 est restée en échec sur cette base.",
      '',
      'Prisma refuse toute migration tant que celle-ci est en suspens. Comme la',
      "migration initiale s'exécute en transaction, rien n'a été appliqué : il",
      'suffit de déclarer la tentative annulée pour pouvoir la rejouer.',
      '',
      `  npx prisma migrate resolve --rolled-back ${MIGRATION_V2}`,
    ]);
  }

  console.log(
    vierge
      ? '[base] Base vierge : la migration initiale V2 peut être appliquée.'
      : '[base] Base V2 reconnue.',
  );
}

main().catch((e) => {
  console.error('[base] Contrôle interrompu :', (e as Error).message);
  process.exit(1);
});
