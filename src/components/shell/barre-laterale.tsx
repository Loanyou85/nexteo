'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bookmark,
  Coins,
  Globe,
  Megaphone,
  Search,
  Settings2,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

/**
 * Barre latérale bleu nuit.
 *
 * Visible en permanence au-dessus de 1024 px : c'est un outil de travail, on
 * passe d'une section à l'autre sans arrêt, et un menu qu'il faut ouvrir coûte
 * un geste à chaque fois. En dessous, la barre basse à cinq entrées prend le
 * relais — une colonne de 272 px ne laisserait rien au contenu sur un
 * téléphone.
 */

type Entree = { href: string; libelle: string; Icone: LucideIcon; cle?: 'annonceurs' | 'annonces' };

const ENTREES: Entree[] = [
  { href: '/explore', libelle: 'Recherche', Icone: Search },
  { href: '/annonceurs', libelle: 'Annonceurs', Icone: Globe, cle: 'annonceurs' },
  { href: '/annonces', libelle: 'Annonces', Icone: Megaphone, cle: 'annonces' },
  { href: '/opportunites', libelle: 'Signaux de marché', Icone: Sparkles },
  { href: '/collections', libelle: 'Collections', Icone: Bookmark },
  { href: '/dashboard', libelle: 'Annonceurs suivis', Icone: Users },
];

export function BarreLaterale({
  compteurs,
  admin,
}: {
  compteurs?: { annonceurs?: number; annonces?: number };
  admin?: boolean;
}) {
  const chemin = usePathname();
  const estActif = (href: string) => chemin === href || chemin.startsWith(`${href}/`);

  return (
    <nav className="flex-1 px-3" aria-label="Navigation principale">
      <div className="px-3 pb-6 pt-1">
        <Link href="/" aria-label="Nexteo, accueil">
          <Logo variant="nuit" />
        </Link>
      </div>

      <ul className="space-y-0.5">
        {ENTREES.map(({ href, libelle, Icone, cle }) => {
          const actif = estActif(href);
          const compteur = cle ? compteurs?.[cle] : undefined;
          return (
            <li key={href}>
              <Link
                href={href}
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
                    className="absolute left-0 top-2.5 h-6 w-[3px] rounded-capsule bg-neo-500"
                  />
                ) : null}
                <Icone size={18} strokeWidth={1.75} className="shrink-0" aria-hidden />
                <span className="truncate">{libelle}</span>
                {typeof compteur === 'number' ? (
                  <span className="tabular ml-auto rounded-capsule bg-nuit-3 px-2 py-0.5 text-2xs text-nuit-encre-2">
                    {compteur.toLocaleString('fr-FR')}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {admin ? (
        <>
          <hr className="my-3 border-nuit-3/70" />
          {[
            { href: '/admin', libelle: 'Supervision', Icone: Settings2 },
            { href: '/admin/mrr', libelle: 'Saisir les MRR', Icone: Coins },
          ].map(({ href, libelle, Icone }) => (
            <Link
              key={href}
              href={href}
              // Comparaison exacte : /admin est le préfixe de /admin/mrr, et
              // `startsWith` allumerait les deux entrées à la fois.
              aria-current={chemin === href ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded-champ px-3 text-sm transition-colors',
                chemin === href
                  ? 'bg-nuit-2 font-medium text-nuit-encre'
                  : 'text-nuit-encre-2 hover:bg-nuit-2/60 hover:text-nuit-encre',
              )}
            >
              <Icone size={18} strokeWidth={1.75} className="shrink-0" aria-hidden />
              {libelle}
            </Link>
          ))}
        </>
      ) : null}
    </nav>
  );
}
