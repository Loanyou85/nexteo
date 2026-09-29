import 'server-only';
import type { Prisma } from '@prisma/client';
import { MockUEFNProvider, etatInitial, type DepotSimulation, type EtatSimulation } from '@/lib/uefn/mock';
import type { UEFNProvider } from '@/lib/uefn/provider';
import { db } from '@/server/db';

/**
 * Fabrique du fournisseur UEFN d'un projet. Aujourd'hui toujours simulé ;
 * le fournisseur MCP réel (phase F) passera par l'agent local.
 */

class DepotBase implements DepotSimulation {
  constructor(private readonly projectId: string) {}

  async lire(): Promise<EtatSimulation> {
    const l = await db.simulationState.findUnique({ where: { projectId: this.projectId } });
    return l ? (l.state as unknown as EtatSimulation) : etatInitial();
  }

  async ecrire(etat: EtatSimulation): Promise<void> {
    const state = etat as unknown as Prisma.InputJsonValue;
    await db.simulationState.upsert({
      where: { projectId: this.projectId },
      create: { projectId: this.projectId, state, opCounter: etat.compteur },
      update: { state, opCounter: etat.compteur },
    });
  }
}

export function fournisseurUEFN(projectId: string, joueurs: number): UEFNProvider {
  const latence = Number(process.env.MOCK_LATENCE ?? '1');
  return new MockUEFNProvider(new DepotBase(projectId), {
    pannes: 'realiste',
    latence: Number.isFinite(latence) ? latence : 1,
    joueurs,
  });
}
