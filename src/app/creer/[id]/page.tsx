import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Coque, EnTete } from '@/components/coque/coque';
import { ApercuConstruction } from '@/components/creation/apercu-construction';
import { Etapes } from '@/components/creation/etapes';
import { FormulairePlan } from '@/components/creation/formulaire-plan';
import { PanneauLancement } from '@/components/creation/lancement';
import { BadgePalier } from '@/components/ui/palier';
import { parametresDe } from '@/lib/gamespec/parametres';
import { lireGameSpec } from '@/lib/gamespec/schema';
import { estPalier } from '@/lib/palier';
import { requireUser } from '@/server/auth';
import { db } from '@/server/db';
import { modeUefn } from '@/server/mode';
import { estimer } from '@/server/orchestrateur/lancement';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Plan de map' };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Coque>
      <Contenu params={params} />
    </Coque>
  );
}

async function Contenu({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const projet = await db.project.findFirst({ where: { id, userId: user.id } });
  if (!projet) notFound();

  const [ligne, verifies, active, est] = await Promise.all([
    db.gameSpec.findUnique({ where: { projectId_version: { projectId: id, version: projet.currentSpecVersion } } }),
    db.deviceDefinition.findMany({ where: { verifiedAt: { not: null } }, select: { deviceType: true } }),
    db.agentSession.findFirst({ where: { projectId: id, status: { in: ['queued', 'running', 'paused', 'stopping', 'awaiting_human'] } } }),
    estimer(user.id, id),
  ]);
  const lu = ligne ? lireGameSpec(ligne.data) : null;
  if (!lu?.ok) notFound();

  return (
    <>
      <EnTete
        avant={<Etapes active={2} />}
        titre="Le plan de map"
        sous={
          <>
            Corrige ce qui ne va pas avant de lancer. Version {projet.currentSpecVersion}
            {ligne?.note ? <span className="mt-2 block text-warn">{ligne.note}</span> : null}
          </>
        }
        actions={<BadgePalier palier={estPalier(projet.tier) ? projet.tier : 1} />}
      />
      <div className="grid gap-6 px-4 pb-12 sm:px-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <FormulairePlan projectId={id} p={parametresDe(lu.spec)} />
        <div className="space-y-4">
          {active ? (
            <div className="chanfrein bg-arc-blue/15 p-4 text-sm [--c:10px]">
              Une construction est en cours sur ce projet.{' '}
              <Link href={`/projet/${id}/build/${active.id}`} className="text-arc-cyan underline underline-offset-4">
                Ouvrir la console
              </Link>
            </div>
          ) : (
            <PanneauLancement projectId={id} est={est} simulation={modeUefn() === 'mock'} />
          )}
          <ApercuConstruction spec={lu.spec} verifies={new Set(verifies.map((v) => v.deviceType))} />
        </div>
      </div>
    </>
  );
}
