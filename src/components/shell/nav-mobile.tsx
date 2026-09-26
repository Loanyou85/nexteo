'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Navigation basse à cinq entrées (section 6.9). Visible sous 768 px
 * seulement : au-dessus, c'est la barre du haut qui sert.
 */
const ENTREES = [
  { href: '/', libelle: 'Accueil' },
  { href: '/explore', libelle: 'Explorer' },
  { href: '/collections', libelle: 'Collections' },
  { href: '/tarifs', libelle: 'Tarifs' },
  { href: '/dashboard', libelle: 'Profil' },
] as const;

export function NavMobile() {
  const chemin = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-bordure bg-surface md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Navigation principale"
    >
      <ul className="grid grid-cols-5">
        {ENTREES.map((e) => {
          const actif = e.href === '/' ? chemin === '/' : chemin.startsWith(e.href);
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                aria-current={actif ? 'page' : undefined}
                className={cn(
                  'flex h-14 items-center justify-center text-2xs font-medium transition-colors',
                  actif ? 'text-neo-600' : 'text-encre-2',
                )}
              >
                {e.libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
