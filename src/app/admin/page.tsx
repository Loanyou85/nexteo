import Link from 'next/link';
import { Coque, EnTete } from '@/components/coque/coque';
import { Bouton } from '@/components/ui/bouton';
import { Panneau } from '@/components/ui/panneau';
import { duree, euros2 } from '@/lib/format';
import { requireAdmin } from '@/server/auth';
import { db } from '@/server/db';
import { metriques } from '@/server/metriques';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administration' };

export default async function AdminPage() {
  return (
    <Coque>
      <Contenu />
    </Coque>
  );
}

function Chiffre({ valeur, libelle, detail, fort }: { valeur: string; libelle: string; detail?: string; fort?: boolean }) {
  return (
    <Panneau interieur="p-5" biseau={12} actif={fort} couleurBord={fort ? 'var(--color-arc-blue)' : undefined}>
      <p className={fort ? 'display tabular text-[44px] text-text-1' : 'display tabular text-[32px] text-text-1'}>{valeur}</p>
      <p className="mt-1 text-sm text-text-2">{libelle}</p>
      {detail ? <p className="mt-1 text-2xs text-text-3">{detail}</p> : null}
    </Panneau>
  );
}

async function Contenu() {
  await requireAdmin();
  const [m, workers, utilisateurs, projets] = await Promise.all([
    metriques(),
    db.workerHeartbeat.findMany({ where: { seenAt: { gt: new Date(Date.now() - 60_000) } } }),
    db.user.count(),
    db.project.count(),
  ]);
  const pct = (v: number | null) => (v === null ? '—' : `${v.toString().replace('.', ',')} %`);

  return (
    <>
      <EnTete
        titre="Administration"
        sous={`${utilisateurs} compte(s), ${projets} projet(s), ${m.builds} build(s) clos dont ${m.buildsReels} réel(s). ${workers.length ? `${workers.length} worker(s) actif(s).` : 'Aucun worker actif : les builds simulés avancent depuis la console.'}`}
        actions={
          <Bouton asChild>
            <Link href="/admin/offres">Offres, prix et soldes</Link>
          </Bouton>
        }
      />
      <div className="space-y-6 px-4 pb-12 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Chiffre
            fort
            valeur={m.averageAiCostPerBuildMicros === null ? '—' : euros2(m.averageAiCostPerBuildMicros)}
            libelle="Coût IA moyen par build (average_ai_cost_per_build)"
            detail={
              m.buildsReels === 0
                ? `Aucun build réel mesuré. Builds simulés : ${m.averageAiCostPerBuildSimulatedMicros === null ? '—' : euros2(m.averageAiCostPerBuildSimulatedMicros)} estimés, non comptés.`
                : `Sur ${m.buildsReels} build(s) réels. Les builds simulés sont exclus.`
            }
          />
          <Chiffre fort valeur={pct(m.humanInterventionRate)} libelle="Taux d’intervention humaine (human_intervention_rate)" detail="Builds qui ont dû s’arrêter pour demander un accord, un complément de budget ou une décision." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Chiffre valeur={pct(m.generationSuccessRate)} libelle="Réussite des générations" />
          <Chiffre valeur={pct(m.compileSuccessRate)} libelle="Compilations réussies" />
          <Chiffre valeur={pct(m.firstPlaytestSuccessRate)} libelle="Premier playtest réussi" />
          <Chiffre valeur={m.averageRetries === null ? '—' : String(m.averageRetries).replace('.', ',')} libelle="Reprises moyennes" />
          <Chiffre valeur={m.averageBuildTimeMs === null ? '—' : duree(m.averageBuildTimeMs)} libelle="Durée moyenne d’un build" />
        </div>
        <p className="text-xs text-text-3">
          Ces deux premiers chiffres décident si le produit est viable. Tant qu’aucun build n’a tourné contre le vrai MCP avec une vraie IA, ils ne
          mesurent rien de réel — et c’est affiché comme tel.
        </p>
      </div>
    </>
  );
}
