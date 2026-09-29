import { Coque, EnTete } from '@/components/coque/coque';
import { FormulaireAjustement, FormulaireOffre, FormulaireReglage } from '@/components/admin/formulaires';
import { Panneau } from '@/components/ui/panneau';
import { dateHeure } from '@/lib/format';
import { economieAnnuellePct, euros, margeBrute } from '@/lib/tarifs/calculs';
import { requireAdmin } from '@/server/auth';
import { configEntier } from '@/server/config';
import { db } from '@/server/db';
import { coutReelParCredit } from '@/server/metriques';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Offres' };

export default async function OffresAdminPage() {
  return (
    <Coque>
      <Contenu />
    </Coque>
  );
}

async function Contenu() {
  await requireAdmin();
  const [plans, historique, reglages, reel, tva, stripeBp, stripeFixe, hebergement, coutRef] = await Promise.all([
    db.plan.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { subscriptions: { where: { status: 'active' } } } } } }),
    db.planChange.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { plan: { select: { name: true } } } }),
    db.pricingConfig.findMany({ orderBy: { key: 'asc' } }),
    coutReelParCredit(),
    configEntier('VAT_RATE_BP'),
    configEntier('STRIPE_FEE_BP'),
    configEntier('STRIPE_FEE_FIXED_CENTS'),
    configEntier('HOSTING_COST_PER_SUB_CENTS'),
    configEntier('COST_PER_CREDIT'),
  ]);
  const coutUtilise = reel.parCreditCents ?? coutRef;
  const ecart = reel.parCreditCents === null ? null : Math.round(((reel.parCreditCents - coutRef) * 100) / coutRef);

  return (
    <>
      <EnTete titre="Offres et crédits" sous="Aucun prix, aucun quota, aucune remise dans le code : tout se modifie ici. Un changement de prix ne touche jamais les abonnés en cours." />
      <div className="space-y-6 px-4 pb-12 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Panneau interieur="p-5" biseau={12}>
            <p className="text-2xs uppercase tracking-wider text-text-3">Coût IA réel par crédit</p>
            <p className="display tabular mt-2 text-[36px]">{reel.parCreditCents === null ? '—' : euros(reel.parCreditCents, 'toujours')}</p>
            <p className="text-xs text-text-3">
              {reel.builds === 0 ? 'Aucun build réel clos : rien de mesuré. Les builds simulés sont exclus.' : `Sur ${reel.builds} build(s) réels, ${reel.credits} crédit(s) débités.`}
            </p>
          </Panneau>
          <Panneau interieur="p-5" biseau={12}>
            <p className="text-2xs uppercase tracking-wider text-text-3">Référence (COST_PER_CREDIT)</p>
            <p className="display tabular mt-2 text-[36px]">{euros(coutRef, 'toujours')}</p>
            <p className={ecart !== null && ecart > 0 ? 'text-xs text-fail' : 'text-xs text-text-3'}>
              {ecart === null ? 'Écart inconnu tant que rien n’est mesuré.' : `Écart : ${ecart > 0 ? '+' : ''}${ecart} % par rapport à la référence.`}
            </p>
          </Panneau>
          <Panneau interieur="p-5" biseau={12}>
            <p className="text-2xs uppercase tracking-wider text-text-3">Ne jamais descendre les prix</p>
            <p className="mt-2 text-sm text-text-2">…sans avoir mesuré le coût réel par crédit. Tant qu’il n’existe pas, les marges ci-dessous sont calculées avec la référence.</p>
          </Panneau>
        </div>

        <Panneau interieur="p-0 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-void-700 text-2xs uppercase tracking-wider text-text-3">
              <tr>
                <th className="px-4 py-3 font-medium">Offre</th>
                <th className="px-4 py-3 text-right font-medium">Abonnés</th>
                <th className="px-4 py-3 text-right font-medium">Remise annuelle</th>
                <th className="px-4 py-3 text-right font-medium">Marge à 100 %</th>
                <th className="px-4 py-3 text-right font-medium">Marge à 50 %</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-void-700">
              {plans.filter((p) => p.monthlyPriceCents > 0).map((p) => {
                const m = (c: number) => margeBrute({ prixTtcCents: p.monthlyPriceCents, tvaBp: tva, stripeBp, stripeFixeCents: stripeFixe, hebergementCents: hebergement, credits: p.monthlyCredits, consommationPct: c, coutParCreditCents: coutUtilise });
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-text-1">{p.name}</td>
                    <td className="px-4 py-3 text-right text-text-2">{p._count.subscriptions}</td>
                    <td className="px-4 py-3 text-right text-text-2">{p.annualPriceCents ? `${economieAnnuellePct(p.monthlyPriceCents, p.annualPriceCents)} %` : '—'}</td>
                    <td className="px-4 py-3 text-right text-text-1">{m(100).pct} % <span className="text-2xs text-text-3">({euros(m(100).margeCents, 'toujours')})</span></td>
                    <td className="px-4 py-3 text-right text-text-1">{m(50).pct} % <span className="text-2xs text-text-3">({euros(m(50).margeCents, 'toujours')})</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panneau>

        <div className="space-y-4">
          <h2 className="display text-[26px]">Modifier les offres</h2>
          {plans.map((p) => (
            <Panneau key={p.id} interieur="p-4" biseau={10}>
              <p className="mb-3 text-sm font-medium text-text-1">{p.name}</p>
              <FormulaireOffre p={p} />
            </Panneau>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panneau interieur="p-5 space-y-4">
            <h2 className="display text-[22px]">Réglages</h2>
            <FormulaireReglage cle="COST_PER_CREDIT" libelle="Coût IA de référence d’un crédit (centimes)" valeur={reglages.find((r) => r.key === 'COST_PER_CREDIT')?.value ?? ''} />
            <FormulaireReglage cle="TOPUP_MARKUP_PCT" libelle="Majoration du crédit en recharge (%)" valeur={reglages.find((r) => r.key === 'TOPUP_MARKUP_PCT')?.value ?? ''} />
            <FormulaireReglage cle="MAX_ANNUAL_DISCOUNT" libelle="Remise annuelle maximale (%, 20 au plus)" valeur={reglages.find((r) => r.key === 'MAX_ANNUAL_DISCOUNT')?.value ?? ''} />
            <FormulaireReglage cle="USD_EUR_RATE_PPM" libelle="Taux dollar → euro (millionièmes)" valeur={reglages.find((r) => r.key === 'USD_EUR_RATE_PPM')?.value ?? ''} />
          </Panneau>
          <Panneau interieur="p-5">
            <h2 className="display text-[22px]">Historique des modifications</h2>
            {historique.length === 0 ? (
              <p className="mt-3 text-sm text-text-3">Aucune modification.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {historique.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-x-2">
                    <span className="text-text-1">{h.plan.name}</span>
                    <span className="font-mono text-code text-text-2">{h.field}</span>
                    <span className="tabular text-text-3">{JSON.stringify(h.before)} → {JSON.stringify(h.after)}</span>
                    <span className="ml-auto text-2xs text-text-3">{dateHeure(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panneau>
        </div>

        <Panneau interieur="p-5">
          <h2 className="display text-[22px]">Ajuster le solde d’un compte</h2>
          <p className="mb-4 mt-1 text-sm text-text-2">Une ligne « ajustement » est ajoutée au registre, avec son motif et ton identifiant. Rien n’est jamais modifié ni effacé.</p>
          <FormulaireAjustement />
        </Panneau>
      </div>
    </>
  );
}
