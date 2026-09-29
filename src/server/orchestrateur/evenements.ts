import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';

/**
 * Journal de la console (section 25). Chaque ligne est un fait qui s'est
 * produit — jamais une étape décorative. La console ne lit que ça.
 */

export type TypeEvenement =
  | 'session'
  | 'tache_debut'
  | 'tache_fin'
  | 'tache_echec'
  | 'verification'
  | 'erreur'
  | 'correctif'
  | 'log'
  | 'test'
  | 'palier'
  | 'budget'
  | 'credits';

export async function emettre(
  s: { sessionId: string; projectId: string },
  type: TypeEvenement,
  message: string,
  extra: { niveau?: 'info' | 'ok' | 'warn' | 'fail'; taskKey?: string; data?: Prisma.InputJsonValue } = {},
) {
  await db.agentEvent.create({
    data: {
      sessionId: s.sessionId,
      projectId: s.projectId,
      type,
      level: extra.niveau ?? 'info',
      taskKey: extra.taskKey ?? null,
      message,
      data: extra.data ?? undefined,
    },
  });
}
