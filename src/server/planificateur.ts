import 'server-only';
import { gameSpecSchema, type GameSpec } from '@/lib/gamespec/schema';
import { appelIA } from '@/server/ia';
import { db } from '@/server/db';

/**
 * Idée → GameSpec (section 5.3, étape 1).
 *
 * L'IA reçoit le modèle du template activé, le catalogue de devices et la
 * table de correspondance : elle PERSONNALISE un plan, elle n'invente ni
 * device ni genre. La réponse est validée par le schéma complet avant d'être
 * enregistrée.
 */

const SYSTEME = `Tu conçois des jeux pour Unreal Editor for Fortnite (UEFN).
Tu reçois une idée de jeu et un modèle de départ. Tu produis un GameSpec qui personnalise ce modèle.
Règles strictes :
- Les devices viennent UNIQUEMENT du catalogue fourni : n'invente aucun type de device.
- Le genre reste celui du modèle : c'est le seul activé.
- Les textes (titre, description, objectifs) sont en français.
- Les identifiants stables sont en minuscules, chiffres et tirets bas.
- Chaque exigence de test doit être vérifiable dans les logs d'une partie.`;

export async function planifier(args: {
  userId: string;
  projectId: string;
  titre: string;
  idee: string;
  gameId: string;
}): Promise<{ spec: GameSpec; simule: boolean; genreDemande: string | null }> {
  const [template, catalogue, correspondances] = await Promise.all([
    db.gameTemplate.findFirst({ where: { enabled: true }, orderBy: { sortOrder: 'asc' } }),
    db.deviceDefinition.findMany({ select: { deviceType: true, capabilities: true, verifiedAt: true } }),
    db.deviceMapping.findMany({ select: { need: true, deviceType: true } }),
  ]);
  if (!template) throw new Error('Aucun template activé : la base n’a pas été semée.');

  const message = [
    `Titre voulu : ${args.titre}`,
    `Idée : ${args.idee}`,
    `gameId : ${args.gameId}`,
    `Modèle de départ (${template.name}) :`,
    JSON.stringify(template.baseSpec),
    'Catalogue de devices :',
    JSON.stringify(catalogue),
    'Correspondance besoin → device :',
    JSON.stringify(correspondances),
    `Pièges connus de ce template : ${template.pitfalls.join(' / ')}`,
  ].join('\n');

  const r = await appelIA({ userId: args.userId, projectId: args.projectId, type: 'plan' }, (ia) =>
    ia.structuredOutput({
      systeme: SYSTEME,
      message,
      schema: gameSpecSchema,
      nomSchema: 'GameSpec',
      simulation: { idee: args.idee, titre: args.titre, gameId: args.gameId },
    }),
  );

  // Défense en profondeur : un device absent du catalogue est refusé même si
  // le schéma l'a laissé passer.
  const connus = new Set(catalogue.map((d) => d.deviceType));
  const inconnus = r.valeur.devices.filter((d) => !connus.has(d.deviceType)).map((d) => d.deviceType);
  if (inconnus.length) throw new Error(`Devices hors catalogue refusés : ${inconnus.join(', ')}`);

  const genreDemande = /gun ?game|tycoon|course|racing|horreur|horror|ar[eè]ne|pvp|deathrun|parcours/i.exec(args.idee)?.[0] ?? null;

  return { spec: { ...r.valeur, gameId: args.gameId, version: 1 }, simule: r.simule, genreDemande };
}
