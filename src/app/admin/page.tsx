import { redirect } from 'next/navigation';
import { TopBar } from '@/components/shell/top-bar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { requireUser } from '@/server/auth';
import { supervision } from '@/server/supervision';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Supervision — Nexteo' };

const dateHeure = (d: Date) =>
  d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Chiffre({ valeur, intitule }: { valeur: number | string; intitule: string }) {
  return (
    <Card>
      <p className="tabular text-2xl font-semibold text-encre">{valeur}</p>
      <p className="mt-1 text-sm text-encre-2">{intitule}</p>
    </Card>
  );
}

function Alerte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-alerte/40 bg-alerte/5 p-carte">
      <p className="text-sm font-semibold text-encre">{titre}</p>
      <div className="mt-1 text-sm text-encre-2">{children}</div>
    </div>
  );
}

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/');

  const s = await supervision();

  return (
    <>
      <TopBar connecte />

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">
        <h1 className="text-xl">Supervision</h1>
        <p className="mt-1.5 text-sm text-encre-2">
          Cet écran existe pour qu’on n’ait jamais à lire les journaux de l’hébergeur. La seule
          panne irrécupérable, c’est l’ingestion qui s’arrête.
        </p>

        <div className="mt-8 space-y-3">
          {s.ingestion.enRetard ? (
            <Alerte titre="L’ingestion est en retard">
              {s.ingestion.heuresDepuis === null
                ? 'Aucune exécution réussie enregistrée. Chaque jour sans ingestion est de la donnée perdue définitivement : l’archive Meta efface une annonce environ douze mois après sa dernière impression.'
                : `Dernière réussite il y a ${s.ingestion.heuresDepuis} heures. Au-delà de 48 h, des annonces disparaissent de l’archive sans que personne puisse les récupérer.`}
            </Alerte>
          ) : null}

          {s.ingestion.souffrance.length > 0 ? (
            <Alerte titre="Lots en échec deux fois de suite">
              {s.ingestion.souffrance
                .map((l) => `${l.pays}/${l.terme ?? 'tous termes'}`)
                .join(', ')}
              . Ce ne sont pas des incidents techniques de plus : ce sont deux jours de données que
              personne ne rattrapera.
            </Alerte>
          ) : null}

          {s.partitions.defautNonVide > 0 ? (
            <Alerte titre="La partition par défaut n’est plus vide">
              {s.partitions.defautNonVide} observations y sont tombées. Il faudra les déplacer avant
              de pouvoir rattacher la partition mensuelle correspondante.
            </Alerte>
          ) : null}

          {s.configuration.sourceEstDemo ? (
            <Alerte titre="Données de démonstration">
              La source active est « {s.configuration.source} ». Tout ce qui est ingéré est marqué
              isDemo et signalé dans l’interface. Bascule sur l’API Meta avec AD_SOURCE=meta une
              fois la revue d’application obtenue.
            </Alerte>
          ) : null}
        </div>

        <section className="mt-8">
          <h2 className="text-lg">Archive</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Chiffre valeur={s.base.annonceurs} intitule="Annonceurs" />
            <Chiffre valeur={s.base.annonces} intitule="Annonces archivées" />
            <Chiffre valeur={s.base.observations} intitule="Observations empilées" />
            <Chiffre valeur={s.base.retirees} intitule="Retirées par Meta, conservées" />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg">Configuration</h2>
          <dl className="mt-4 divide-y divide-bordure border-y border-bordure">
            {[
              ['Source des annonces', s.configuration.source],
              ['Stockage objet', s.configuration.stockageConfigure ? 'configuré' : 'non configuré'],
              ['Partitions d’observations', String(s.partitions.total)],
              ['Annonceurs à revoir', String(s.revue.annonceurs)],
              [
                'Tarifs Stripe',
                s.configuration.tarifsManquants.length === 0
                  ? 'complets'
                  : `${s.configuration.tarifsManquants.length} variables manquantes`,
              ],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-sm text-encre-2">{k}</dt>
                <dd className="text-sm text-encre">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10">
          <h2 className="text-lg">Vingt dernières exécutions</h2>
          {s.ingestion.lots.length === 0 ? (
            <p className="mt-4 text-sm text-encre-2">
              Le pipeline n’a jamais tourné sur cette base.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-card border border-bordure bg-surface">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-bordure text-2xs uppercase tracking-wide text-encre-2">
                    <th className="h-11 px-carte font-medium">Lot</th>
                    <th className="h-11 px-carte font-medium">État</th>
                    <th className="h-11 px-carte text-right font-medium">Vues</th>
                    <th className="h-11 px-carte text-right font-medium">Nouvelles</th>
                    <th className="h-11 px-carte text-right font-medium">Terminé</th>
                  </tr>
                </thead>
                <tbody>
                  {s.ingestion.lots.map((l) => (
                    <tr key={l.id} className="ligne-tableau border-b border-bordure last:border-0">
                      <td className="h-ligne px-carte text-encre">
                        {l.pays} / {l.terme ?? 'tous termes'}
                      </td>
                      <td className="h-ligne px-carte">
                        <Badge
                          ton={
                            l.statut === 'succeeded'
                              ? 'actif'
                              : l.statut === 'failed'
                                ? 'alerte'
                                : 'neutre'
                          }
                        >
                          {l.statut}
                        </Badge>
                        {l.erreur ? (
                          <span className="ml-2 text-2xs text-encre-2">{l.erreur.slice(0, 60)}</span>
                        ) : null}
                      </td>
                      <td className="h-ligne px-carte text-right text-encre">{l.vues}</td>
                      <td className="h-ligne px-carte text-right text-encre">{l.nouvelles}</td>
                      <td className="h-ligne px-carte text-right text-encre-2">
                        {l.fini ? dateHeure(l.fini) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
