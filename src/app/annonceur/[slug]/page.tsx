import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Coque } from '@/components/shell/coque';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BarreSignal, DetailSignal } from '@/components/signal/barre';
import { Chronologie } from '@/components/annonce/chronologie';
import { CarteAnnonce } from '@/components/annonce/carte-annonce';
import { AbonnementRequis } from '@/components/annonce/mur-payant';
import { MrrDetaille } from '@/components/annonce/mrr';
import { LogoAnnonceur } from '@/components/annonce/logo-annonceur';
import { ETIQUETTE_DEMO, MENTION_SOURCE } from '@/lib/guardrails';
import { ficheAnnonceur } from '@/server/annonceur-fiche';
import { consulterFiche } from '@/server/quota';
import { proprietesCoque } from '@/server/coque';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const a = await ficheAnnonceur(slug);
  if (!a) return { title: 'Annonceur introuvable — Nexteo' };

  const mois = Math.floor((a.detail.find((d) => d.cle === 'persistance')?.valeur ?? 0) / 30);
  return {
    title: `${a.name} — annonces et diffusion — Nexteo`,
    description:
      mois > 0
        ? `${a.name} diffuse depuis ${mois} mois. ${a.actives.length + a.archivees.length + a.retirees.length} annonces archivées par Nexteo.`
        : `Annonces de ${a.name} archivées par Nexteo.`,
  };
}

const dateFr = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function Section({
  titre,
  aide,
  children,
}: {
  titre: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-bordure pt-8">
      <h2 className="text-lg">{titre}</h2>
      {aide ? <p className="mt-1 max-w-2xl text-sm text-encre-2">{aide}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function AnnonceurPage({ params }: Props) {
  const { slug } = await params;
  const a = await ficheAnnonceur(slug);
  if (!a) notFound();

  const [acces, coque] = await Promise.all([consulterFiche(a.id), proprietesCoque()]);

  const total = a.actives.length + a.archivees.length + a.retirees.length;
  const mois = Math.floor((a.detail.find((d) => d.cle === 'persistance')?.valeur ?? 0) / 30);
  // Réservé : on n'affiche pas le contenu du tout. Le flouter le laisserait
  // dans la page — lisible dans le code source, et donc pas vraiment réservé.
  const reserve = !acces.autorise;

  return (
    <Coque compteurs={coque.compteurs} admin={coque.admin} compte={coque.compte}>
      <div className="px-5 pb-10 pt-6 lg:px-8 lg:pt-8">
        <nav className="text-sm text-encre-2">
          <Link href="/explore" className="underline underline-offset-4 hover:text-encre">
            Recherche
          </Link>
          {a.categorieSlug ? (
            <>
              {' / '}
              <Link
                href={`/explore?categorie=${a.categorieSlug}`}
                className="underline underline-offset-4 hover:text-encre"
              >
                {a.categorie}
              </Link>
            </>
          ) : null}
        </nav>

        <header className="mt-4 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <LogoAnnonceur
                nom={a.name}
                domaine={a.websiteUrl ? a.websiteUrl.replace(/^https?:\/\/(www\.)?/, '') : null}
                taille={44}
              />
              <h1 className="text-xl">{a.name}</h1>
              {a.isDemo ? <Badge ton="demo">{ETIQUETTE_DEMO}</Badge> : null}
            </div>

            <p className="mt-2 text-sm text-encre-2">
              {a.categorie ?? 'Non classé'}
              {a.countryCode ? ` · ${a.countryCode}` : ''} · Première apparition dans l’archive le{' '}
              {dateFr(a.firstSeenAt)}
            </p>

            {a.websiteUrl ? (
              <p className="mt-1 text-sm">
                <a
                  href={a.websiteUrl}
                  target="_blank"
                  rel="noreferrer noopener nofollow"
                  className="text-neo-600 underline underline-offset-4"
                >
                  {a.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge ton={a.actives.length > 0 ? 'actif' : 'arrete'}>
                {a.actives.length > 0 ? `${a.actives.length} en diffusion` : 'Plus rien en diffusion'}
              </Badge>
              <Badge ton="neutre">{total} annonces archivées</Badge>
              {a.retirees.length > 0 ? (
                <Badge ton="neo">{a.retirees.length} supprimées par Meta</Badge>
              ) : null}
            </div>
          </div>

          <Card className="w-full shrink-0 md:w-72">
            <BarreSignal score={a.signalScore} taille="lg" />
            <p className="mt-3 text-2xs text-encre-2">
              Activité publicitaire observée. Ce score ne décrit pas la santé financière d’une
              entreprise.
            </p>
          </Card>
        </header>

        {reserve ? (
          <div className="mt-8">
            <AbonnementRequis
              nom={a.name}
              mois={mois}
              annonces={total}
              retirees={a.retirees.length}
              connecte={acces.connecte}
            />
          </div>
        ) : null}

        <div className="mt-10 space-y-10">
          {reserve ? null : (
          <>
          <Section
            titre="Détail du signal"
            aide="Chaque composante, sa mesure et ce qu’elle apporte au score. Rien n’est recalculé à l’affichage : ce que tu lis est ce qui a produit le chiffre."
          >
            {a.detail.length > 0 ? (
              <DetailSignal detail={a.detail} />
            ) : (
              <p className="text-sm text-encre-2">
                Le signal n’a pas encore été calculé pour cet annonceur.
              </p>
            )}
            {a.signalComputedAt ? (
              <p className="mt-3 text-2xs text-encre-2">
                Calculé le {dateFr(a.signalComputedAt)}.
              </p>
            ) : null}
          </Section>

          <Section
            titre="Revenu mensuel récurrent"
            aide="Un montant déclaré est un fait, publié par l’entreprise elle-même. Une estimation est une fourchette, obtenue par une chaîne d’hypothèses à partir de la portée que Meta expose. Les deux ne se lisent pas de la même façon, et ne sont jamais mélangés."
          >
            <MrrDetaille m={a.mrr} nom={a.name} />
          </Section>

          <Section
            titre="Chronologie de diffusion"
            aide="Une bande par annonce. Ce qu’on vient y chercher, ce sont les trous : une entreprise qui coupe puis reprend n’a pas le même comportement que celle qui n’a jamais arrêté."
          >
            <Chronologie
              bandes={a.chronologie.bandes}
              debut={a.chronologie.debut}
              fin={a.chronologie.fin}
            />
          </Section>

          {a.actives.length > 0 ? (
            <Section titre={`Annonces en diffusion (${a.actives.length})`}>
              <div className="grid gap-3 md:grid-cols-2">
                {a.actives.map((x) => (
                  <CarteAnnonce key={x.id} a={x} />
                ))}
              </div>
            </Section>
          ) : null}

          {a.retirees.length > 0 ? (
            <Section
              titre={`Supprimées par Meta, conservées ici (${a.retirees.length})`}
              aide="Meta retire une annonce commerciale environ douze mois après sa dernière impression. Celles-ci ne sont plus trouvables dans sa bibliothèque."
            >
              <div className="grid gap-3 md:grid-cols-2">
                {a.retirees.map((x) => (
                  <CarteAnnonce key={x.id} a={x} />
                ))}
              </div>
            </Section>
          ) : null}

          {a.archivees.length > 0 ? (
            <Section titre={`Annonces arrêtées (${a.archivees.length})`}>
              <div className="grid gap-3 md:grid-cols-2">
                {a.archivees.map((x) => (
                  <CarteAnnonce key={x.id} a={x} />
                ))}
              </div>
            </Section>
          ) : null}

          {a.accroches.length > 0 ? (
            <Section
              titre="Accroches"
              aide="Les premières lignes de toutes les annonces, regroupées : la stratégie éditoriale se lit d’un coup d’œil."
            >
              <ul className="divide-y divide-bordure">
                {a.accroches.map((h) => (
                  <li key={h.texte} className="flex items-start gap-4 py-3">
                    <p className="texte-annonce min-w-0 flex-1 text-encre">{h.texte}</p>
                    <span className="tabular shrink-0 text-2xs text-encre-2">
                      {h.occurrences}×
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {a.destinations.length > 0 ? (
            <Section titre="Pages de destination">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-bordure text-2xs uppercase tracking-wide text-encre-2">
                    <th className="h-11 font-medium">Domaine</th>
                    <th className="h-11 text-right font-medium">Annonces</th>
                    <th className="h-11 text-right font-medium">Depuis</th>
                  </tr>
                </thead>
                <tbody>
                  {a.destinations.map((d) => (
                    <tr key={d.domaine} className="ligne-tableau border-b border-bordure last:border-0">
                      <td className="h-ligne text-encre">{d.domaine}</td>
                      <td className="h-ligne text-right text-encre">{d.annonces}</td>
                      <td className="h-ligne text-right text-encre-2">{dateFr(d.premiereVue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          <Section titre="Plateformes et pays">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-encre">Pays touchés</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {a.pays.map((p) => (
                    <li key={p.code}>
                      <Badge ton="neutre">
                        {p.code} · {p.annonces}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-encre">Plateformes</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {a.plateformes.map((p) => (
                    <li key={p.code}>
                      <Badge ton="neutre">
                        {p.code} · {p.annonces}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          {a.proches.length > 0 ? (
            <Section
              titre="Annonceurs proches"
              aide="Calculés par similarité de catégorie, de vocabulaire d’accroche et de domaine de destination. Aucun rapprochement n’est saisi à la main."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {a.proches.map((p) => (
                  <Card key={p.slug}>
                    <Link href={`/annonceur/${p.slug}`} className="font-medium text-encre hover:underline">
                      {p.name}
                    </Link>
                    <div className="mt-2">
                      <BarreSignal score={p.signalScore} taille="sm" sansLibelle />
                    </div>
                    {p.raisons.length > 0 ? (
                      <p className="mt-2 text-2xs text-encre-2">{p.raisons.join(' · ')}</p>
                    ) : null}
                  </Card>
                ))}
              </div>
            </Section>
          ) : null}
          </>
          )}
        </div>

        <p className="mt-12 border-t border-bordure pt-6 text-2xs text-encre-2">{MENTION_SOURCE}</p>
      </div>
    </Coque>
  );
}
