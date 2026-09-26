import { bandePour } from '@/lib/signal/score';
import { cn } from '@/lib/utils';

/**
 * Barre de signal.
 *
 * Toujours violette, jamais verte, jamais accompagnée d'un symbole monétaire.
 * L'intensité se lit au remplissage. Dans ce secteur, une barre verte dirait
 * « argent » à tout le monde — et Nexteo ne publie aucune donnée d'argent.
 */
export function BarreSignal({
  score,
  taille = 'md',
  sansLibelle,
  className,
}: {
  score: number;
  taille?: 'sm' | 'md' | 'lg';
  sansLibelle?: boolean;
  className?: string;
}) {
  const { libelle } = bandePour(score);
  const hauteur = taille === 'lg' ? 'h-2.5' : taille === 'sm' ? 'h-1' : 'h-1.5';

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            'tabular font-semibold text-encre',
            taille === 'lg' ? 'text-2xl' : taille === 'sm' ? 'text-sm' : 'text-md',
          )}
        >
          {score}
          <span className="text-encre-2 font-normal">/100</span>
        </span>
        {sansLibelle ? null : <span className="text-2xs text-encre-2">{libelle}</span>}
      </div>

      <div
        className={cn('mt-1.5 w-full overflow-hidden rounded-capsule bg-bordure', hauteur)}
        role="img"
        aria-label={`Signal Nexteo ${score} sur 100, ${libelle.toLowerCase()}`}
      >
        <div
          className="h-full rounded-capsule bg-neo-500 transition-[width] duration-300"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

type Composante = {
  cle: string;
  libelle: string;
  poids: number;
  points: number;
  explication: string;
};

/**
 * Détail du calcul.
 *
 * Affiché sur chaque fiche, sans repli ni « en savoir plus » : un score opaque
 * serait indéfendable puisque c'est le cœur du produit. Un lecteur doit
 * comprendre en dix secondes pourquoi un annonceur est à 82 et un autre à 31.
 */
export function DetailSignal({ detail }: { detail: Composante[] }) {
  return (
    <ul className="divide-y divide-bordure">
      {detail.map((c) => (
        <li key={c.cle} className="flex items-start gap-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-encre">{c.libelle}</p>
            <p className="mt-0.5 text-sm text-encre-2">{c.explication}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="tabular text-sm font-semibold text-encre">
              {c.points.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
            </p>
            <p className="tabular text-2xs text-encre-2">sur {c.poids}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
