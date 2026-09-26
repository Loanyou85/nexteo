import { cn } from '@/lib/utils';

/**
 * Tons disponibles. Il n'y a pas de vert : dans ce secteur le vert signifie
 * l'argent, et Nexteo ne publie aucune donnée d'argent. `actif` est violet,
 * comme le reste du signal.
 */
export function Badge({
  className,
  ton = 'neutre',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  ton?: 'neutre' | 'neo' | 'actif' | 'arrete' | 'alerte' | 'demo';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-capsule border px-2.5 py-0.5 text-2xs font-medium',
        ton === 'neutre' && 'border-bordure bg-fond text-encre-2',
        ton === 'neo' && 'border-neo-500/30 bg-neo-500/10 text-neo-600',
        ton === 'actif' && 'border-actif/30 bg-actif/10 text-actif',
        ton === 'arrete' && 'border-bordure bg-fond text-arrete',
        ton === 'alerte' && 'border-alerte/30 bg-alerte/10 text-alerte',
        // Une donnée de démonstration se voit sans qu'on ait à la chercher
        // (garde-fou n° 2).
        ton === 'demo' && 'border-alerte/40 bg-alerte/10 text-alerte uppercase tracking-wide',
        className,
      )}
      {...props}
    />
  );
}
