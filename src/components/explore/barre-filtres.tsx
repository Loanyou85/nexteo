'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { BANDES } from '@/lib/signal/score';
import { cn } from '@/lib/utils';

/**
 * Barre de filtres, en ligne au-dessus des résultats.
 *
 * L'état vit dans l'URL, pas dans le composant : un résultat se partage en
 * copiant l'adresse et le bouton Précédent fait ce qu'on attend. Le curseur de
 * pagination est remis à zéro dès qu'un filtre change — le garder pointerait
 * au milieu d'un autre résultat.
 *
 * La barre réécrit le chemin courant et non une adresse fixe : la recherche en
 * cartes et la liste en tableau lisent les mêmes paramètres, et filtrer depuis
 * le tableau ne doit pas renvoyer sur les cartes.
 */
const ANTI_REBOND_MS = 300;

type Facettes = {
  categories: { slug: string; label: string }[];
  pays: { code: string; n: number }[];
  plateformes: { code: string; n: number }[];
};

export function BarreFiltres({ facettes }: { facettes: Facettes }) {
  const router = useRouter();
  const chemin = usePathname();
  const params = useSearchParams();
  const [enCours, demarrer] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [ouvert, setOuvert] = useState(false);
  const premier = useRef(true);

  function appliquer(modifs: Record<string, string | null>) {
    const suivant = new URLSearchParams(params.toString());
    for (const [cle, valeur] of Object.entries(modifs)) {
      if (!valeur) suivant.delete(cle);
      else suivant.set(cle, valeur);
    }
    suivant.delete('curseur');
    demarrer(() => router.replace(`${chemin}?${suivant.toString()}`, { scroll: false }));
  }

  // Anti-rebond de 300 ms : une requête par frappe rendrait la liste illisible
  // et chargerait le serveur pour rien.
  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    const m = setTimeout(() => {
      if (q !== (params.get('q') ?? '')) appliquer({ q: q || null });
    }, ANTI_REBOND_MS);
    return () => clearTimeout(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtresPoses = ['bande', 'categorie', 'pays', 'plateforme', 'anciennete', 'diffusion'].filter(
    (c) => params.get(c),
  ).length;

  return (
    <div className={cn('space-y-3', enCours && 'opacity-70 transition-opacity')}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search
            size={17}
            strokeWidth={1.75}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-encre-2"
          />
          <label htmlFor="recherche" className="sr-only">
            Rechercher un annonceur, une accroche, un domaine
          </label>
          <input
            id="recherche"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un annonceur, une accroche, un domaine…"
            autoComplete="off"
            className="h-11 w-full rounded-champ border border-bordure bg-surface pl-10 pr-3 text-base text-encre placeholder:text-encre-2/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neo-500"
          />
        </div>

        <Menu
          libelle="Catégorie"
          valeur={params.get('categorie')}
          options={facettes.categories.map((c) => ({ v: c.slug, l: c.label }))}
          onChange={(v) => appliquer({ categorie: v })}
        />
        <Menu
          libelle="Signal"
          valeur={params.get('bande')}
          options={BANDES.map((b) => ({ v: b.bande, l: b.libelle }))}
          onChange={(v) => appliquer({ bande: v })}
        />
        <Menu
          libelle="Pays"
          valeur={params.get('pays')}
          options={facettes.pays.map((p) => ({ v: p.code, l: `${p.code} · ${p.n}` }))}
          onChange={(v) => appliquer({ pays: v })}
        />

        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          className="flex h-11 items-center gap-2 rounded-champ border border-bordure bg-surface px-3.5 text-sm text-encre transition-colors hover:border-neo-500/40"
        >
          <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden />
          Filtres
          {filtresPoses > 0 ? (
            <span className="tabular rounded-capsule bg-neo-100 px-1.5 text-2xs font-medium text-neo-600">
              {filtresPoses}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => {
            setQ('');
            demarrer(() => router.replace(chemin, { scroll: false }));
          }}
          className="flex h-11 items-center gap-2 rounded-champ border border-bordure bg-surface px-3.5 text-sm text-encre-2 transition-colors hover:text-encre"
        >
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
          Réinitialiser
        </button>
      </div>

      {ouvert ? (
        <div className="grid gap-4 rounded-card border border-bordure bg-fond p-4 sm:grid-cols-3">
          <Groupe titre="Durée de diffusion">
            {([
              ['', 'Peu importe'],
              ['90', '3 mois et plus'],
              ['180', '6 mois et plus'],
              ['365', '1 an et plus'],
            ] as const).map(([v, l]) => (
              <Puce
                key={l}
                actif={(params.get('anciennete') ?? '') === v}
                onClick={() => appliquer({ anciennete: v || null })}
              >
                {l}
              </Puce>
            ))}
          </Groupe>

          <Groupe titre="État">
            {([
              ['', 'Tous'],
              ['1', 'En diffusion'],
              ['0', 'Arrêtés'],
            ] as const).map(([v, l]) => (
              <Puce
                key={l}
                actif={(params.get('diffusion') ?? '') === v}
                onClick={() => appliquer({ diffusion: v || null })}
              >
                {l}
              </Puce>
            ))}
          </Groupe>

          <Groupe titre="Trier par">
            {([
              ['signal', 'Signal Nexteo'],
              ['anciennete', 'Durée de diffusion'],
              ['volume', 'Annonces actives'],
              ['nouveaute', 'Découverts récemment'],
            ] as const).map(([v, l]) => (
              <Puce
                key={v}
                actif={(params.get('tri') ?? 'signal') === v}
                onClick={() => appliquer({ tri: v })}
              >
                {l}
              </Puce>
            ))}
          </Groupe>
        </div>
      ) : null}
    </div>
  );
}

function Menu({
  libelle,
  valeur,
  options,
  onChange,
}: {
  libelle: string;
  valeur: string | null;
  options: { v: string; l: string }[];
  onChange: (v: string | null) => void;
}) {
  const choisi = options.find((o) => o.v === valeur) ?? null;
  return (
    <div className="relative">
      <select
        aria-label={libelle}
        value={valeur ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          'h-11 appearance-none rounded-champ border bg-surface pl-3.5 pr-9 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neo-500',
          choisi ? 'border-neo-500 text-encre' : 'border-bordure text-encre-2 hover:text-encre',
        )}
      >
        <option value="">{libelle}</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-encre-2"
      />
    </div>
  );
}

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-encre">{titre}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
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
        'h-8 rounded-capsule border px-3 text-xs transition-colors',
        actif
          ? 'border-neo-500 bg-neo-100 text-neo-600'
          : 'border-bordure bg-surface text-encre-2 hover:text-encre',
      )}
    >
      {children}
    </button>
  );
}
