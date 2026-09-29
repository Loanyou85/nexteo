import { useId } from 'react';
import { MARQUE } from '@/config/brand';
import { cn } from '@/lib/utils';

/**
 * Le N de Nexteo.
 *
 * Un monogramme dessiné pour ce produit : un N condensé et très gras, penché
 * vers l'avant, dont les deux angles extérieurs sont biseautés comme le reste
 * de l'interface. Il emprunte au jeu une énergie, pas une forme — aucune
 * lettre, aucune police, aucun contour n'est repris d'un logo existant.
 */
export const TRACE_N =
  'M8 42 L8 11 L13 6 L20 6 L30 24.5 L30 6 L40 6 L40 37 L35 42 L28 42 L18 23.5 L18 42 Z';

export function MonogrammeN({ taille = 32, className }: { taille?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 48 48"
      width={taille}
      height={taille}
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id={`arc-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2FE9FF" />
          <stop offset="0.5" stopColor="#2B7BFF" />
          <stop offset="1" stopColor="#7A3BFF" />
        </linearGradient>
      </defs>
      {/* L'inclinaison donne l'élan ; elle est portée par le tracé, pas par du CSS,
          pour que le favicon et le logo soient strictement identiques. */}
      <g transform="translate(3 0) skewX(-9)">
        <path d={TRACE_N} fill={`url(#arc-${id})`} />
        {/* Un liseré clair sur l'arête haute de la diagonale : lumière rasante. */}
        <path d="M20 6 L30 24.5 L30 21 L21.9 6 Z" fill="#FFFFFF" opacity="0.28" />
      </g>
    </svg>
  );
}

export function Logo({ className, taille = 30 }: { className?: string; taille?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <MonogrammeN taille={taille} />
      <span className="display text-[22px] leading-none tracking-[0.02em] text-text-1">
        {MARQUE.nom}
      </span>
    </span>
  );
}
