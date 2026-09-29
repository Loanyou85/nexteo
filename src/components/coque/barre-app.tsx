'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Plug, Plus, Shield } from 'lucide-react';
import { Logo } from '@/components/marque/logo';
import { cn } from '@/lib/utils';

/**
 * Barre du haut, et non barre latérale : la console de build a trois zones
 * côte à côte, et chaque colonne de 270 px prise par la navigation serait
 * volée aux logs.
 */
const ENTREES = [
  { href: '/dashboard', libelle: 'Projets', Icone: LayoutGrid },
  { href: '/creer', libelle: 'Créer', Icone: Plus },
  { href: '/connexion-uefn', libelle: 'Connexion UEFN', Icone: Plug },
];

export function BarreApp({
  email,
  admin,
  etatAgent,
}: {
  email: string | null;
  admin: boolean;
  etatAgent: 'connecte' | 'absent';
}) {
  const chemin = usePathname();
  const actif = (href: string) => chemin === href || chemin.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 border-b border-void-700 bg-void-900/90 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <Link href="/dashboard" aria-label="Nexteo, projets" className="shrink-0">
          <Logo taille={26} />
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          {ENTREES.map(({ href, libelle, Icone }) => (
            <Link
              key={href}
              href={href}
              aria-current={actif(href) ? 'page' : undefined}
              className={cn(
                'relative flex h-14 items-center gap-2 px-3 text-sm transition-colors',
                actif(href) ? 'text-text-1' : 'text-text-2 hover:text-text-1',
              )}
            >
              <Icone size={16} strokeWidth={1.8} aria-hidden />
              {libelle}
              {actif(href) ? (
                <span aria-hidden className="degrade-arc absolute inset-x-3 bottom-0 h-0.5" />
              ) : null}
            </Link>
          ))}
          {admin ? (
            <Link
              href="/admin"
              aria-current={actif('/admin') ? 'page' : undefined}
              className={cn(
                'flex h-14 items-center gap-2 px-3 text-sm transition-colors',
                actif('/admin') ? 'text-text-1' : 'text-text-2 hover:text-text-1',
              )}
            >
              <Shield size={16} strokeWidth={1.8} aria-hidden />
              Administration
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <Link
            href="/connexion-uefn"
            className="hidden items-center gap-2 text-xs text-text-2 hover:text-text-1 sm:flex"
          >
            <span
              aria-hidden
              className={cn(
                'h-2 w-2 rounded-full',
                etatAgent === 'connecte' ? 'bg-ok' : 'border-2 border-idle',
              )}
            />
            {etatAgent === 'connecte' ? 'Agent connecté' : 'Agent non connecté'}
          </Link>
          {email ? (
            <span className="hidden max-w-48 truncate text-xs text-text-3 lg:block">{email}</span>
          ) : null}
        </div>
      </div>

      {/* Navigation basse sur téléphone : trois entrées, pouce seul. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-void-700 bg-void-900/95 backdrop-blur md:hidden"
        aria-label="Navigation principale"
      >
        {ENTREES.map(({ href, libelle, Icone }) => (
          <Link
            key={href}
            href={href}
            aria-current={actif(href) ? 'page' : undefined}
            className={cn(
              'flex h-14 flex-col items-center justify-center gap-0.5 text-2xs',
              actif(href) ? 'text-arc-cyan' : 'text-text-2',
            )}
          >
            <Icone size={18} strokeWidth={1.8} aria-hidden />
            {libelle}
          </Link>
        ))}
      </nav>
    </header>
  );
}
