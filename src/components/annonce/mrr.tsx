import { Info } from 'lucide-react';
import { formaterMontant } from '@/lib/mrr/estimer';

/**
 * Affichage d'un revenu mensuel récurrent.
 *
 * Deux natures, jamais confondues.
 *
 * Le DÉCLARÉ est un fait : l'entreprise l'a publié, le lien y mène, la date
 * est celle du relevé et non de l'import.
 *
 * L'ESTIMÉ est une fourchette, jamais un nombre seul. Un point unique
 * laisserait croire à une précision qui n'existe pas : le calcul enchaîne
 * quatre hypothèses de marché, chacune faussable d'un facteur deux. La méthode
 * complète est accessible d'un survol, et le mot « estimé » est collé au
 * montant, pas relégué dans une note de bas de page.
 */

export type DonneesMrr = {
  declareCents: number | null;
  declareSource: string | null;
  declareLe: Date | null;
  estimeBasCents: number | null;
  estimeHautCents: number | null;
  estimeMethode: string | null;
  estimeFiabilite: string | null;
};

const dateCourte = (d: Date) =>
  d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });

/** Version compacte, pour l'angle d'une carte. */
export function MrrCompact({ m }: { m: DonneesMrr }) {
  if (m.declareCents != null) {
    return (
      <div className="text-right">
        <p className="tabular text-sm font-semibold text-encre">
          {formaterMontant(m.declareCents)}
          <span className="font-normal text-encre-2">/mois</span>
        </p>
        <p className="text-2xs text-neo-600">déclaré</p>
      </div>
    );
  }

  if (m.estimeBasCents != null && m.estimeHautCents != null) {
    return (
      <div className="text-right">
        <p className="tabular text-sm font-semibold text-encre-2">
          {formaterMontant(m.estimeBasCents)} – {formaterMontant(m.estimeHautCents)}
        </p>
        <p className="text-2xs text-encre-2">estimé /mois</p>
      </div>
    );
  }

  return (
    <div className="text-right">
      <p className="text-sm text-encre-2">—</p>
      <p className="text-2xs text-encre-2">aucun montant</p>
    </div>
  );
}

/** Version complète, pour une fiche. */
export function MrrDetaille({ m, nom }: { m: DonneesMrr; nom: string }) {
  const rien = m.declareCents == null && m.estimeBasCents == null;

  return (
    <div className="space-y-4">
      {m.declareCents != null ? (
        <div className="rounded-card border border-neo-500/40 bg-neo-100/40 p-4">
          <p className="text-2xs uppercase tracking-wide text-neo-600">Déclaré par l’entreprise</p>
          <p className="tabular mt-1 text-2xl font-semibold text-encre">
            {formaterMontant(m.declareCents)}
            <span className="text-base font-normal text-encre-2"> par mois</span>
          </p>
          <p className="mt-1.5 text-xs text-encre-2">
            {m.declareLe ? `Relevé de ${dateCourte(m.declareLe)}. ` : ''}
            {m.declareSource ? (
              <a
                href={m.declareSource}
                target="_blank"
                rel="noreferrer noopener nofollow"
                className="text-neo-600 underline underline-offset-4"
              >
                Voir la publication
              </a>
            ) : (
              'Source non renseignée.'
            )}
          </p>
        </div>
      ) : null}

      {m.estimeBasCents != null && m.estimeHautCents != null ? (
        <div className="rounded-card border border-bordure bg-fond p-4">
          <div className="flex items-center gap-1.5">
            <p className="text-2xs uppercase tracking-wide text-encre-2">Estimation</p>
            <Info size={13} strokeWidth={1.75} className="text-encre-2" aria-hidden />
          </div>
          <p className="tabular mt-1 text-xl font-semibold text-encre-2">
            {formaterMontant(m.estimeBasCents)} – {formaterMontant(m.estimeHautCents)}
            <span className="text-base font-normal"> par mois</span>
          </p>
          <p className="mt-2 text-xs text-encre-2">
            Fiabilité {m.estimeFiabilite ?? 'faible'}. Ce n’est pas une mesure : {nom} ne publie pas
            ses chiffres, et personne ne les connaît.
          </p>
          {m.estimeMethode ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-neo-600 underline underline-offset-4">
                Comment ce chiffre est obtenu
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-encre-2">{m.estimeMethode}</p>
            </details>
          ) : null}
        </div>
      ) : null}

      {rien ? (
        <div className="rounded-card border border-bordure bg-fond p-4">
          <p className="text-sm text-encre">Aucun montant pour cet annonceur.</p>
          <p className="mt-1 text-xs text-encre-2">
            {nom} ne publie pas ses chiffres, et Meta n’expose pas de portée pour ses annonces —
            il n’y a donc rien à déclarer ni de quoi estimer.
          </p>
        </div>
      ) : null}
    </div>
  );
}
