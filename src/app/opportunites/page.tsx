import Link from 'next/link';
import { Coque, EnTetePage, EtatVide } from '@/components/shell/coque';
import { BaseAbsente } from '@/components/shell/base-absente';
import { LogoAnnonceur } from '@/components/annonce/logo-annonceur';
import { BarreSignal } from '@/components/signal/barre';
import { Card } from '@/components/ui/card';
import { MENTION_SOURCE } from '@/lib/guardrails';
import {
  accrochesMontantes,
  categoriesEnMouvement,
  nouveauxEntrants,
  sortiesRecentes,
} from '@/server/opportunites';
import { proprietesCoque } from '@/server/coque';
import { etatBase } from '@/server/etat';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Signaux de marché — Nexteo',
  description:
    'Ce qui bouge : catégories qui se remplissent, annonceurs qui arrivent, annonceurs qui coupent.',
};

const dateFr = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const domaineDe = (url: string | null) =>
  url ? url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : null;

function duree(jours: number): string {
  if (jours < 60) return `${jours} j`;
  const mois = Math.floor(jours / 30);
  return mois < 24 ? `${mois} mois` : `${Math.floor(mois / 12)} ans`;
}

function Section({
  titre,
  aide,
  children,
}: {
  titre: string;
  aide: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-bordure pt-8 first:mt-0 first:border-0 first:pt-0">
      <h2 className="text-lg">{titre}</h2>
      <p className="mt-1 max-w-2xl text-sm text-encre-2">{aide}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function OpportunitesPage() {
  const etat = await etatBase();

  if (!etat.pret) {
    return (
      <Coque>
        <BaseAbsente etat={etat} />
      </Coque>
    );
  }

  const [coque, categories, entrants, sorties, accroches] = await Promise.all([
    proprietesCoque(),
    categoriesEnMouvement(),
    nouveauxEntrants(),
    sortiesRecentes(),
    accrochesMontantes(),
  ]);

  return (
    <Coque compteurs={coque.compteurs} admin={coque.admin} compte={coque.compte}>
      <EnTetePage
        titre="Signaux de marché"
        sous="Cette page ne classe personne : elle montre le mouvement des quatre-vingt-dix derniers jours. C’est le seul écran dont la valeur augmente toute seule avec l’âge de l’archive, et c’est pour ça que le pipeline tourne dès le premier jour, même sans un seul utilisateur."
      />

      <div className="px-5 pb-10 pt-5 lg:px-8">
        <Section
          titre="Catégories"
          aide="Combien d’annonceurs paient en ce moment, combien sont arrivés, combien ont coupé. Une catégorie qui se remplit et une catégorie où tout le monde tient depuis deux ans ne se jouent pas de la même façon."
        >
          {categories.length === 0 ? (
            <EtatVide
              titre="Aucune catégorie renseignée"
              explication="Le classement des annonceurs par catégorie se fait à l’ingestion. Tant qu’aucun annonceur n’est classé, il n’y a rien à comparer."
            />
          ) : (
            <div className="overflow-x-auto rounded-card border border-bordure bg-surface">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-bordure text-2xs uppercase tracking-wide text-encre-2">
                    <th className="h-11 px-carte font-medium">Catégorie</th>
                    <th className="h-11 px-carte text-right font-medium">Paient en ce moment</th>
                    <th className="h-11 px-carte text-right font-medium">Arrivés (90 j)</th>
                    <th className="h-11 px-carte text-right font-medium">Coupés (90 j)</th>
                    <th className="h-11 px-carte text-right font-medium">Ancienneté médiane</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.slug} className="ligne-tableau border-b border-bordure last:border-0">
                      <td className="h-ligne px-carte">
                        <Link
                          href={`/explore?categorie=${c.slug}`}
                          className="font-medium text-encre hover:underline"
                        >
                          {c.label}
                        </Link>
                      </td>
                      <td className="tabular h-ligne px-carte text-right text-encre">
                        {c.annonceursActifs}
                      </td>
                      <td className="tabular h-ligne px-carte text-right">
                        {c.entrants > 0 ? (
                          <span className="text-neo-600">+{c.entrants}</span>
                        ) : (
                          <span className="text-encre-2">—</span>
                        )}
                      </td>
                      <td className="tabular h-ligne px-carte text-right">
                        {c.sortants > 0 ? (
                          <span className="text-encre">−{c.sortants}</span>
                        ) : (
                          <span className="text-encre-2">—</span>
                        )}
                      </td>
                      <td className="tabular h-ligne px-carte text-right text-encre-2">
                        {duree(c.medianeJours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          titre="Arrivés récemment, et toujours en diffusion"
          aide="Première apparition dans l’archive il y a moins de quatre-vingt-dix jours, avec au moins une annonce encore en cours. Une page vue une fois puis disparue n’est pas une entrée sur le marché : c’est un test annulé, et elle n’est pas ici."
        >
          {entrants.length === 0 ? (
            <EtatVide
              titre="Aucune arrivée sur la période"
              explication="Personne de nouveau n’a commencé à diffuser dans les quatre-vingt-dix derniers jours, ou l’archive est trop jeune pour que « nouveau » veuille dire quelque chose."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {entrants.map((e) => (
                <Card key={e.slug} className="flex flex-col gap-3">
                  <div className="flex items-start gap-2.5">
                    <LogoAnnonceur nom={e.nom} domaine={domaineDe(e.site)} taille={32} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/annonceur/${e.slug}`}
                        className="block truncate text-sm font-semibold text-encre hover:underline"
                      >
                        {e.nom}
                      </Link>
                      <p className="truncate text-2xs text-encre-2">{e.categorie ?? 'Non classé'}</p>
                    </div>
                  </div>
                  <BarreSignal score={e.signalScore} taille="sm" sansLibelle />
                  <p className="mt-auto text-2xs text-encre-2">
                    Vu depuis le {dateFr(e.premiereVue)} · {e.annoncesActives} en diffusion ·{' '}
                    {duree(e.joursDiffusion)} sans interruption
                  </p>
                </Card>
              ))}
            </div>
          )}
        </Section>

        <Section
          titre="Ont tout coupé récemment"
          aide="Plus rien en diffusion, et la dernière annonce s’est arrêtée il y a moins de quatre-vingt-dix jours. Ce n’est pas un échec à constater : une entreprise qui a payé huit mois puis coupe net a appris quelque chose, et la colonne « tenu » dit combien de temps elle y a cru."
        >
          {sorties.length === 0 ? (
            <EtatVide
              titre="Personne n’a coupé sur la période"
              explication="Tous les annonceurs de l’archive qui avaient des annonces en ont encore, ou leur arrêt est plus ancien que quatre-vingt-dix jours."
            />
          ) : (
            <ul>
              {sorties.map((s) => (
                <li
                  key={s.slug}
                  className="flex flex-wrap items-center gap-3 border-b border-bordure py-3 last:border-0"
                >
                  <LogoAnnonceur nom={s.nom} domaine={domaineDe(s.site)} taille={30} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/annonceur/${s.slug}`}
                      className="text-sm font-medium text-encre hover:underline"
                    >
                      {s.nom}
                    </Link>
                    <p className="truncate text-2xs text-encre-2">
                      {s.categorie ?? 'Non classé'} · {s.annoncesTotal} annonces archivées
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm text-encre">{duree(s.joursTenus)}</p>
                    <p className="text-2xs text-encre-2">tenu</p>
                  </div>
                  <div className="w-28 shrink-0 text-right">
                    <p className="tabular text-sm text-encre-2">{dateFr(s.arretLe)}</p>
                    <p className="text-2xs text-encre-2">arrêt</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          titre="Accroches reprises par plusieurs annonceurs"
          aide="Le même texte trouvé chez des annonceurs différents pèse plus lourd que le même texte répété par un seul. Nexteo n’écrit rien ici : ce sont leurs phrases, affichées telles quelles."
        >
          {accroches.length === 0 ? (
            <EtatVide
              titre="Aucune accroche partagée"
              explication="Aucun texte d’annonce n’apparaît plus d’une fois dans les six derniers mois. C’est normal sur une archive jeune."
            />
          ) : (
            <ul className="divide-y divide-bordure">
              {accroches.map((a) => (
                <li key={a.texte} className="flex items-start gap-4 py-3">
                  {/* Monospace : ce texte n'a pas été écrit par Nexteo. */}
                  <p className="texte-annonce min-w-0 flex-1 text-encre">{a.texte}</p>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm text-encre">
                      {a.annonceurs} annonceur{a.annonceurs > 1 ? 's' : ''}
                    </p>
                    <p className="tabular text-2xs text-encre-2">
                      {a.occurrences} annonces · depuis le {dateFr(a.premiereVue)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="mt-10 border-t border-bordure pt-5 text-2xs text-encre-2">{MENTION_SOURCE}</p>
      </div>
    </Coque>
  );
}
