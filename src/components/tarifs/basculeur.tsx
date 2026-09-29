'use client';

import { cn } from '@/lib/utils';

/**
 * Basculeur mensuel / annuel (section 5.2 de l'offre).
 * Clic, Espace et Entrée basculent ; flèche droite → annuel, gauche → mensuel.
 * `role="switch"` : un lecteur d'écran l'annonce comme un interrupteur.
 */
export function Basculeur({
  annuel,
  onChange,
  moisOfferts,
}: {
  annuel: boolean;
  onChange: (annuel: boolean) => void;
  moisOfferts: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <span className={cn('display text-[18px] transition-colors', annuel ? 'text-text-3' : 'text-text-1')}>Mensuel</span>
      <button
        type="button"
        role="switch"
        aria-checked={annuel}
        aria-label="Facturation annuelle"
        onClick={() => onChange(!annuel)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            onChange(true);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onChange(false);
          }
        }}
        className="chanfrein relative h-[30px] w-[104px] shrink-0 bg-void-700 [--c:8px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-arc-cyan"
      >
        <span
          aria-hidden
          className={cn(
            'curseur-basculeur chanfrein degrade-arc absolute left-[3px] top-[3px] h-[24px] w-[48px] [--c:6px]',
            annuel ? 'translate-x-[50px]' : 'translate-x-0',
          )}
        />
      </button>
      <span className={cn('display text-[18px] transition-colors', annuel ? 'text-text-1' : 'text-text-3')}>Annuel</span>
      <span className={cn('display text-[18px] text-tier-5', annuel ? 'anim-fondu' : 'invisible')} aria-hidden={!annuel}>
        {moisOfferts} mois offerts
      </span>
    </div>
  );
}
