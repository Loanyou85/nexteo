import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { BarreSignal } from '@/components/signal/barre';
import { ETIQUETTE_DEMO } from '@/lib/guardrails';
import type { LigneAnnonceur } from '@/server/annonceurs';

/** Vue tableau : lignes de 44 px, chiffres tabulaires, survol à 150 ms. */
export function TableauAnnonceurs({ lignes }: { lignes: LigneAnnonceur[] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-bordure bg-surface">
      <table className="w-full min-w-[820px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-bordure text-2xs uppercase tracking-wide text-encre-2">
            <th className="h-11 px-carte font-medium">Annonceur</th>
            <th className="h-11 px-carte font-medium">Catégorie</th>
            <th className="h-11 px-carte font-medium">Signal</th>
            <th className="h-11 px-carte text-right font-medium">Diffusion</th>
            <th className="h-11 px-carte text-right font-medium">Actives</th>
            <th className="h-11 px-carte text-right font-medium">Archivées</th>
            <th className="h-11 px-carte text-right font-medium">Retirées</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((a) => (
            <tr key={a.id} className="ligne-tableau border-b border-bordure last:border-0">
              <td className="h-ligne px-carte">
                <Link href={`/annonceur/${a.slug}`} className="font-medium text-encre hover:underline">
                  {a.name}
                </Link>
                {a.isDemo ? (
                  <Badge ton="demo" className="ml-2">
                    {ETIQUETTE_DEMO}
                  </Badge>
                ) : null}
              </td>
              <td className="h-ligne px-carte text-encre-2">{a.categorie ?? 'Non classé'}</td>
              <td className="h-ligne w-40 px-carte">
                <BarreSignal score={a.signalScore} taille="sm" sansLibelle />
              </td>
              <td className="h-ligne px-carte text-right text-encre">
                {a.joursDiffusion > 0 ? `${Math.floor(a.joursDiffusion / 30)} mois` : '—'}
              </td>
              <td className="h-ligne px-carte text-right text-encre">{a.annoncesActives}</td>
              <td className="h-ligne px-carte text-right text-encre-2">{a.annoncesTotal}</td>
              <td className="h-ligne px-carte text-right">
                {a.annoncesRetirees > 0 ? (
                  <span className="text-neo-600">{a.annoncesRetirees}</span>
                ) : (
                  <span className="text-encre-2">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
