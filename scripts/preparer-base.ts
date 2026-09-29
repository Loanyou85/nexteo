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

const MIGRATION = '20260929015855_nexteo_uefn';

/**
 * Tables qui signent un ancien produit Nexteo. Leur présence veut dire que
 * DATABASE_URL pointe encore sur l'ancienne base : on n'y touche pas.
 */
const ANCIENS_PRODUITS: { nom: string; marqueurs: string[] }[] = [
  { nom: 'la toute première version (accompagnement SaaS)', marqueurs: ['Idea', 'IdeaBlueprint', 'Journey', 'VideoScript'] },
  { nom: 'la base de publicités (Meta Ad Library)', marqueurs: ['Advertiser', 'Ad', 'AdObservation'] },
];

/** Tables qui signent CE produit : la base est déjà la bonne. */
const MARQUEURS_ACTUELS = ['Project', 'BuildTask', 'AgentEvent'];

function bandeau(lignes: string[]): void {
  console.log('\n' + '─'.repeat(72));
  for (const l of lignes) console.log(l);
  console.log('─'.repeat(72) + '\n');
}

function lancer(
  commande: string,
  args: string[],
  env?: Record<string, string>,
): { ok: boolean; sortie: string } {
  try {
    const sortie = execFileSync(commande, args, {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, ...env },
    });
    return { ok: true, sortie };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, sortie: `${err.stdout ?? ''}${err.stderr ?? ''}` || (err.message ?? '') };
  }
}

/**
 * Applique les migrations, en rattrapant l'erreur de configuration la plus
 * fréquente.
 *
 * `DIRECT_URL` doit être la chaîne SANS « pooler » : Prisma pose un verrou
 * consultatif que le répartiteur de connexions ne tient pas, et la migration
 * échoue sur un message qui ne parle ni de pooler ni d'URL. Les deux chaînes
 * se ressemblant à un mot près, l'inversion est très facile à faire.
 *
 * Plutôt que de renvoyer quelqu'un vérifier deux chaînes quasi identiques, on
 * réessaie avec l'autre. C'est sans risque : le pire cas est un second échec,
 * et on le dit.
 */
function migrer(): { ok: boolean; sortie: string; via: string } {
  const directe = process.env.DIRECT_URL?.trim();
  const poolee = process.env.DATABASE_URL?.trim();

  const premier = lancer('npx', ['prisma', 'migrate', 'deploy']);
  if (premier.ok) return { ...premier, via: 'DIRECT_URL' };

  // Une seconde chance uniquement si les deux chaînes diffèrent réellement.
  if (poolee && directe && poolee !== directe) {
    console.log(
      '[base] La migration a échoué avec DIRECT_URL. Nouvelle tentative avec ' +
        'DATABASE_URL — les deux chaînes sont souvent inversées.',
    );
    const second = lancer('npx', ['prisma', 'migrate', 'deploy'], { DIRECT_URL: poolee });
    if (second.ok) {
      console.log(
        '[base] Passée avec DATABASE_URL. Vérifie tout de même DIRECT_URL : ' +
          'ce doit être la chaîne SANS « pooler ».',
      );
      return { ...second, via: 'DATABASE_URL' };
    }
    return { ...second, via: 'les deux' };
  }

  return { ...premier, via: 'DIRECT_URL' };
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

  // L'inspection tente les deux chaînes. DIRECT_URL est la bonne en principe,
  // mais si elle est fausse — inversée avec la poolée, ou mal recopiée — on ne
  // veut pas conclure « base injoignable » alors que l'autre répond très bien.
  async function inspecter(cible: string): Promise<{ tables: string[] } | { erreur: string }> {
    const client = new PrismaClient({ datasources: { db: { url: cible } } });
    try {
      const lignes = await client.$queryRawUnsafe<{ tablename: string }[]>(
        `SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`,
      );
      return { tables: lignes.map((l) => l.tablename) };
    } catch (e) {
      return { erreur: cause(String((e as Error).message)) };
    } finally {
      await client.$disconnect();
    }
  }

  const autre = process.env.DATABASE_URL?.trim();
  let vue = await inspecter(url);

  if ('erreur' in vue && autre && autre !== url) {
    console.log('[base] Première chaîne injoignable, essai avec l’autre.');
    vue = await inspecter(autre);
  }

  if ('erreur' in vue) {
    bandeau([
      'Base injoignable : ' + vue.erreur,
      '',
      'Le build continue. Vérifie DATABASE_URL et DIRECT_URL, puis redéploie.',
    ]);
    return;
  }

  const tables = vue.tables;

  const ancien = ANCIENS_PRODUITS.map((p) => ({
    ...p,
    trouvees: p.marqueurs.filter((t) => tables.includes(t)),
  })).find((p) => p.trouvees.length > 0);
  const actuelle = MARQUEURS_ACTUELS.every((t) => tables.includes(t));
  const vierge = tables.length === 0 || tables.every((t) => t === '_prisma_migrations');

  // Le seul refus qu'on garde, et il compte : ne jamais poser ce schéma
  // par-dessus la base d'un ancien produit. Ses données restent intactes.
  if (ancien && !actuelle) {
    bandeau([
      `MIGRATION IGNORÉE — la base visée est celle de ${ancien.nom}.`,
      '',
      `Tables de l'ancien produit trouvées : ${ancien.trouvees.join(', ')}.`,
      '',
      "Rien n'a été touché : ces données sont intactes. Le build continue,",
      'et le site affichera ce message sur chaque page.',
      '',
      'À faire : pointer DATABASE_URL et DIRECT_URL sur une base VIERGE,',
      'puis redéployer.',
    ]);
    return;
  }

  if (!vierge && !actuelle) {
    bandeau([
      "MIGRATION IGNORÉE — cette base n'est ni vierge ni une base Nexteo.",
      '',
      `Tables présentes : ${tables.slice(0, 10).join(', ')}${tables.length > 10 ? '…' : ''}`,
      '',
      "Par prudence on n'y pose rien. Vérifie DATABASE_URL.",
    ]);
    return;
  }

  const migration = migrer();
  if (!migration.ok) {
    const bloquee = /P3009|failed migrations/i.test(migration.sortie);
    bandeau([
      `MIGRATION EN ÉCHEC (essayée via ${migration.via}) : ` + cause(migration.sortie),
      '',
      ...(bloquee
        ? [
            'Une tentative précédente est restée en suspens dans le journal.',
            'Pour la déclarer annulée et pouvoir rejouer :',
            `  npx prisma migrate resolve --rolled-back ${MIGRATION}`,
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
      'fonctionnera, mais les offres, les templates et le catalogue de',
      'devices seront absents.',
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
