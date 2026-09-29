import { PrismaClient } from '@prisma/client';

/**
 * Client de base.
 *
 * L'URL est normalisée avant usage. Les hébergeurs sans serveur donnent en
 * général deux adresses : une directe, et une « poolée » qui passe par un
 * répartiteur de connexions. Sur la seconde, Prisma doit renoncer aux requêtes
 * préparées — sinon deux requêtes envoyées sur des connexions différentes se
 * marchent dessus et la base répond « prepared statement already exists ».
 *
 * Le symptôme est déroutant : les lectures simples passent, et une écriture
 * échoue. On ne peut pas demander à quelqu'un de deviner ça depuis son tableau
 * de bord, donc on le corrige ici.
 */
function normaliserUrl(brut: string | undefined): string | undefined {
  const url = brut?.trim();
  if (!url) return undefined;

  try {
    const analysee = new URL(url);
    const poolee = /(^|[.-])pooler\./.test(analysee.hostname);
    if (!poolee) return url;

    if (!analysee.searchParams.has('pgbouncer')) analysee.searchParams.set('pgbouncer', 'true');
    // Une instance sans serveur ne garde pas ses connexions : en ouvrir
    // plusieurs par requête épuise le quota de l'hébergeur pour rien.
    if (!analysee.searchParams.has('connection_limit')) {
      analysee.searchParams.set('connection_limit', '1');
    }
    return analysee.toString();
  } catch {
    // Une URL que l'on ne sait pas lire est laissée telle quelle : Prisma
    // dira mieux que nous ce qui ne va pas.
    return url;
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const url = normaliserUrl(process.env.DATABASE_URL);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    ...(url ? { datasources: { db: { url } } } : {}),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
