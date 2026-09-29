'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Chiffre qui défile : l'ancien sort vers le haut, le nouveau entre par le
 * bas, en 200 ms. Chiffres tabulaires, sinon ils sautent pendant l'animation.
 * Avec `prefers-reduced-motion`, le changement est instantané (CSS).
 */
export function PrixDefilant({ valeur, className }: { valeur: string; className?: string }) {
  const [precedent, setPrecedent] = useState<string | null>(null);
  const dernier = useRef(valeur);

  useEffect(() => {
    if (valeur === dernier.current) return;
    setPrecedent(dernier.current);
    dernier.current = valeur;
    const t = setTimeout(() => setPrecedent(null), 220);
    return () => clearTimeout(t);
  }, [valeur]);

  return (
    <span className={`tabular relative inline-block overflow-hidden align-bottom ${className ?? ''}`}>
      {precedent !== null ? (
        <span aria-hidden className="anim-prix-sortie absolute inset-0">
          {precedent}
        </span>
      ) : null}
      <span key={valeur} className={precedent !== null ? 'anim-prix-entree block' : 'block'}>
        {valeur}
      </span>
    </span>
  );
}
