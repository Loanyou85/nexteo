'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Filtres de la liste d'annonces.
 *
 * Différents de ceux des annonceurs, parce que les questions sont différentes.
 * Ici on cherche un texte, une durée, un statut de diffusion — pas un niveau
 * de signal, qui est une propriété de l'entreprise et pas de l'annonce.
 */
const ANTI_REBOND_MS = 300;

type Facettes = {
  categories: { slug: string; label: string }[];
  pays: { code: string; n: number }[];
  plateformes: { code: string; n: number }[];
};

const DUREES = [
  { valeur: '30', libelle: 'Plus de 1 mois' },
  { valeur: '90', libelle: 'Plus de 3 mois' },
  { valeur: '180', libelle: 'Plus de 6 mois' },
  { valeur: '365', libelle: 'Plus de 1 an' },
];

const TRIS = [
  { valeur: 'duree', libelle: 'Durée de diffusion' },
  { valeur: 'recentes', libelle: 'Lancées récemment' },
  { valeur: 'anciennes', libelle: 'Les plus anciennes' },
];

const CLES = ['diffusion', 'retirees', 'pays', 'plateforme', 'categorie', 'jours'] as const;

function Choix({
  intitule,
  valeur,
  options,
  onChange,
}: {
  intitule: string;
  valeur: string;
  options: { valeur: string; libelle: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{intitule}</span>
      <select
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 appearance-none rounded-champ border border-bordure bg-surface pl-3.5 pr-9 text-sm text-encre focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neo-500"
      >
        <option value="">{intitule}</option>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BarreFiltresAnnonces({ facettes }: { facettes: Facettes }) {
  const router = useRouter();
  const chemin = usePathname();
  const params = useSearchParams();
  const [enCours, demarrer] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');
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

  const poses = CLES.filter((c) => params.get(c)).length;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', enCours && 'opacity-70 transition-opacity')}>
      <div className="relative min-w-[240px] flex-1">
        <Search
          size={17}
          strokeWidth={1.75}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-encre-2"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Chercher dans le texte des annonces"
          aria-label="Chercher dans le texte des annonces"
          className="h-11 w-full rounded-champ border border-bordure bg-surface pl-10 pr-3.5 text-sm text-encre placeholder:text-encre-2/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neo-500"
        />
      </div>

      <Choix
        intitule="Diffusion"
        valeur={params.get('diffusion') ?? ''}
        options={[
          { valeur: '1', libelle: 'En diffusion' },
          { valeur: '0', libelle: 'Arrêtées' },
        ]}
        onChange={(v) => appliquer({ diffusion: v || null })}
      />

      <Choix
        intitule="Durée"
        valeur={params.get('jours') ?? ''}
        options={DUREES}
        onChange={(v) => appliquer({ jours: v || null })}
      />

      <Choix
        intitule="Catégorie"
        valeur={params.get('categorie') ?? ''}
        options={facettes.categories.map((c) => ({ valeur: c.slug, libelle: c.label }))}
        onChange={(v) => appliquer({ categorie: v || null })}
      />

      <Choix
        intitule="Pays"
        valeur={params.get('pays') ?? ''}
        options={facettes.pays.map((p) => ({ valeur: p.code, libelle: `${p.code} · ${p.n}` }))}
        onChange={(v) => appliquer({ pays: v || null })}
      />

      <Choix
        intitule="Trier par"
        valeur={params.get('tri') ?? ''}
        options={TRIS}
        onChange={(v) => appliquer({ tri: v || null })}
      />

      <button
        type="button"
        onClick={() => appliquer({ retirees: params.get('retirees') ? null : '1' })}
        aria-pressed={Boolean(params.get('retirees'))}
        className={cn(
          'h-11 rounded-champ border px-3.5 text-sm transition-colors',
          params.get('retirees')
            ? 'border-neo-500 bg-neo-100 text-neo-600'
            : 'border-bordure bg-surface text-encre-2 hover:text-encre',
        )}
      >
        Effacées par Meta
      </button>

      {poses > 0 || q ? (
        <button
          type="button"
          onClick={() => {
            setQ('');
            demarrer(() => router.replace(chemin, { scroll: false }));
          }}
          className="flex h-11 items-center gap-1.5 rounded-champ px-3 text-sm text-encre-2 hover:text-encre"
        >
          <RotateCcw size={15} strokeWidth={1.75} aria-hidden />
          Tout effacer
        </button>
      ) : null}
    </div>
  );
}
