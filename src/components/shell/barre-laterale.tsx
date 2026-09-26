'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

/**
 * Barre latérale bleu nuit.
 *
 * Elle reste visible en permanence sur grand écran : c'est un outil de
 * travail, on passe d'une section à l'autre sans arrêt, et un menu qu'il faut
 * ouvrir coûte un geste à chaque fois.
 *
 * Sous 1024 px elle disparaît au profit de la barre basse à cinq entrées —
 * une colonne de 280 px sur un téléphone ne laisserait rien au contenu.
 */

type Entree = {
  href: string;
  libelle: string;
  icone: React.ReactNode;
  compteur?: number;
};

function I({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px] shrink-0" aria-hidden>
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const LOUPE = 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35';
const GLOBE = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18';
const IMAGE = 'M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v13A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-13Zm2 10 4-4 4 4m2-2 2-2 3 3M8.5 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z';
const HORLOGE = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2';
const SIGNET = 'M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z';
const JAUGE = 'M12 20a8 8 0 1 1 8-8m-8 8a8 8 0 0 1-8-8m8 8v-6m6.5-2-4.5 4';
const REGLAGES = 'M4 6h16M4 12h16M4 18h16M9 6v0m6 6v0M9 18v0';

const ENTREES: Entree[] = [
  { href: '/explore', libelle: 'Explorer', icone: <I d={LOUPE} /> },
  { href: '/annonceurs', libelle: 'Annonceurs', icone: <I d={GLOBE} /> },
  { href: '/annonces', libelle: 'Annonces', icone: <I d={IMAGE} /> },
  { href: '/opportunites', libelle: 'Signaux de marché', icone: <I d={JAUGE} /> },
  { href: '/collections', libelle: 'Collections', icone: <I d={SIGNET} /> },
  { href: '/dashboard', libelle: 'Suivis', icone: <I d={HORLOGE} /> },
];

export function BarreLaterale({
  compteurs,
  admin,
}: {
  compteurs?: { annonceurs?: number; annonces?: number };
  admin?: boolean;
}) {
  const chemin = usePathname();

  const entrees = ENTREES.map((e) =>
    e.href === '/annonceurs'
      ? { ...e, compteur: compteurs?.annonceurs }
      : e.href === '/annonces'
        ? { ...e, compteur: compteurs?.annonces }
        : e,
  );

  return (
    <aside className="hidden w-[272px] shrink-0 flex-col bg-nuit lg:flex">
      <div className="px-6 py-6">
        <Link href="/" aria-label="Nexteo, accueil">
          <Logo variant="nuit" />
        </Link>
      </div>

      <nav className="flex-1 px-3" aria-label="Navigation principale">
        <ul className="space-y-0.5">
          {entrees.map((e) => {
            const actif = chemin === e.href || chemin.startsWith(`${e.href}/`);
            return (
              <li key={e.href}>
                <Link
                  href={e.href}
                  aria-current={actif ? 'page' : undefined}
                  className={cn(
                    'relative flex h-11 items-center gap-3 rounded-champ px-3 text-sm transition-colors',
                    actif
                      ? 'bg-nuit-2 font-medium text-nuit-encre'
                      : 'text-nuit-encre-2 hover:bg-nuit-2/60 hover:text-nuit-encre',
                  )}
                >
                  {actif ? (
                    <span
                      aria-hidden
                      className="absolute left-0 top-2 h-7 w-[3px] rounded-capsule bg-neo-500"
                    />
                  ) : null}
                  {e.icone}
                  <span className="truncate">{e.libelle}</span>
                  {typeof e.compteur === 'number' ? (
                    <span className="tabular ml-auto rounded-capsule bg-nuit-3 px-2 py-0.5 text-2xs text-nuit-encre-2">
                      {e.compteur.toLocaleString('fr-FR')}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}

          {admin ? (
            <li className="pt-2">
              <Link
                href="/admin"
                className={cn(
                  'flex h-11 items-center gap-3 rounded-champ px-3 text-sm transition-colors',
                  chemin.startsWith('/admin')
                    ? 'bg-nuit-2 font-medium text-nuit-encre'
                    : 'text-nuit-encre-2 hover:bg-nuit-2/60 hover:text-nuit-encre',
                )}
              >
                <I d={REGLAGES} />
                Supervision
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>

      <div className="p-4">
        <Link
          href="/tarifs"
          className="flex h-12 items-center justify-center gap-2 rounded-capsule bg-neo-500 text-sm font-semibold text-white transition-colors hover:bg-neo-400"
        >
          Passer à Pro
        </Link>
        <p className="mt-3 px-1 text-2xs leading-relaxed text-nuit-encre-2">
          Données issues de la bibliothèque publicitaire de Meta.
        </p>
      </div>
    </aside>
  );
}
