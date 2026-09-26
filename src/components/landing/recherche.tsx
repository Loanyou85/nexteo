'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Barre de recherche de l'accueil.
 *
 * Elle n'interroge rien : elle emmène sur /explore, qui porte l'état des
 * filtres dans son URL. Un seul endroit sait chercher, et un résultat se
 * partage en copiant l'adresse.
 */
const EXEMPLES = ['facturation', 'planning', 'boutique en ligne', 'prise de rendez-vous', 'caisse'];

export function RechercheAccueil() {
  const router = useRouter();
  const [valeur, setValeur] = useState('');

  function aller(q: string) {
    const terme = q.trim();
    router.push(terme ? `/explore?q=${encodeURIComponent(terme)}` : '/explore');
  }

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aller(valeur);
        }}
        className="flex flex-col gap-2 sm:flex-row"
        role="search"
      >
        <label htmlFor="recherche-accueil" className="sr-only">
          Chercher un annonceur ou un type de produit
        </label>
        <input
          id="recherche-accueil"
          name="q"
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder="facturation, planning, boutique en ligne…"
          autoComplete="off"
          className="h-13 w-full rounded-champ border border-bordure bg-surface px-4 text-base text-encre placeholder:text-encre-2/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neo-500"
        />
        <Button type="submit" taille="capsule" className="shrink-0">
          Explorer les annonceurs
        </Button>
      </form>

      <ul className="mt-3 flex flex-wrap gap-2">
        {EXEMPLES.map((e) => (
          <li key={e}>
            <button
              type="button"
              onClick={() => aller(e)}
              className="rounded-capsule border border-bordure px-3 py-1 text-xs text-encre-2 transition-colors hover:border-neo-500/40 hover:text-encre"
            >
              {e}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
