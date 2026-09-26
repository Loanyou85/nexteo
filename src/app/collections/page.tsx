import Link from 'next/link';
import { Coque, EnTetePage, EtatVide } from '@/components/shell/coque';
import { CreerCollection, RetirerElement, SupprimerCollection } from '@/components/bibliotheque/actions';
import { LogoAnnonceur } from '@/components/annonce/logo-annonceur';
import { MrrCompact } from '@/components/annonce/mrr';
import { Badge } from '@/components/ui/badge';
import { BarreSignal } from '@/components/signal/barre';
import { Button } from '@/components/ui/button';
import { DROITS } from '@/lib/plans';
import { requireUser } from '@/server/auth';
import { collectionsDe, type Element } from '@/server/bibliotheque';
import { proprietesCoque } from '@/server/coque';
import { planActif } from '@/server/quota';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Collections — Nexteo' };

const dateFr = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const domaineDe = (url: string | null) =>
  url ? url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : null;

function LigneElement({ e }: { e: Element }) {
  if (e.type === 'perdu') {
    return (
      <li className="flex items-start justify-between gap-4 border-b border-bordure py-3 last:border-0">
        <div>
          <p className="text-sm text-encre">
            {e.itemType === 'advertiser' ? 'Annonceur' : 'Annonce'} plus disponible
          </p>
          <p className="text-2xs text-encre-2">
            Enregistré le {dateFr(e.ajouteLe)}. La fiche a été retirée de l’archive — une page
            fusionnée avec une autre, ou exclue par la supervision.
          </p>
        </div>
        <RetirerElement savedItemId={e.savedItemId} />
      </li>
    );
  }

  if (e.type === 'advertiser') {
    return (
      <li className="flex flex-wrap items-center gap-3 border-b border-bordure py-3 last:border-0">
        <LogoAnnonceur nom={e.nom} domaine={domaineDe(e.site)} taille={32} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/annonceur/${e.slug}`}
            className="text-sm font-medium text-encre hover:underline"
          >
            {e.nom}
          </Link>
          <p className="truncate text-2xs text-encre-2">
            {e.categorie ?? 'Non classé'} · {e.annoncesActives} en diffusion · enregistré le{' '}
            {dateFr(e.ajouteLe)}
          </p>
          {e.note ? <p className="mt-1 text-xs text-encre">{e.note}</p> : null}
        </div>
        <div className="w-32 shrink-0">
          <BarreSignal score={e.signalScore} taille="sm" sansLibelle />
        </div>
        <div className="shrink-0">
          <MrrCompact m={e} />
        </div>
        <RetirerElement savedItemId={e.savedItemId} />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-start gap-3 border-b border-bordure py-3 last:border-0">
      <LogoAnnonceur nom={e.annonceurNom} domaine={domaineDe(e.annonceurSite)} taille={32} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/annonce/${e.itemId}`}
            className="text-sm font-medium text-encre hover:underline"
          >
            {e.linkTitle ?? 'Annonce sans titre'}
          </Link>
          <Badge ton={e.isActive ? 'actif' : 'arrete'}>
            {e.isActive ? 'En diffusion' : 'Arrêtée'}
          </Badge>
          {e.goneFromMeta ? <Badge ton="neo">Retirée par Meta</Badge> : null}
        </div>
        <p className="text-2xs text-encre-2">
          {e.annonceurSlug ? (
            <Link href={`/annonceur/${e.annonceurSlug}`} className="hover:underline">
              {e.annonceurNom}
            </Link>
          ) : (
            e.annonceurNom
          )}{' '}
          · enregistré le {dateFr(e.ajouteLe)}
        </p>
        {e.bodyText ? (
          <p className="texte-annonce mt-1.5 line-clamp-2 text-encre">{e.bodyText}</p>
        ) : null}
        {e.note ? <p className="mt-1 text-xs text-encre">{e.note}</p> : null}
      </div>
      <RetirerElement savedItemId={e.savedItemId} />
    </li>
  );
}

export default async function CollectionsPage() {
  const user = await requireUser();

  const [coque, biblio, plan] = await Promise.all([
    proprietesCoque(),
    collectionsDe(user.id),
    planActif(user.id),
  ]);

  const plafond = DROITS[plan].elementsEnregistres;
  const abonne = plafond !== 0;

  return (
    <Coque compteurs={coque.compteurs} admin={coque.admin} compte={coque.compte}>
      <EnTetePage
        titre="Collections"
        compteur={
          abonne
            ? plafond === Infinity
              ? `${biblio.total} élément${biblio.total > 1 ? 's' : ''} enregistré${biblio.total > 1 ? 's' : ''}, sans limite`
              : `${biblio.total} sur ${plafond} éléments enregistrés`
            : undefined
        }
        sous="Rien n’est recopié ici : chaque élément renvoie à sa fiche, relue à l’affichage. Une annonce qui s’arrête ou que Meta efface le montre tout de suite, au lieu de rester figée dans un souvenir."
      />

      <div className="px-5 pb-10 pt-5 lg:px-8">
        {!abonne ? (
          <EtatVide
            titre="Les collections demandent un abonnement"
            explication="Il n’y a pas d’offre gratuite. Mettre de côté ce qu’on trouve fait partie de l’outil, pas de la vitrine."
            action={
              <Button asChild taille="sm">
                <Link href="/tarifs">Voir les offres</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="rounded-card border border-bordure bg-fond p-4">
              <p className="text-sm font-medium text-encre">Nouvelle collection</p>
              <p className="mb-3 mt-0.5 text-xs text-encre-2">
                Un classeur par question posée : « concurrents directs », « accroches à tester ».
              </p>
              <CreerCollection />
            </div>

            {biblio.collections.length === 0 ? (
              <div className="mt-6">
                <EtatVide
                  titre="Rien d’enregistré pour l’instant"
                  explication="Depuis une fiche d’annonceur ou une annonce, le bouton d’enregistrement range l’élément ici."
                  action={
                    <Button asChild taille="sm" variant="secondaire">
                      <Link href="/explore">Chercher un annonceur</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="mt-8 space-y-10">
                {biblio.collections.map((c) => (
                  <section key={c.id ?? 'libres'}>
                    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-bordure pb-2">
                      <div>
                        <h2 className="text-lg">{c.nom}</h2>
                        <p className="text-2xs text-encre-2">
                          {c.elements.length} élément{c.elements.length > 1 ? 's' : ''}
                          {c.creeeLe ? ` · créée le ${dateFr(c.creeeLe)}` : ''}
                        </p>
                      </div>
                      {c.id ? <SupprimerCollection collectionId={c.id} nom={c.nom} /> : null}
                    </div>
                    {c.elements.length === 0 ? (
                      <p className="py-4 text-sm text-encre-2">
                        Collection vide. Elle reste là : un classeur créé à l’avance sert à ranger
                        au moment où on trouve, pas après.
                      </p>
                    ) : (
                      <ul>
                        {c.elements.map((e) => (
                          <LigneElement key={e.savedItemId} e={e} />
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Coque>
  );
}
