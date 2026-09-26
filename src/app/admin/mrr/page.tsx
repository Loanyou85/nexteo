import Link from 'next/link';
import { Coque, EnTetePage, EtatVide } from '@/components/shell/coque';
import { FormulaireMrr } from '@/components/admin/formulaire-mrr';
import { LogoAnnonceur } from '@/components/annonce/logo-annonceur';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formaterMontant } from '@/lib/mrr/estimer';
import { requireAdmin } from '@/server/auth';
import { proprietesCoque } from '@/server/coque';
import { listeSaisieMrr, resteASaisir, type LigneSaisie } from '@/server/mrr-saisie';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'MRR déclarés — Nexteo' };

const dateCourte = (d: Date) =>
  d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });

const domaineDe = (url: string | null) =>
  url ? url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : null;

function Ligne({ a }: { a: LigneSaisie }) {
  return (
    <li className="border-b border-bordure py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-3">
        <LogoAnnonceur nom={a.name} domaine={domaineDe(a.websiteUrl)} taille={32} />
        <div className="min-w-0">
          <Link
            href={`/annonceur/${a.slug}`}
            className="text-sm font-medium text-encre hover:underline"
          >
            {a.name}
          </Link>
          <p className="truncate text-2xs text-encre-2">
            {a.categorie ?? 'Non classé'} · signal {a.signalScore}
            {domaineDe(a.websiteUrl) ? ` · ${domaineDe(a.websiteUrl)}` : ''}
          </p>
        </div>

        <div className="ml-auto text-right">
          {a.declareCents != null ? (
            <>
              <p className="tabular text-sm font-semibold text-encre">
                {formaterMontant(a.declareCents)}
                <span className="font-normal text-encre-2">/mois</span>
              </p>
              <p className="text-2xs text-neo-600">
                déclaré{a.declareLe ? ` · relevé ${dateCourte(a.declareLe)}` : ''}
              </p>
            </>
          ) : a.estimeBasCents != null && a.estimeHautCents != null ? (
            <>
              <p className="tabular text-sm text-encre-2">
                {formaterMontant(a.estimeBasCents)} – {formaterMontant(a.estimeHautCents)}
              </p>
              <p className="text-2xs text-encre-2">estimé, rien de déclaré</p>
            </>
          ) : (
            <p className="text-2xs text-encre-2">aucun montant</p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <FormulaireMrr
          advertiserId={a.id}
          montantCents={a.declareCents}
          source={a.declareSource}
          releveLe={a.declareLe}
        />
      </div>
    </li>
  );
}

export default async function AdminMrrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const brut = params.q;
  const q = (Array.isArray(brut) ? brut[0] : brut)?.trim() || undefined;

  const [coque, liste, reste] = await Promise.all([
    proprietesCoque(),
    listeSaisieMrr(q),
    resteASaisir(),
  ]);

  return (
    <Coque compteurs={coque.compteurs} admin compte={coque.compte}>
      <EnTetePage
        titre="Revenus mensuels déclarés"
        compteur={`${reste.avec.toLocaleString('fr-FR')} renseignés sur ${reste.total.toLocaleString('fr-FR')} annonceurs`}
        sous="Un montant déclaré vient d’une publication de l’entreprise : un tweet, une page « open startup », une interview. Aucune API ne le donne, donc ça se cherche à la main. Le lien vers la source est obligatoire, et la date est celle du relevé — pas celle de la saisie."
        actions={
          <Button asChild taille="sm" variant="secondaire">
            <Link href="/admin">Supervision</Link>
          </Button>
        }
      />

      <div className="px-5 pb-10 pt-5 lg:px-8">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <Input
            name="q"
            type="search"
            defaultValue={q ?? ''}
            placeholder="Chercher un annonceur par nom ou par domaine"
            className="h-11 w-full max-w-md text-sm"
            aria-label="Chercher un annonceur"
          />
          <Button type="submit" taille="sm" variant="secondaire">
            Chercher
          </Button>
          {q ? (
            <Button asChild taille="sm" variant="fantome">
              <Link href="/admin/mrr">Effacer</Link>
            </Button>
          ) : null}
        </form>

        {q ? (
          <section className="mt-6">
            <h2 className="text-lg">
              {liste.trouves.length} résultat{liste.trouves.length > 1 ? 's' : ''} pour « {q} »
            </h2>
            {liste.trouves.length === 0 ? (
              <div className="mt-4">
                <EtatVide
                  titre="Aucun annonceur trouvé"
                  explication="Cet annonceur n’est pas encore dans l’archive. Un MRR ne peut être rattaché qu’à une page que le pipeline a déjà vue diffuser."
                />
              </div>
            ) : (
              <ul className="mt-2">
                {liste.trouves.map((a) => (
                  <Ligne key={a.id} a={a} />
                ))}
              </ul>
            )}
          </section>
        ) : (
          <>
            <section className="mt-8">
              <h2 className="text-lg">À chercher en priorité</h2>
              <p className="mt-1 max-w-2xl text-sm text-encre-2">
                Les trente annonceurs au signal le plus élevé sans montant déclaré. L’ordre n’est
                pas alphabétique : le MRR d’une entreprise qui paie depuis deux ans vaut la
                recherche, celui d’une qui a testé trois jours ne vaut rien.
              </p>
              {liste.trouves.length === 0 ? (
                <div className="mt-4">
                  <EtatVide
                    titre="Plus rien à chercher"
                    explication="Tous les annonceurs de l’archive ont un montant déclaré. C’est peu probable — vérifie plutôt que le pipeline tourne."
                  />
                </div>
              ) : (
                <ul className="mt-4">
                  {liste.trouves.map((a) => (
                    <Ligne key={a.id} a={a} />
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-12 border-t border-bordure pt-8">
              <h2 className="text-lg">Déjà renseignés</h2>
              <p className="mt-1 max-w-2xl text-sm text-encre-2">
                Du relevé le plus récent au plus ancien. Un montant de deux ans n’est plus un fait
                sur l’entreprise d’aujourd’hui : c’est ici qu’on le voit vieillir.
              </p>
              {liste.renseignes.length === 0 ? (
                <p className="mt-4 text-sm text-encre-2">Aucun montant déclaré pour l’instant.</p>
              ) : (
                <ul className="mt-4">
                  {liste.renseignes.map((a) => (
                    <Ligne key={a.id} a={a} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Coque>
  );
}
