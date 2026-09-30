import 'server-only';
import type { LocalAgent, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PanneEditeur } from '@/lib/uefn/provider';
import { db } from '@/server/db';
import { DUREE_CODE_MS, empreinte, genererCode, genererJeton, jetonValide, normaliserCode } from './jetons';

/**
 * Canal entre le site et l'agent local (phase E).
 *
 * C'est l'agent qui appelle le site, jamais l'inverse : le site tourne sur des
 * fonctions sans serveur, qui ne peuvent pas garder de WebSocket ouverte, et
 * un PC domestique n'accepte aucune connexion entrante. L'agent demande donc
 * ses ordres en « long-poll » et poste leurs résultats.
 *
 * L'agent n'est qu'un TUYAU : il relaie des appels MCP vers l'éditeur, sur la
 * machine. Toute la connaissance des outils vit ici, côté site, pour pouvoir
 * changer sans réinstaller quoi que ce soit chez l'utilisateur.
 */

/** Un agent qui ne s'est pas manifesté depuis ce délai est considéré hors ligne. */
export const AGENT_VIVANT_MS = 90_000;
export const MAX_AGENTS_PAR_UTILISATEUR = 5;
const MAX_RESULTAT_OCTETS = 1_000_000;
const ATTENTE_MAX_MS = 25_000;
const PAS_ATTENTE_MS = 500;

/** Les seules opérations que l'agent accepte de relayer. Rien d'autre, jamais. */
export const METHODES = ['mcp.ping', 'mcp.listTools', 'mcp.callTool'] as const;
export type Methode = (typeof METHODES)[number];

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Appairage ──────────────────────────────────────────────────────────────

/** Nouveau code pour l'utilisateur ; les anciens codes non utilisés sont invalidés. */
export async function creerCodeAppairage(userId: string): Promise<{ code: string; expireLe: Date }> {
  const code = genererCode();
  const expireLe = new Date(Date.now() + DUREE_CODE_MS);
  await db.$transaction([
    db.pairingCode.deleteMany({ where: { userId, usedAt: null } }),
    db.pairingCode.create({ data: { userId, codeHash: empreinte(normaliserCode(code)), expiresAt: expireLe } }),
  ]);
  return { code, expireLe };
}

export const appairageSchema = z.object({
  code: z.string().min(6).max(20),
  machineName: z.string().trim().min(1).max(80),
  machineId: z.string().trim().min(8).max(100),
  version: z.string().trim().max(40).optional(),
});

export type ResultatAppairage = { ok: true; jeton: string; agentId: string } | { ok: false; erreur: string };

/**
 * Échange un code contre un jeton. La consommation du code est atomique : deux
 * agents qui présentent le même code au même instant, un seul l'obtient.
 */
export async function appairer(entree: z.infer<typeof appairageSchema>): Promise<ResultatAppairage> {
  const codeHash = empreinte(normaliserCode(entree.code));
  const maintenant = new Date();

  const consomme = await db.pairingCode.updateMany({
    where: { codeHash, usedAt: null, expiresAt: { gt: maintenant } },
    data: { usedAt: maintenant },
  });
  // Même message pour « inconnu », « expiré » et « déjà utilisé » : ne rien apprendre à qui devine.
  if (consomme.count !== 1) return { ok: false, erreur: 'Code invalide ou expiré. Génère-en un nouveau sur le site.' };

  const code = await db.pairingCode.findUniqueOrThrow({ where: { codeHash } });
  const jeton = genererJeton();
  const existant = await db.localAgent.findUnique({ where: { userId_machineId: { userId: code.userId, machineId: entree.machineId } } });

  if (!existant) {
    const n = await db.localAgent.count({ where: { userId: code.userId, revokedAt: null } });
    if (n >= MAX_AGENTS_PAR_UTILISATEUR) {
      return { ok: false, erreur: `Tu as déjà ${MAX_AGENTS_PAR_UTILISATEUR} agents connectés : révoque-en un sur le site avant d’en ajouter.` };
    }
  }

  // Un nouvel appairage de la même machine remplace l'ancien jeton : l'ancien cesse de fonctionner.
  const agent = await db.localAgent.upsert({
    where: { userId_machineId: { userId: code.userId, machineId: entree.machineId } },
    create: { userId: code.userId, machineId: entree.machineId, machineName: entree.machineName, version: entree.version, tokenHash: empreinte(jeton), lastSeenAt: maintenant },
    update: { machineName: entree.machineName, version: entree.version, tokenHash: empreinte(jeton), revokedAt: null, lastSeenAt: maintenant },
  });
  return { ok: true, jeton, agentId: agent.id };
}

// ─── Authentification de l'agent ────────────────────────────────────────────

export async function authentifierAgent(req: Request): Promise<LocalAgent | null> {
  const entete = req.headers.get('authorization') ?? '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7).trim() : '';
  if (!jetonValide(jeton)) return null;
  const agent = await db.localAgent.findUnique({ where: { tokenHash: empreinte(jeton) } });
  if (!agent || agent.revokedAt) return null;
  return db.localAgent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() } });
}

export async function revoquerAgent(userId: string, agentId: string): Promise<boolean> {
  const r = await db.localAgent.updateMany({ where: { id: agentId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  // Ses ordres en attente ne doivent pas rester à attendre un agent qui ne viendra plus.
  if (r.count === 1) {
    await db.agentCommand.updateMany({
      where: { agentId, status: { in: ['pending', 'taken'] } },
      data: { status: 'failed', error: 'agent révoqué', doneAt: new Date() },
    });
  }
  return r.count === 1;
}

export function agentVivant(a: { lastSeenAt: Date | null; revokedAt: Date | null } | null | undefined): boolean {
  return !!a && !a.revokedAt && !!a.lastSeenAt && a.lastSeenAt.getTime() > Date.now() - AGENT_VIVANT_MS;
}

/** L'agent vivant le plus récent de l'utilisateur, s'il y en a un. */
export async function agentDe(userId: string): Promise<LocalAgent | null> {
  const a = await db.localAgent.findFirst({ where: { userId, revokedAt: null }, orderBy: { lastSeenAt: 'desc' } });
  return agentVivant(a) ? a : null;
}

// ─── Côté agent : prendre des ordres, rendre des résultats ──────────────────

export type OrdreAgent = { id: string; method: string; params: unknown };

/** Long-poll : rend dès qu'un ordre existe, ou vide au bout du délai. */
export async function prendreOrdres(agentId: string, attenteMs = ATTENTE_MAX_MS): Promise<OrdreAgent[]> {
  const limite = Date.now() + Math.min(Math.max(attenteMs, 0), ATTENTE_MAX_MS);
  for (;;) {
    // SKIP LOCKED : deux requêtes concurrentes de l'agent ne se disputent jamais le même ordre.
    const pris = await db.$queryRaw<{ id: string; method: string; params: unknown }[]>`
      UPDATE "AgentCommand" SET "status" = 'taken', "takenAt" = now()
      WHERE "id" IN (
        SELECT "id" FROM "AgentCommand"
        WHERE "agentId" = ${agentId} AND "status" = 'pending' AND "expiresAt" > now()
        ORDER BY "createdAt" ASC LIMIT 5
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "method", "params"`;
    if (pris.length > 0) return pris;
    if (Date.now() + PAS_ATTENTE_MS >= limite) return [];
    await attendre(PAS_ATTENTE_MS);
  }
}

export const resultatSchema = z.object({
  id: z.string().min(1).max(60),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().max(4000).optional(),
  /** Nature de l'échec quand `ok` est faux : décide si c'est une panne de plateforme. */
  categorie: z.enum(['mcp_unreachable', 'mcp_timeout', 'editor_hang', 'outil']).optional(),
});

export async function enregistrerResultat(agentId: string, r: z.infer<typeof resultatSchema>): Promise<'ok' | 'inconnu' | 'trop_gros'> {
  const brut = JSON.stringify(r.result ?? null);
  if (Buffer.byteLength(brut) > MAX_RESULTAT_OCTETS) return 'trop_gros';
  const erreur = r.ok ? null : `${r.categorie ?? 'outil'}: ${r.error ?? 'échec sans détail'}`;
  const maj = await db.agentCommand.updateMany({
    // Seul l'agent destinataire répond, et une seule fois.
    where: { id: r.id, agentId, status: 'taken' },
    data: { status: r.ok ? 'done' : 'failed', result: r.ok ? ((r.result ?? null) as Prisma.InputJsonValue) : undefined, error: erreur, doneAt: new Date() },
  });
  return maj.count === 1 ? 'ok' : 'inconnu';
}

// ─── Côté site : envoyer un ordre et attendre la réponse ────────────────────

export type OptionsOrdre = { delaiMs?: number };

/**
 * Envoie un ordre et attend son résultat.
 *
 * Les échecs dus à la plateforme (agent hors ligne, éditeur muet) sont des
 * `PanneEditeur` : l'orchestrateur les rejoue, et rembourse si le build finit
 * par y échouer. Une erreur d'outil, elle, est une vraie erreur.
 */
export async function envoyerOrdre(agentId: string, method: Methode, params: unknown, opts: OptionsOrdre = {}): Promise<unknown> {
  const delaiMs = opts.delaiMs ?? 30_000;
  const agent = await db.localAgent.findUnique({ where: { id: agentId }, select: { lastSeenAt: true, revokedAt: true } });
  if (!agentVivant(agent)) throw new PanneEditeur('mcp_unreachable', 'L’agent local ne répond plus : il est éteint, déconnecté ou révoqué.');

  const ordre = await db.agentCommand.create({
    data: { agentId, method, params: (params ?? {}) as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + delaiMs) },
  });

  const limite = Date.now() + delaiMs;
  while (Date.now() < limite) {
    const o = await db.agentCommand.findUniqueOrThrow({ where: { id: ordre.id } });
    if (o.status === 'done') return o.result;
    if (o.status === 'failed') {
      const [categorie, ...reste] = (o.error ?? '').split(': ');
      const message = reste.join(': ') || o.error || 'échec sans détail';
      if (categorie === 'mcp_unreachable' || categorie === 'mcp_timeout' || categorie === 'editor_hang') {
        throw new PanneEditeur(categorie, message);
      }
      throw new Error(message);
    }
    await attendre(250);
  }
  await db.agentCommand.updateMany({
    where: { id: ordre.id, status: { in: ['pending', 'taken'] } },
    data: { status: 'failed', error: 'mcp_timeout: aucune réponse de l’agent dans le délai', doneAt: new Date() },
  });
  throw new PanneEditeur('mcp_timeout', `L’agent local n’a pas répondu en ${Math.round(delaiMs / 1000)} s.`);
}

/**
 * Demande à l'éditeur la liste de ses outils et la conserve.
 *
 * C'est la seule source des noms d'outils réels : le MCP d'UEFN est en bêta,
 * et on ne les devine pas. La liste conservée est affichée dans la page de
 * connexion UEFN et sert à écrire — ou corriger — le fournisseur MCP.
 */
export async function decouvrirCatalogue(agentId: string): Promise<number> {
  const r = (await envoyerOrdre(agentId, 'mcp.listTools', {}, { delaiMs: 45_000 })) as { outils?: unknown[]; protocolVersion?: string } | null;
  const outils = Array.isArray(r?.outils) ? r.outils : [];
  await db.localAgent.update({
    where: { id: agentId },
    data: { catalogue: { protocolVersion: r?.protocolVersion ?? null, outils } as Prisma.InputJsonValue, catalogueAt: new Date() },
  });
  return outils.length;
}
