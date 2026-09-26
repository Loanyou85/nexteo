import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BarreSignal } from '@/components/signal/barre';
import { MrrCompact } from '@/components/annonce/mrr';
import { LogoAnnonceur } from '@/components/annonce/logo-annonceur';
import { ETIQUETTE_DEMO } from '@/lib/guardrails';
import type { LigneAnnonceur } from '@/server/annonceurs';

/**
 * Carte d'annonceur.
 *
 * Le bas de carte porte l'activité de diffusion mois par mois. C'est la place
 * qu'un concurrent remplit avec une courbe de recettes estimées ; ici c'est le
 * nombre d'annonces qui tournaient simultanément, mois après mois — un fait
 * observé, et c'est tout l'écart entre les deux produits.
 */

function duree(jours: number): string {
  if (jours <= 0) return '—';
  if (jours < 60) return `${jours} j`;
  return `${Math.floor(jours / 30)} mois`;
}

/** Domaine nu extrait de l'URL enregistrée. */
function domaineDe(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function Courbe({ valeurs }: { valeurs: number[] }) {
  const max = Math.max(1, ...valeurs);
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {valeurs.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-[2px] bg-neo-500/70"
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function CarteAnnonceur({ a }: { a: LigneAnnonceur }) {
  const activite = a.activiteMensuelle.length > 0 ? a.activiteMensuelle : Array(12).fill(0);

  return (
    <article className="flex flex-col rounded-card border border-bordure bg-surface transition-colors hover:border-neo-500/40">
      <div className="flex items-start gap-3 p-4">
        <LogoAnnonceur nom={a.name} domaine={domaineDe(a.websiteUrl)} taille={36} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/annonceur/${a.slug}`}
              className="truncate text-sm font-semibold text-encre hover:underline"
            >
              {a.name}
            </Link>
            {a.websiteUrl ? (
              <a
                href={a.websiteUrl}
                target="_blank"
                rel="noreferrer noopener nofollow"
                aria-label={`Ouvrir le site de ${a.name}`}
                className="text-encre-2 hover:text-encre"
              >
                <ExternalLink size={13} strokeWidth={1.75} />
              </a>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-2xs text-encre-2">
            {a.categorie ?? 'Non classé'}
            {a.pays.length > 0 ? ` · ${a.pays.slice(0, 2).join(', ')}` : ''}
            {a.pays.length > 2 ? ` +${a.pays.length - 2}` : ''}
          </p>
        </div>

        <div className="shrink-0">
          <MrrCompact m={a} />
        </div>
      </div>

      {a.accroche ? (
        <p className="texte-annonce line-clamp-2 min-h-[2.6rem] px-4 text-encre-2">{a.accroche}</p>
      ) : (
        <p className="min-h-[2.6rem] px-4 text-xs text-encre-2">Aucune annonce en diffusion.</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
        <Badge ton="neo">{a.libelleBande}</Badge>
        <Badge ton={a.annoncesActives > 0 ? 'actif' : 'arrete'}>
          {a.annoncesActives > 0 ? `${a.annoncesActives} en cours` : 'Arrêté'}
        </Badge>
        {a.annoncesRetirees > 0 ? (
          <Badge ton="neutre">{a.annoncesRetirees} retirées</Badge>
        ) : null}
        {a.isDemo ? <Badge ton="demo">{ETIQUETTE_DEMO}</Badge> : null}
      </div>

      <div className="px-4 pt-3">
        <BarreSignal score={a.signalScore} taille="sm" sansLibelle />
      </div>

      <div className="mt-auto grid grid-cols-3 gap-3 border-t border-bordure p-4 pt-3">
        <div>
          <p className="text-2xs uppercase tracking-wide text-encre-2">Diffusion</p>
          <p className="tabular mt-1 text-base font-semibold text-encre">{duree(a.joursDiffusion)}</p>
        </div>
        <div>
          <p className="text-2xs uppercase tracking-wide text-encre-2">Archivées</p>
          <p className="tabular mt-1 text-base font-semibold text-encre">{a.annoncesTotal}</p>
        </div>
        <div className="min-w-0">
          <p className="text-2xs uppercase tracking-wide text-encre-2">12 mois</p>
          <div className="mt-1">
            <Courbe valeurs={activite} />
          </div>
        </div>
      </div>
    </article>
  );
}
