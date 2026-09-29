import { execSync } from 'node:child_process';

/**
 * Base de test d'intégration. Les tests qui l'utilisent sont ignorés quand
 * TEST_DATABASE_URL n'est pas définie : ils ne doivent jamais tourner contre
 * la base de développement, et encore moins contre la production.
 */
export const URL_TEST = process.env.TEST_DATABASE_URL?.trim() || null;

let prete = false;

export function preparerBaseTest() {
  if (!URL_TEST || prete) return;
  if (URL_TEST === process.env.DATABASE_URL_ORIGINE) throw new Error('TEST_DATABASE_URL ne doit pas être la base de développement.');
  const env = { ...process.env, DATABASE_URL: URL_TEST, DIRECT_URL: URL_TEST };
  // `migrate deploy` n'efface rien : il applique les migrations manquantes.
  // Pas de remise à zéro — chaque test crée ses propres comptes et projets,
  // avec des identifiants uniques, et ne dépend d'aucun état antérieur.
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'pipe' });
  prete = true;
}
