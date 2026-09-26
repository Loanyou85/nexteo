import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Prépare la base avant le build — sans jamais faire échouer le build.
 *
 * Pourquoi ce renversement. `next build` n'a besoin d'aucune base : toutes les
 * pages sont dynamiques, rien n'est pré-rendu, seul le client Prisma doit être
 * généré et il l'est hors ligne. Lier les deux ne protégeait rien et rendait
 * le déploiement rouge pour une raison de configuration, sur une plateforme
 * dont les journaux ne sont pas toujours accessibles à celui qui doit agir.
 *
 * Ce script garde donc la partie utile — refuser de migrer une base qui n'est
 * pas la bonne — et abandonne la partie nuisible : il sort toujours en succès.
 * Quand quelque chose cloche, il l'écrit ici ET l'application le dira sur
 * chaque page, en français, à quelqu'un qui peut le lire sans ouvrir un
 * tableau de bord.
 */

const MIGRATION_V2 = '20260926120000_nexteo_ad_library';
const MARQUEURS_V1 = ['Idea', 'IdeaBlueprint', 'Journey', 'Profile', 'VideoScript'];
const MARQUEURS_V2 = ['Advertiser', 'Ad', 'AdObservation'];

function bandeau(lignes: string[]): void {
  console.log('\n' + '─'.repeat(72));
  for (const l of lignes) console.log(l);
  console.log('─'.repeat(72) + '\n');
}

function lancer(commande: string, args: string[]): { ok: boolean; sortie: string } {
  try {
    const sortie = execFileSync(commande, args, { encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, sortie };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, sortie: `${err.stdout ?? ''}${err.stderr ?? ''}` || (err.message ?? '') };
  }
}

/** Remonte la cause réelle d'une erreur Prisma, qui l'enveloppe. */
function cause(brut: string): string {
  const lignes = brut
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^Invalid `.*` invocation/.test(l));
  return lignes.find((l) => /Error|error:|P\d{4}|Can't reach|Authentication/.test(l)) ?? lignes[0] ?? brut.slice(0, 200);
}

async function main(): Promise<void> {
  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    bandeau([
      'Aucune base configurée.',
      '',
      'Le build continue : le site se construira, et chaque page dira que la',
      'base manque. Renseigne DATABASE_URL et DIRECT_URL puis redéploie.',
    ]);
    return;
  }

  const db = new PrismaClient({ datasources: { db: { url } } });
  let tables: string[] = [];

  try {
    const lignes = await db.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`,
    );
    tables = lignes.map((l) => l.tablename);
  } catch (e) {
    await db.$disconnect();
    bandeau([
      'Base injoignable : ' + cause(String((e as Error).message)),
      '',
      'Le build continue. Vérifie DATABASE_URL et DIRECT_URL, puis redéploie.',
    ]);
    return;
  }

  const v1 = MARQUEURS_V1.filter((t) => tables.includes(t));
  const v2 = MARQUEURS_V2.every((t) => tables.includes(t));
  const vierge = tables.length === 0 || tables.every((t) => t === '_prisma_migrations');

  await db.$disconnect();

  // Le seul refus qu'on garde, et il compte : ne jamais poser le schéma V2
  // par-dessus la base de la V1. Ses données sont intactes, elles le restent.
  if (v1.length > 0) {
    bandeau([
      'MIGRATION IGNORÉE — la base visée est celle de la V1.',
      '',
      `Tables de l'ancien produit trouvées : ${v1.join(', ')}.`,
      '',
      'Rien n\'a été touché : les données de la V1 sont intactes. Le build',
      'continue, et le site affichera ce message sur chaque page.',
      '',
      'À faire : pointer DATABASE_URL et DIRECT_URL sur une base VIERGE dédiée',
      'à la V2, puis redéployer.',
    ]);
    return;
  }

  if (!vierge && !v2) {
    bandeau([
      "MIGRATION IGNORÉE — cette base n'est ni vierge ni une base V2.",
      '',
      `Tables présentes : ${tables.slice(0, 10).join(', ')}${tables.length > 10 ? '…' : ''}`,
      '',
      "Par prudence on n'y pose rien. Vérifie DATABASE_URL.",
    ]);
    return;
  }

  const migration = lancer('npx', ['prisma', 'migrate', 'deploy']);
  if (!migration.ok) {
    const bloquee = /P3009|failed migrations/i.test(migration.sortie);
    bandeau([
      'MIGRATION EN ÉCHEC : ' + cause(migration.sortie),
      '',
      ...(bloquee
        ? [
            'Une tentative précédente est restée en suspens dans le journal.',
            'Pour la déclarer annulée et pouvoir rejouer :',
            `  npx prisma migrate resolve --rolled-back ${MIGRATION_V2}`,
            '',
          ]
        : []),
      'Le build continue, et le site dira que la base n\'est pas prête.',
    ]);
    return;
  }

  console.log('[base] Schéma à jour.');

  const semis = lancer('npx', ['tsx', 'prisma/seed.ts']);
  if (!semis.ok) {
    bandeau([
      'SEMIS EN ÉCHEC : ' + cause(semis.sortie),
      '',
      'Le schéma est en place, seuls les référentiels manquent. Le site',
      'fonctionnera, mais les catégories et les poids du signal seront absents.',
    ]);
    return;
  }

  console.log('[base] Référentiels semés. Tout est prêt.');
}

// Aucun chemin ne doit faire échouer le build : c'est tout l'objet du script.
main()
  .catch((e) => {
    bandeau([
      'Préparation interrompue : ' + cause(String((e as Error).message)),
      '',
      'Le build continue quand même.',
    ]);
  })
  .finally(() => process.exit(0));
