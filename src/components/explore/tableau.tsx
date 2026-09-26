import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { BarreSignal } from '@/components/signal/barre';
import { LogoAnnonceur } from '@/components/annonce/logo-annonceur';
import { MrrCompact } from '@/components/annonce/mrr';
import { ETIQUETTE_DEMO } from '@/lib/guardrails';
import type { LigneAnnonceur } from '@/server/annonceurs';

/**
 * Vue tableau : lignes de 44 px, chiffres tabulaires, survol à 150 ms.
 *
 * Elle existe à côté des cartes parce qu'on ne fait pas la même chose avec les
 * deux. Les cartes servent à découvrir, le tableau à comparer : vingt lignes
 * alignées sur la même colonne se lisent d'un coup d'œil, vingt cartes non.
 */
const domaineDe = (url: string | null) =>
  url ? url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : null;

export function TableauAnnonceurs({ lignes }: { lignes: LigneAnnonceur[] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-bordure bg-surface">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-bordure text-2xs uppercase tracking-wide text-encre-2">
            <th className="h-11 px-carte font-medium">Annonceur</th>
            <th className="h-11 px-carte font-medium">Catégorie</th>
            <th className="h-11 px-carte font-medium">Signal</th>
            <th className="h-11 px-carte text-right font-medium">Revenu mensuel</th>
            <th className="h-11 px-carte text-right font-medium">Diffusion</th>
            <th className="h-11 px-carte text-right font-medium">Actives</th>
            <th className="h-11 px-carte text-right font-medium">Archivées</th>
            <th className="h-11 px-carte text-right font-medium">Retirées</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((a) => (
            <tr key={a.id} className="ligne-tableau border-b border-bordure last:border-0">
              <td className="px-carte py-2">
                <div className="flex items-center gap-2.5">
                  <LogoAnnonceur nom={a.name} domaine={domaineDe(a.websiteUrl)} taille={28} />
                  <div className="min-w-0">
                    <Link
                      href={`/annonceur/${a.slug}`}
                      className="block truncate font-medium text-encre hover:underline"
                    >
                      {a.name}
                    </Link>
                    {a.isDemo ? <Badge ton="demo">{ETIQUETTE_DEMO}</Badge> : null}
                  </div>
                </div>
              </td>
              <td className="h-ligne px-carte text-encre-2">{a.categorie ?? 'Non classé'}</td>
              <td className="h-ligne w-40 px-carte">
                <BarreSignal score={a.signalScore} taille="sm" sansLibelle />
              </td>
              <td className="h-ligne px-carte">
                <MrrCompact m={a} />
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
