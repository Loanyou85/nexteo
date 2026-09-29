import { cn } from '@/lib/utils';

/**
 * Panneau biseauté bordé.
 *
 * `clip-path` rogne aussi la bordure CSS : le coin coupé perdrait son trait.
 * La bordure est donc un fond : un calque extérieur de la couleur du bord,
 * un calque intérieur inset d'1 px avec un biseau légèrement plus petit. Le
 * biseau intérieur vaut c − 0,59 × épaisseur, ce qui garde la diagonale
 * exactement aussi épaisse que les côtés droits.
 */
export function Panneau({
  children,
  className,
  interieur,
  biseau = 14,
  epaisseur = 1,
  actif = false,
  couleurBord,
  as: Balise = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  interieur?: string;
  biseau?: number;
  epaisseur?: 1 | 2;
  actif?: boolean;
  couleurBord?: string;
  as?: 'div' | 'section' | 'article' | 'aside' | 'li';
}) {
  const b = actif ? 2 : epaisseur;
  return (
    <Balise
      className={cn('chanfrein', actif ? 'bg-void-500' : 'bg-void-600', className)}
      style={{ ['--c' as string]: `${biseau}px`, padding: b, ...(couleurBord ? { background: couleurBord } : {}) }}
    >
      <div
        className={cn('chanfrein h-full bg-void-800', interieur)}
        style={{ ['--c' as string]: `${Math.max(biseau - 0.59 * b, 0)}px` }}
      >
        {children}
      </div>
    </Balise>
  );
}
