import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from '@/server/db';
import { classer } from '@/lib/panne/classer';

/**
 * Autotest du site.
 *
 * Il refait, une par une, les opérations dont dépend la première question du
 * diagnostic : lire la base, y écrire, poser un cookie. Quand quelque chose
 * casse en production, c'est la seule façon de savoir laquelle des trois
 * tombe sans avoir accès aux journaux de l'hébergeur.
 */
export interface ResultatEtape {
  nom: string;
  ok: boolean;
  code?: string;
  message?: string;
  millisecondes: number;
}

export interface Autotest {
  ok: boolean;
  etapes: ResultatEtape[];
  contenu: { phases: number; archetypes: number; gabarits: number; complet: boolean } | null;
  configuration: Record<string, boolean | number>;
}

/** Retire tout ce qui pourrait ressembler à une adresse de connexion ou à une clé. */
function nettoyer(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[adresse masquée]')
    .replace(/\b(?:sk|pk|rk|whsec)_[A-Za-z0-9_]+/g, '[clé masquée]')
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[adresse masquée]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

async function mesurer(nom: string, travail: () => Promise<void>): Promise<ResultatEtape> {
  const debut = Date.now();
  try {
    await travail();
    return { nom, ok: true, millisecondes: Date.now() - debut };
  } catch (error) {
    return {
      nom,
      ok: false,
      code: classer(error),
      message: error instanceof Error ? nettoyer(error.message) : undefined,
      millisecondes: Date.now() - debut,
    };
  }
}

export async function autotest(): Promise<Autotest> {
  const etapes: ResultatEtape[] = [];
  let contenu: Autotest['contenu'] = null;

  etapes.push(
    await mesurer('Lire la base', async () => {
      const [phases, archetypes, gabarits] = await Promise.all([
        db.phase.count(),
        db.ideaBlueprint.count(),
        db.promptTemplate.count(),
      ]);
      contenu = {
        phases,
        archetypes,
        gabarits,
        complet: phases === 13 && archetypes > 0 && gabarits > 0,
      };
    }),
  );

  // Exactement ce que fait la première question : créer un profil anonyme,
  // puis y écrire une réponse.
  let jetable: string | null = null;
  etapes.push(
    await mesurer('Écrire dans la base', async () => {
      const profil = await db.profile.create({ data: { anonId: `autotest-${randomUUID()}` } });
      jetable = profil.id;
      await db.profile.update({ where: { id: profil.id }, data: { age: 21 } });
    }),
  );
  if (jetable) await db.profile.delete({ where: { id: jetable } }).catch(() => undefined);

  etapes.push(
    await mesurer('Lire les cookies', async () => {
      (await cookies()).get('nexteo_diagnostic');
    }),
  );

  return {
    ok: etapes.every((e) => e.ok) && Boolean(contenu && (contenu as { complet: boolean }).complet),
    etapes,
    contenu,
    configuration: {
      ia: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
      webhookStripe: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
      tarifsStripe: [
        process.env.STRIPE_PRICE_DEPART,
        process.env.STRIPE_PRICE_CONSTRUCTION,
        process.env.STRIPE_PRICE_LANCEMENT,
      ].filter((v) => Boolean(v?.trim())).length,
      secretAuth: Boolean(process.env.AUTH_SECRET?.trim()),
      urlAuth: Boolean(process.env.AUTH_URL?.trim()),
      baseConfiguree: Boolean(process.env.DATABASE_URL?.trim()),
      baseDirecteDistincte: Boolean(
        process.env.DIRECT_URL?.trim() && process.env.DIRECT_URL !== process.env.DATABASE_URL,
      ),
    },
  };
}

/**
 * L'écriture d'un cookie ne se teste que dans une Server Action ou un
 * gestionnaire de route — jamais pendant le rendu d'une page. C'est pour ça
 * qu'elle vit à part.
 */
export async function testerEcritureCookie(): Promise<ResultatEtape> {
  return mesurer('Poser un cookie', async () => {
    const boite = await cookies();
    boite.set('nexteo_autotest', '1', { httpOnly: true, path: '/', maxAge: 5 });
    boite.delete('nexteo_autotest');
  });
}
