'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OFFRES, economieAnnuelle, mensuelEquivalent, type Periodicite } from '@/lib/plans';
import { cn } from '@/lib/utils';

/**
 * Cartes de tarifs et basculeur mensuel/annuel (section 9.3).
 *
 * Un seul basculeur horizontal au-dessus des cartes, mensuel par défaut. Le
 * badge d'économie n'apparaît qu'en annuel : l'afficher en permanence
 * reviendrait à annoncer une remise qui ne s'applique pas.
 */
export function CartesTarifs({ tarifsManquants }: { tarifsManquants: string[] }) {
  const [periodicite, setPeriodicite] = useState<Periodicite>('mensuel');
  const annuel = periodicite === 'annuel';

  return (
    <>
      <div className="flex justify-center">
        <div
          role="radiogroup"
          aria-label="Périodicité"
          className="inline-flex rounded-capsule border border-bordure bg-surface p-1"
        >
          {(['mensuel', 'annuel'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={periodicite === p}
              onClick={() => setPeriodicite(p)}
              className={cn(
                'h-9 rounded-capsule px-4 text-sm font-medium transition-colors duration-200',
                periodicite === p ? 'bg-neo-500 text-white' : 'text-encre-2 hover:text-encre',
              )}
            >
              {p === 'mensuel' ? 'Mensuel' : 'Annuel'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {OFFRES.map((offre) => (
          <Card key={offre.plan} actif={offre.enAvant} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-encre">{offre.nom}</h2>
              {offre.enAvant ? <Badge ton="neo">Le plus choisi</Badge> : null}
            </div>

            <div>
              <p className="tabular text-2xl font-semibold text-encre transition-[opacity] duration-200">
                {annuel ? offre.annuel : offre.mensuel} €
                <span className="text-sm font-normal text-encre-2">
                  {annuel ? ' par an' : ' par mois'}
                </span>
              </p>
              <p className="mt-1 h-5 text-xs text-encre-2">
                {annuel ? (
                  <>
                    Soit {mensuelEquivalent(offre).toLocaleString('fr-FR')} € par mois ·{' '}
                    <span className="text-neo-600">{economieAnnuelle(offre)} % d’économie</span>
                  </>
                ) : null}
              </p>
            </div>

            <p className="text-sm text-encre-2">{offre.promesse}</p>

            <ul className="space-y-1.5 text-sm text-encre">
              {offre.apports.map((a) => (
                <li key={a} className="flex gap-2">
                  <span aria-hidden className="text-neo-500">
                    ·
                  </span>
                  {a}
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-2">
              <Button
                asChild={tarifsManquants.length === 0}
                taille="bloc"
                variant={offre.enAvant ? 'principal' : 'secondaire'}
                disabled={tarifsManquants.length > 0}
              >
                {tarifsManquants.length === 0 ? (
                  <Link href={`/abonnement/${offre.plan}?periodicite=${periodicite}`}>
                    Choisir {offre.nom}
                  </Link>
                ) : (
                  <span>Bientôt disponible</span>
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
