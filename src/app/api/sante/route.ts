import { autotest, testerEcritureCookie } from '@/server/autotest';

export const dynamic = 'force-dynamic';

/**
 * État du site, en une adresse.
 *
 * Quand quelque chose casse en production, les questions sont toujours les
 * mêmes : est-ce que la base répond, est-ce qu'elle accepte une écriture,
 * est-ce que les cookies passent, est-ce que le contenu est là. Sans cette
 * page il faut lire les journaux de l'hébergeur.
 *
 * Aucune valeur de configuration n'est renvoyée — des booléens, des comptes,
 * et des messages nettoyés de tout ce qui ressemble à une adresse ou à une clé.
 */
export async function GET() {
  const rapport = await autotest();
  // Un gestionnaire de route a le droit d'écrire un cookie : c'est le seul
  // endroit où cette étape-là peut être vérifiée.
  const cookieEcriture = await testerEcritureCookie();

  const etapes = [...rapport.etapes, cookieEcriture];
  const ok = rapport.ok && cookieEcriture.ok;

  return Response.json(
    { etat: ok ? 'ok' : 'problème', etapes, contenu: rapport.contenu, configuration: rapport.configuration },
    { status: ok ? 200 : 503 },
  );
}
