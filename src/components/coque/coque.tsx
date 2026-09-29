import { BarreApp } from '@/components/coque/barre-app';
import { BanniereSimulation } from '@/components/coque/banniere-simulation';
import { BaseAbsente } from '@/components/coque/base-absente';
import { Pied } from '@/components/coque/pied';
import { requireUser } from '@/server/auth';
import { etatBase } from '@/server/etat';
import { modes } from '@/server/mode';
import { db } from '@/server/db';

/**
 * Coquille des pages connectées.
 *
 * Vérifie la base avant tout : si elle n'est pas prête, la page le dit et
 * s'arrête, plutôt que de planter sur la première requête.
 */
export async function Coque({ children }: { children: React.ReactNode }) {
  const etat = await etatBase();
  const m = modes();

  if (!etat.pret) {
    return (
      <>
        <BanniereSimulation uefn={m.uefn} ia={m.ia} />
        <BaseAbsente etat={etat} />
      </>
    );
  }

  const user = await requireUser();
  // Un agent est « connecté » s'il a donné signe de vie dans les deux
  // dernières minutes — pas s'il s'est enregistré un jour.
  const agent = await db.localAgent.findFirst({
    where: {
      userId: user.id,
      revokedAt: null,
      lastSeenAt: { gt: new Date(Date.now() - 2 * 60_000) },
    },
    select: { id: true },
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <BarreApp
        email={user.email ?? null}
        admin={user.role === 'admin'}
        etatAgent={agent ? 'connecte' : 'absent'}
      />
      <BanniereSimulation uefn={m.uefn} ia={m.ia} />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Pied />
    </div>
  );
}

/** En-tête de page : titre en Anton, sous-titre, actions. */
export function EnTete({
  titre,
  sous,
  actions,
  avant,
}: {
  titre: string;
  sous?: React.ReactNode;
  actions?: React.ReactNode;
  avant?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-4 pb-6 pt-8 sm:px-6">
      <div className="min-w-0">
        {avant}
        <h1 className="display text-[34px] text-text-1 sm:text-[40px]">{titre}</h1>
        {sous ? <div className="mt-2 max-w-2xl text-sm text-text-2">{sous}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
