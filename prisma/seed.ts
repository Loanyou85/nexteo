import { PrismaClient } from '@prisma/client';
import { semer } from '../src/server/semis';

/**
 * Lanceur du semis (logique dans src/server/semis.ts).
 *
 * Il tourne à CHAQUE déploiement, sur la connexion DIRECTE (sans pooler) :
 * derrière un répartiteur de connexions, des requêtes préparées peuvent se
 * télescoper et le semis échouait sans bruit — le site se retrouvait avec un
 * schéma mais sans offres ni réglages, et toutes les pages sauf l'accueil
 * tombaient. On passe donc par DIRECT_URL, comme les migrations.
 */
const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
const db = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

semer(db)
  .then((n) => console.log(n > 0 ? `[semis] ${n} élément(s) créé(s).` : '[semis] Rien à créer : tout est déjà en place.'))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
