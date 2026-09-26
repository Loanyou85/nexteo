import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { LogoAnnonceur } from '@/components/annonce/logo-annonceur';
import { ETIQUETTE_DEMO } from '@/lib/guardrails';
import type { LigneAnnonce } from '@/server/annonces';

/**
 * Une annonce, vue depuis la liste générale.
 *
 * Elle porte son annonceur, contrairement à la carte de la fiche : ici on ne
 * sait pas d'où vient l'annonce, et une accroche sans l'entreprise qui la paie
 * n'apprend rien.
 *
 * La durée est mise en avant plutôt que la date de début. C'est la seule chose
 * observable qui distingue une annonce qui marche d'une qui a été coupée au
 * bout de trois jours.
 */

const dateFr = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const domaineDe = (url: string | null) =>
  url ? url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : null;

function duree(jours: number): string {
  if (jours < 60) return `${jours} jours`;
  const mois = Math.floor(jours / 30);
  return mois < 24 ? `${mois} mois` : `${Math.floor(mois / 12)} ans`;
}

export function CarteAnnonceListe({ a }: { a: LigneAnnonce }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <LogoAnnonceur nom={a.annonceurNom} domaine={domaineDe(a.annonceurSite)} taille={32} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/annonceur/${a.annonceurSlug}`}
            className="block truncate text-sm font-semibold text-encre hover:underline"
          >
            {a.annonceurNom}
          </Link>
          <p className="truncate text-2xs text-encre-2">
            {a.landingDomain ?? domaineDe(a.annonceurSite) ?? '—'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-sm font-semibold text-encre">{duree(a.jours)}</p>
          <p className="text-2xs text-encre-2">de diffusion</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge ton={a.isActive ? 'actif' : 'arrete'}>
          {a.isActive ? 'En diffusion' : 'Arrêtée'}
        </Badge>
        {a.goneFromMeta ? <Badge ton="neo">Retirée par Meta</Badge> : null}
        {a.isDemo ? <Badge ton="demo">{ETIQUETTE_DEMO}</Badge> : null}
      </div>

      {a.linkTitle ? <p className="text-sm font-medium text-encre">{a.linkTitle}</p> : null}

      {/* Monospace : ce texte n'a pas été écrit par Nexteo, et ça doit se voir. */}
      {a.bodyText ? (
        <p className="texte-annonce line-clamp-5 text-encre">{a.bodyText}</p>
      ) : (
        <p className="text-xs text-encre-2">Annonce sans texte : visuel seul.</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-2xs text-encre-2">
        <span className="tabular">
          {dateFr(a.deliveryStartTime)}
          {a.deliveryStopTime ? ` → ${dateFr(a.deliveryStopTime)}` : ' → en cours'}
        </span>
        {a.reachedCountries.length > 0 ? <span>{a.reachedCountries.slice(0, 4).join(', ')}</span> : null}
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <Link href={`/annonce/${a.id}`} className="text-neo-600 underline underline-offset-4">
          Détail
        </Link>
        {/* Garde-fou n° 3 : toute annonce affichée renvoie à son instantané officiel. */}
        <a
          href={a.snapshotUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-encre-2 underline underline-offset-4 hover:text-encre"
        >
          Instantané Meta
        </a>
      </div>
    </Card>
  );
}
