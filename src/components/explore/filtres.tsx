'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { BANDES } from '@/lib/signal/score';
import { cn } from '@/lib/utils';

/**
 * Filtres d'exploration.
 *
 * L'état vit dans l'URL, pas dans le composant : un résultat se partage en
 * copiant l'adresse, et le bouton Précédent du navigateur fait ce qu'on
 * attend de lui. Le curseur de pagination est remis à zéro dès qu'un filtre
 * change — le garder pointerait au milieu d'un autre résultat.
 */
const ANTI_REBOND_MS = 300;

type Facettes = {
  categories: { slug: string; label: string }[];
  pays: { code: string; n: number }[];
  plateformes: { code: string; n: number }[];
};

export function Filtres({ facettes, vue }: { facettes: Facettes; vue: 'cartes' | 'tableau' }) {
  const router = useRouter();
  const params = useSearchParams();
  const [enCours, demarrer] = useTransition();

  const [q, setQ] = useState(params.get('q') ?? '');
  const premierRendu = useRef(true);

  function appliquer(modifs: Record<string, string | null>) {
    const suivant = new URLSearchParams(params.toString());
    for (const [cle, valeur] of Object.entries(modifs)) {
      if (valeur === null || valeur === '') suivant.delete(cle);
      else suivant.set(cle, valeur);
    }
    suivant.delete('curseur');
    demarrer(() => router.replace(`/explore?${suivant.toString()}`, { scroll: false }));
  }

  // Anti-rebond de 300 ms sur la saisie : une requête par frappe rendrait la
  // liste illisible et le serveur inutilement chargé.
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    const minuteur = setTimeout(() => {
      if (q !== (params.get('q') ?? '')) appliquer({ q: q || null });
    }, ANTI_REBOND_MS);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const actif = (cle: string, valeur: string) => params.get(cle) === valeur;

  return (
    <div className={cn('space-y-6', enCours && 'opacity-60 transition-opacity')}>
      <div>
        <label htmlFor="recherche" className="text-sm font-medium text-encre">
          Rechercher
        </label>
        <input
          id="recherche"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, accroche, domaine…"
          autoComplete="off"
          className="mt-1.5 h-11 w-full rounded-champ border border-bordure bg-surface px-3.5 text-base text-encre placeholder:text-encre-2/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neo-500"
        />
      </div>

      <Groupe titre="Signal">
        {BANDES.map((b) => (
          <Puce
            key={b.bande}
            actif={actif('bande', b.bande)}
            onClick={() => appliquer({ bande: actif('bande', b.bande) ? null : b.bande })}
          >
            {b.libelle}
          </Puce>
        ))}
      </Groupe>

      <Groupe titre="Diffusion">
        {[
          { v: '', l: 'Peu importe' },
          { v: '90', l: '3 mois et plus' },
          { v: '180', l: '6 mois et plus' },
          { v: '365', l: '1 an et plus' },
        ].map((o) => (
          <Puce
            key={o.l}
            actif={(params.get('anciennete') ?? '') === o.v}
            onClick={() => appliquer({ anciennete: o.v || null })}
          >
            {o.l}
          </Puce>
        ))}
      </Groupe>

      <Groupe titre="État">
        {[
          { v: '', l: 'Tous' },
          { v: '1', l: 'En diffusion' },
          { v: '0', l: 'Arrêtés' },
        ].map((o) => (
          <Puce
            key={o.l}
            actif={(params.get('diffusion') ?? '') === o.v}
            onClick={() => appliquer({ diffusion: o.v || null })}
          >
            {o.l}
          </Puce>
        ))}
      </Groupe>

      <Selecteur
        titre="Catégorie"
        valeur={params.get('categorie') ?? ''}
        options={facettes.categories.map((c) => ({ v: c.slug, l: c.label }))}
        onChange={(v) => appliquer({ categorie: v || null })}
      />

      <Selecteur
        titre="Pays"
        valeur={params.get('pays') ?? ''}
        options={facettes.pays.map((p) => ({ v: p.code, l: `${p.code} (${p.n})` }))}
        onChange={(v) => appliquer({ pays: v || null })}
      />

      <Selecteur
        titre="Plateforme"
        valeur={params.get('plateforme') ?? ''}
        options={facettes.plateformes.map((p) => ({ v: p.code, l: `${p.code} (${p.n})` }))}
        onChange={(v) => appliquer({ plateforme: v || null })}
      />

      <Selecteur
        titre="Trier par"
        valeur={params.get('tri') ?? 'signal'}
        sansVide
        options={[
          { v: 'signal', l: 'Signal Nexteo' },
          { v: 'anciennete', l: 'Durée de diffusion' },
          { v: 'volume', l: 'Annonces actives' },
          { v: 'nouveaute', l: 'Découverts récemment' },
        ]}
        onChange={(v) => appliquer({ tri: v })}
      />

      <Groupe titre="Affichage">
        <Puce actif={vue === 'cartes'} onClick={() => appliquer({ vue: null })}>
          Cartes
        </Puce>
        <Puce actif={vue === 'tableau'} onClick={() => appliquer({ vue: 'tableau' })}>
          Tableau
        </Puce>
      </Groupe>

      <button
        type="button"
        onClick={() => demarrer(() => router.replace('/explore', { scroll: false }))}
        className="text-sm text-encre-2 underline underline-offset-4 hover:text-encre"
      >
        Tout réinitialiser
      </button>
    </div>
  );
}

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-encre">{titre}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Puce({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        'h-9 rounded-capsule border px-3 text-xs transition-colors',
        actif
          ? 'border-neo-500 bg-neo-500/10 text-neo-600'
          : 'border-bordure text-encre-2 hover:text-encre',
      )}
    >
      {children}
    </button>
  );
}

function Selecteur({
  titre,
  valeur,
  options,
  onChange,
  sansVide,
}: {
  titre: string;
  valeur: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
  sansVide?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-encre">{titre}</label>
      <select
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-champ border border-bordure bg-surface px-3 text-base text-encre focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neo-500"
      >
        {sansVide ? null : <option value="">Toutes</option>}
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
}
