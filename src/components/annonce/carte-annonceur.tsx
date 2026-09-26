import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BarreSignal } from '@/components/signal/barre';
import { ETIQUETTE_DEMO } from '@/lib/guardrails';
import type { LigneAnnonceur } from '@/server/annonceurs';

function dureeLisible(jours: number): string {
  if (jours <= 0) return 'Aucune diffusion en cours';
  if (jours < 60) return `Diffuse depuis ${jours} jours`;
  const mois = Math.floor(jours / 30);
  return `Diffuse depuis ${mois} mois`;
}

export function CarteAnnonceur({ a }: { a: LigneAnnonceur }) {
  return (
    <Card className="flex flex-col gap-3 transition-colors hover:border-neo-500/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/annonceur/${a.slug}`} className="block">
            <h3 className="truncate text-base font-semibold text-encre">{a.name}</h3>
          </Link>
          <p className="mt-0.5 truncate text-sm text-encre-2">
            {a.categorie ?? 'Non classé'}
            {a.pays.length > 0 ? ` · ${a.pays.slice(0, 3).join(', ')}` : ''}
          </p>
        </div>
        {a.isDemo ? <Badge ton="demo">{ETIQUETTE_DEMO}</Badge> : null}
      </div>

      <BarreSignal score={a.signalScore} />

      <p className="text-sm text-encre">{dureeLisible(a.joursDiffusion)}</p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Badge ton={a.annoncesActives > 0 ? 'actif' : 'arrete'}>
          {a.annoncesActives > 0 ? `${a.annoncesActives} en cours` : 'Plus rien en cours'}
        </Badge>
        <Badge ton="neutre">{a.annoncesTotal} archivées</Badge>
        {a.annoncesRetirees > 0 ? (
          // L'argument de vente : ces annonces n'existent plus chez Meta.
          <Badge ton="neo">{a.annoncesRetirees} supprimées par Meta</Badge>
        ) : null}
      </div>
    </Card>
  );
}
