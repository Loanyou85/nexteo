import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const ETAPES = ['L’idée', 'Le plan', 'La construction'];

/** Fil des trois étapes de création (section 5.3). */
export function Etapes({ active }: { active: 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Étapes de création">
      {ETAPES.map((nom, i) => {
        const n = i + 1;
        const faite = n < active;
        const courante = n === active;
        return (
          <li key={nom} className="flex items-center gap-2">
            <span
              className={cn(
                'chanfrein flex h-7 w-7 items-center justify-center text-xs font-medium [--c:5px]',
                faite ? 'bg-tier-2 text-void-900' : courante ? 'degrade-arc text-white' : 'bg-void-700 text-text-3',
              )}
              aria-current={courante ? 'step' : undefined}
            >
              {faite ? <Check size={14} strokeWidth={3} aria-hidden /> : n}
            </span>
            <span className={courante ? 'text-text-1' : 'text-text-3'}>{nom}</span>
            {n < ETAPES.length ? <span aria-hidden className="mx-1 h-px w-8 bg-void-600" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
