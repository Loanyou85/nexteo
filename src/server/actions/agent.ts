'use server';

import { revalidatePath } from 'next/cache';
import { estPannePlateforme } from '@/lib/uefn/provider';
import { agentDe, creerCodeAppairage, decouvrirCatalogue, revoquerAgent } from '@/server/agent/canal';
import { requireUser } from '@/server/auth';
import { origine } from '@/server/origine';

export type EtatCode = { code?: string; expireLe?: string; site?: string; erreur?: string };
export type EtatDecouverte = { nombre?: number; erreur?: string };

/** Nouveau code d'appairage. Affiché une fois : seul son empreinte est conservée. */
export async function genererCode(): Promise<EtatCode> {
  const user = await requireUser();
  const { code, expireLe } = await creerCodeAppairage(user.id);
  return { code, expireLe: expireLe.toISOString(), site: await origine() };
}

/** Demande à l'éditeur la liste réelle de ses outils, et la conserve. */
export async function decouvrirOutils(): Promise<EtatDecouverte> {
  const user = await requireUser();
  const agent = await agentDe(user.id);
  if (!agent) return { erreur: 'Aucun agent connecté : lance l’agent sur ton PC, puis réessaie.' };
  try {
    const nombre = await decouvrirCatalogue(agent.id);
    revalidatePath('/connexion-uefn');
    return { nombre };
  } catch (e) {
    // Panne de la plateforme (éditeur fermé, muet) ou refus de l'éditeur : dit tel quel, sans détour.
    return { erreur: estPannePlateforme(e) ? (e as Error).message : `L’éditeur a refusé la demande : ${(e as Error).message}` };
  }
}

export async function revoquer(agentId: string): Promise<void> {
  const user = await requireUser();
  await revoquerAgent(user.id, agentId);
  revalidatePath('/connexion-uefn');
}
