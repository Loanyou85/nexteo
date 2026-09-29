import Link from 'next/link';
import { Coque, EnTete } from '@/components/coque/coque';
import { FormulaireSuppression } from '@/components/auth/suppression';
import { Bouton } from '@/components/ui/bouton';
import { Panneau } from '@/components/ui/panneau';
import { dateHeure } from '@/lib/format';
import { requireUser } from '@/server/auth';
import { solde } from '@/server/credits';
import { db } from '@/server/db';
import { offreDe } from '@/server/offre';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mon compte' };

const RAISONS: Record<string, string> = {
  grant: 'versement',
  reserve: 'réservation',
  release: 'libération',
  debit: 'débit',
  refund: 'remboursement',
  expire: 'expiration',
  adjust: 'ajustement',
};
const COMPARTIMENTS: Record<string, string> = { subscription: 'abonnement', rollover: 'report', topup: 'recharge' };

export default async function ComptePage() {
  return (
    <Coque>
      <Contenu />
    </Coque>
  );
}

async function Contenu() {
  const user = await requireUser();
  const [offre, s, lignes] = await Promise.all([
    offreDe(user.id),
    solde(user.id),
    db.creditLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
  ]);

  return (
    <>
      <EnTete titre="Mon compte" sous={user.email ?? ''} />
      <div className="grid gap-6 px-4 pb-12 sm:px-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Panneau interieur="p-5">
            <h2 className="display text-[22px]">Crédits</h2>
            <p className="display tabular mt-2 text-[44px] text-arc-cyan">{s.total}</p>
            <p className="text-sm text-text-2">
              {s.parCompartiment.subscription} d’abonnement · {s.parCompartiment.rollover} reportés · {s.parCompartiment.topup} de recharge. Consommés dans cet ordre.
            </p>
          </Panneau>
          <Panneau interieur="p-0 overflow-hidden">
            <h2 className="border-b border-void-700 px-5 py-3 text-sm font-medium">Registre (30 dernières lignes)</h2>
            {lignes.length === 0 ? (
              <p className="p-5 text-sm text-text-3">Aucun mouvement.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <tbody className="tabular divide-y divide-void-700">
                  {lignes.map((l) => (
                    <tr key={l.id}>
                      <td className="px-5 py-2.5 text-text-3">{dateHeure(l.createdAt)}</td>
                      <td className="px-3 py-2.5 text-text-2">{RAISONS[l.reason]}</td>
                      <td className="px-3 py-2.5 text-text-3">{COMPARTIMENTS[l.bucket]}</td>
                      <td className={l.delta > 0 ? 'px-5 py-2.5 text-right text-ok' : 'px-5 py-2.5 text-right text-text-1'}>
                        {l.delta > 0 ? '+' : ''}
                        {l.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panneau>
        </div>
        <div className="space-y-6">
          <Panneau interieur="p-5">
            <h2 className="display text-[22px]">Offre {offre.plan.name}</h2>
            <p className="mt-2 text-sm text-text-2">
              {offre.actif && offre.abonnement?.currentPeriodEnd
                ? `${offre.abonnement.cancelAtPeriodEnd ? 'Se termine' : 'Renouvellement'} le ${dateHeure(offre.abonnement.currentPeriodEnd)}.`
                : 'Aucun abonnement payant.'}
            </p>
            <Bouton asChild variant="secondaire" taille="sm" className="mt-4">
              <Link href="/tarifs">Changer d’offre ou recharger</Link>
            </Bouton>
          </Panneau>
          <Panneau interieur="p-5">
            <h2 className="display text-[22px]">Mes données</h2>
            <p className="mt-2 text-sm text-text-2">Tout ce que Nexteo détient sur toi — projets, plans, code Verse, registre de crédits — dans un fichier.</p>
            <Bouton asChild taille="sm" className="mt-4">
              <a href="/api/compte/export">Exporter mes données</a>
            </Bouton>
          </Panneau>
          <Panneau interieur="p-5" couleurBord="var(--color-fail)">
            <h2 className="display text-[22px] text-fail">Supprimer mon compte</h2>
            <p className="mb-4 mt-2 text-sm text-text-2">
              Définitif. Ton abonnement est résilié, et tes projets, plans, fichiers et historiques sont effacés. Tes projets dans UEFN, sur ton PC, ne sont pas touchés.
            </p>
            <FormulaireSuppression email={user.email ?? ''} />
          </Panneau>
        </div>
      </div>
    </>
  );
}
