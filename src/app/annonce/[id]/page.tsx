import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Coque } from '@/components/shell/coque';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ETIQUETTE_DEMO, MENTION_SOURCE } from '@/lib/guardrails';
import { ficheAnnonce } from '@/server/annonceur-fiche';
import { proprietesCoque } from '@/server/coque';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const a = await ficheAnnonce(id);
  return {
    title: a ? `Annonce de ${a.advertiser.name} — Nexteo` : 'Annonce introuvable — Nexteo',
  };
}

const dateFr = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function Ligne({ intitule, children }: { intitule: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-bordure py-2.5 last:border-0">
      <dt className="text-sm text-encre-2">{intitule}</dt>
      <dd className="text-right text-sm text-encre">{children}</dd>
    </div>
  );
}

export default async function AnnoncePage({ params }: Props) {
  const { id } = await params;
  const a = await ficheAnnonce(id);
  if (!a) notFound();

  const coque = await proprietesCoque();
  const visuel = a.creatives[0];

  return (
    <Coque compteurs={coque.compteurs} admin={coque.admin} compte={coque.compte}>
      <div className="mx-auto max-w-3xl px-5 pb-10 pt-6 lg:px-8 lg:pt-8">
        <nav className="text-sm text-encre-2">
          <Link href="/explore" className="underline underline-offset-4 hover:text-encre">
            Recherche
          </Link>
          {' / '}
          <Link
            href={`/annonceur/${a.advertiser.slug}`}
            className="underline underline-offset-4 hover:text-encre"
          >
            {a.advertiser.name}
          </Link>
        </nav>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge ton={a.isActive ? 'actif' : 'arrete'}>
            {a.isActive ? 'En diffusion' : 'Arrêtée'}
          </Badge>
          {a.goneFromMeta ? <Badge ton="neo">Retirée de l’archive Meta</Badge> : null}
          {a.isDemo ? <Badge ton="demo">{ETIQUETTE_DEMO}</Badge> : null}
        </div>

        <h1 className="mt-3 text-xl">{a.linkTitle ?? 'Annonce'}</h1>

        {visuel?.storageKey ? (
          <Card className="mt-6 overflow-hidden p-0">
            {/* Visuel copié à l'ingestion : les URL de Meta expirent. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.S3_PUBLIC_BASE_URL ?? ''}/${visuel.storageKey}`}
              alt=""
              width={visuel.width ?? undefined}
              height={visuel.height ?? undefined}
              className="w-full"
            />
          </Card>
        ) : null}

        {a.bodyText ? (
          <Card className="mt-6">
            <p className="texte-annonce whitespace-pre-line text-encre">{a.bodyText}</p>
          </Card>
        ) : null}

        <dl className="mt-8">
          <Ligne intitule="Annonceur">
            <Link href={`/annonceur/${a.advertiser.slug}`} className="text-neo-600 underline underline-offset-4">
              {a.advertiser.name}
            </Link>
          </Ligne>
          {a.linkDescription ? <Ligne intitule="Description">{a.linkDescription}</Ligne> : null}
          {a.linkCaption ? <Ligne intitule="Légende">{a.linkCaption}</Ligne> : null}
          {a.landingDomain ? <Ligne intitule="Destination">{a.landingDomain}</Ligne> : null}
          <Ligne intitule="Début de diffusion">{dateFr(a.deliveryStartTime)}</Ligne>
          <Ligne intitule="Fin de diffusion">
            {a.deliveryStopTime ? dateFr(a.deliveryStopTime) : 'En cours'}
          </Ligne>
          <Ligne intitule="Durée">
            <span className="tabular">{a.jours} jours</span>
          </Ligne>
          <Ligne intitule="Plateformes">{a.publisherPlatforms.join(', ') || '—'}</Ligne>
          <Ligne intitule="Pays">{a.reachedCountries.join(', ') || '—'}</Ligne>
          <Ligne intitule="Langues">{a.languages.join(', ') || '—'}</Ligne>
          <Ligne intitule="Vue par Nexteo depuis">{dateFr(a.firstSeenAt)}</Ligne>
        </dl>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          {/* Garde-fou n° 3 : le contenu publicitaire n'est jamais republié hors
              de son contexte d'origine. L'instantané officiel fait foi. */}
          <Button asChild taille="md">
            <a href={a.snapshotUrl} target="_blank" rel="noreferrer noopener">
              Voir l’instantané officiel chez Meta
            </a>
          </Button>
          <Button asChild taille="md" variant="secondaire">
            <Link href={`/annonceur/${a.advertiser.slug}`}>Toutes ses annonces</Link>
          </Button>
        </div>

        <p className="mt-10 border-t border-bordure pt-6 text-2xs text-encre-2">{MENTION_SOURCE}</p>
      </div>
    </Coque>
  );
}
