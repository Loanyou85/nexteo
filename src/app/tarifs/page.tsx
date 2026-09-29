import { CoquePublique } from '@/components/coque/coque-publique';
import { PageTarifs, type OffreVue } from '@/components/tarifs/page-tarifs';
import { periodeCourante } from '@/server/offre';
import { configEntier, configJson, type LigneBareme } from '@/server/config';
import { sessionOuNull } from '@/server/auth';
import { db } from '@/server/db';
import { etatBase } from '@/server/etat';
import { BaseAbsente } from '@/components/coque/base-absente';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Tarifs',
  description: 'Créateur, Pro, Studio. Des crédits calibrés sur le coût réel, mensuel ou annuel avec 2 mois offerts.',
};

export default async function TarifsPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const etat = await etatBase();
  if (!etat.pret) return <BaseAbsente etat={etat} />;

  const { periode } = await searchParams;
  const [plans, bareme, coutParCredit, majoration, suggestions, min, max, session] = await Promise.all([
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    configJson<LigneBareme[]>('BAREME'),
    configEntier('COST_PER_CREDIT'),
    configEntier('TOPUP_MARKUP_PCT'),
    configJson<number[]>('TOPUP_SUGGESTIONS'),
    configEntier('TOPUP_MIN_CREDITS'),
    configEntier('TOPUP_MAX_CREDITS'),
    sessionOuNull(),
  ]);

  const vue = (p: (typeof plans)[number]): OffreVue => ({
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    monthlyPriceCents: p.monthlyPriceCents,
    annualPriceCents: p.annualPriceCents,
    monthlyCredits: p.monthlyCredits,
    monthlyGamePlans: p.monthlyGamePlans,
    maxProjects: p.maxProjects,
    maxMembers: p.maxMembers,
    versionHistoryDays: p.versionHistoryDays,
    queuePriority: p.queuePriority,
    equivalent: p.equivalent,
    features: p.features as OffreVue['features'],
    isHighlighted: p.isHighlighted,
  });

  const abonnement = session?.user?.id
    ? await db.subscription.findUnique({ where: { userId: session.user.id }, include: { plan: true } })
    : null;
  const actif = abonnement && ['active', 'trialing'].includes(abonnement.status) && (!abonnement.currentPeriodEnd || abonnement.currentPeriodEnd > new Date());
  const debutMois = new Date(`${periodeCourante()}-01T00:00:00Z`);
  const rechargesDuMois = session?.user?.id
    ? await db.creditLedger.count({ where: { userId: session.user.id, bucket: 'topup', reason: 'grant', createdAt: { gte: debutMois } } })
    : 0;

  return (
    <CoquePublique cta={false}>
      <PageTarifs
        offres={plans.filter((p) => p.monthlyPriceCents > 0).map(vue)}
        decouverte={plans.find((p) => p.monthlyPriceCents === 0) ? vue(plans.find((p) => p.monthlyPriceCents === 0)!) : null}
        bareme={bareme}
        coutParCreditCents={coutParCredit}
        majorationPct={majoration}
        recharge={actif && abonnement.plan.monthlyCredits > 0 ? { suggestions, min, max, offre: vue(abonnement.plan) } : null}
        utilisateur={{
          connecte: !!session,
          abonnement: actif ? { slug: abonnement.plan.slug, intervalle: abonnement.interval } : null,
        }}
        periodeInitiale={periode === 'annuel' ? 'annuel' : 'mensuel'}
        rechargesDuMois={rechargesDuMois}
      />
    </CoquePublique>
  );
}
