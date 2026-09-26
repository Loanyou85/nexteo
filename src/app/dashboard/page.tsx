import Link from 'next/link';
import { Coque, EnTetePage, EtatVide, Jauge } from '@/components/shell/coque';
import { BasculerSuivi } from '@/components/bibliotheque/actions';
import { LogoAnnonceur } from '@/components/annonce/logo-annonceur';
import { BarreSignal } from '@/components/signal/barre';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { aLeDroit, DROITS, offrePour } from '@/lib/plans';
import { requireUser } from '@/server/auth';
import { collectionsDe, recherchesDe, suivisDe } from '@/server/bibliotheque';
import { proprietesCoque } from '@/server/coque';
import { db } from '@/server/db';
import { planActif } from '@/server/quota';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Annonceurs suivis — Nexteo' };

const dateFr = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const domaineDe = (url: string | null) =>
  url ? url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : null;

export default async function DashboardPage() {
  const user = await requireUser();

  const [coque, plan, suivis, biblio, recherches, abonnement] = await Promise.all([
    proprietesCoque(),
    planActif(user.id),
    suivisDe(user.id),
    collectionsDe(user.id),
    recherchesDe(user.id),
    db.subscription.findUnique({
      where: { userId: user.id },
      select: { plan: true, status: true, interval: true, currentPeriodEnd: true },
    }),
  ]);

  const droitSuivi = aLeDroit(plan, 'suiviAnnonceurs');
  const plafond = DROITS[plan].elementsEnregistres;
  const offre = offrePour(plan);

  // Les nouveautés d'abord : c'est la seule raison de revenir sur cet écran.
  const tries = [...suivis].sort((a, b) => b.nouvellesDepuis - a.nouvellesDepuis);
  const totalNouveautes = suivis.reduce((n, s) => n + s.nouvellesDepuis, 0);

  return (
    <Coque compteurs={coque.compteurs} admin={coque.admin} compte={coque.compte}>
      <EnTetePage
        titre="Annonceurs suivis"
        etiquette={offre ? offre.nom : 'Sans abonnement'}
        compteur={
          suivis.length === 0
            ? undefined
            : `${suivis.length} suivi${suivis.length > 1 ? 's' : ''} · ${totalNouveautes} nouvelle${totalNouveautes > 1 ? 's' : ''} annonce${totalNouveautes > 1 ? 's' : ''} depuis la mise sous surveillance`
        }
        sous="Une nouvelle annonce chez un annonceur suivi est le signal le plus précoce qu’on puisse observer : c’est le moment où il teste, avant même de savoir si ça marche."
        actions={
          <Button asChild taille="sm" variant="secondaire">
            <Link href="/collections">Collections</Link>
          </Button>
        }
      />

      <div className="px-5 pb-10 pt-5 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm text-encre-2">Offre</p>
            <p className="mt-1 text-lg font-semibold text-encre">
              {offre ? offre.nom : 'Aucune'}
            </p>
            <p className="mt-1 text-2xs text-encre-2">
              {abonnement?.currentPeriodEnd
                ? `Renouvellement le ${dateFr(abonnement.currentPeriodEnd)}`
                : 'Aucun abonnement actif'}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-encre-2">Annonceurs suivis</p>
            <p className="tabular mt-1 text-lg font-semibold text-encre">{suivis.length}</p>
            <p className="mt-1 text-2xs text-encre-2">
              {droitSuivi ? 'Sans limite' : 'Réservé à Pro Plus'}
            </p>
          </Card>

          {plafond === Infinity || plafond === 0 ? (
            <Card>
              <p className="text-sm text-encre-2">Éléments enregistrés</p>
              <p className="tabular mt-1 text-lg font-semibold text-encre">{biblio.total}</p>
              <p className="mt-1 text-2xs text-encre-2">
                {plafond === 0 ? 'Demande un abonnement' : 'Sans limite'}
              </p>
            </Card>
          ) : (
            <Jauge intitule="Éléments enregistrés" utilise={biblio.total} total={plafond} />
          )}

          <Card>
            <p className="text-sm text-encre-2">Recherches enregistrées</p>
            <p className="tabular mt-1 text-lg font-semibold text-encre">{recherches.length}</p>
            <p className="mt-1 text-2xs text-encre-2">
              {aLeDroit(plan, 'recherchesEnregistrees') ? 'Sans limite' : 'Réservé à Pro Plus'}
            </p>
          </Card>
        </div>

        <section className="mt-10">
          <h2 className="text-lg">Suivis</h2>

          {!droitSuivi ? (
            <div className="mt-4">
              <EtatVide
                titre="Le suivi d’annonceurs demande l’offre Pro Plus"
                explication="Suivre veut dire être averti quand une entreprise lance une annonce. Ça n’a de valeur que si l’archive garde tout l’historique, ce que Pro Plus ouvre."
                action={
                  <Button asChild taille="sm">
                    <Link href="/tarifs">Voir les offres</Link>
                  </Button>
                }
              />
            </div>
          ) : tries.length === 0 ? (
            <div className="mt-4">
              <EtatVide
                titre="Aucun annonceur suivi"
                explication="Depuis une fiche d’annonceur, le bouton Suivre le place ici. Le comptage des nouveautés démarre à ce moment-là, pas avant : afficher deux ans d’archive comme des nouveautés n’apprendrait rien."
                action={
                  <Button asChild taille="sm" variant="secondaire">
                    <Link href="/explore">Chercher un annonceur</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="mt-4">
              {tries.map((s) => (
                <li
                  key={s.advertiserId}
                  className="flex flex-wrap items-center gap-3 border-b border-bordure py-4 last:border-0"
                >
                  <LogoAnnonceur nom={s.nom} domaine={domaineDe(s.site)} taille={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/annonceur/${s.slug}`}
                        className="text-sm font-medium text-encre hover:underline"
                      >
                        {s.nom}
                      </Link>
                      {s.nouvellesDepuis > 0 ? (
                        <Badge ton="neo">
                          {s.nouvellesDepuis} nouvelle{s.nouvellesDepuis > 1 ? 's' : ''}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-2xs text-encre-2">
                      {s.categorie ?? 'Non classé'} · {s.annoncesActives} en diffusion · suivi
                      depuis le {dateFr(s.suiviDepuis)}
                      {s.derniereNouveaute ? ` · dernière nouveauté le ${dateFr(s.derniereNouveaute)}` : ''}
                    </p>
                  </div>
                  <div className="w-36 shrink-0">
                    <BarreSignal score={s.signalScore} taille="sm" sansLibelle />
                  </div>
                  <BasculerSuivi advertiserId={s.advertiserId} suivi />
                </li>
              ))}
            </ul>
          )}
        </section>

        {recherches.length > 0 ? (
          <section className="mt-10 border-t border-bordure pt-8">
            <h2 className="text-lg">Recherches enregistrées</h2>
            <ul className="mt-3">
              {recherches.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-4 border-b border-bordure py-3 last:border-0"
                >
                  <span className="text-sm text-encre">{r.name}</span>
                  <span className="text-2xs text-encre-2">créée le {dateFr(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Coque>
  );
}
