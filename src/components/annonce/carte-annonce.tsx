import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { AnnonceFiche } from '@/server/annonceur-fiche';

const dateFr = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export function CarteAnnonce({ a }: { a: AnnonceFiche }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge ton={a.isActive ? 'actif' : 'arrete'}>
          {a.isActive ? 'En diffusion' : 'Arrêtée'}
        </Badge>
        {a.goneFromMeta ? <Badge ton="neo">Retirée par Meta</Badge> : null}
        <span className="tabular text-2xs text-encre-2">
          {dateFr(a.deliveryStartTime)}
          {a.deliveryStopTime ? ` → ${dateFr(a.deliveryStopTime)}` : ' → en cours'} · {a.jours} j
        </span>
      </div>

      {a.linkTitle ? <p className="text-sm font-semibold text-encre">{a.linkTitle}</p> : null}

      {/* Monospace : ce texte n'a pas été écrit par Nexteo, et ça doit se voir. */}
      {a.bodyText ? <p className="texte-annonce text-encre">{a.bodyText}</p> : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-2xs text-encre-2">
        {a.landingDomain ? <span>{a.landingDomain}</span> : null}
        {a.reachedCountries.length > 0 ? <span>{a.reachedCountries.join(', ')}</span> : null}
        {a.publisherPlatforms.length > 0 ? <span>{a.publisherPlatforms.join(', ')}</span> : null}
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
