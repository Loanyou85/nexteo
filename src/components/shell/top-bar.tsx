import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

/**
 * En-tête, commune aux deux territoires.
 *
 * Les couleurs viennent des tokens de surface : elle suit la teinte du
 * document sans variante à maintenir.
 *
 * La navigation est masquée sous 768 px : sur téléphone, c'est la barre basse
 * à cinq entrées qui sert (section 6.9).
 */
const LIENS = [
  { href: '/explore', libelle: 'Explorer' },
  { href: '/tarifs', libelle: 'Tarifs' },
] as const;

export function TopBar({
  sansAction,
  connecte,
}: {
  sansAction?: boolean;
  connecte?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-bordure bg-fond/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" aria-label="Nexteo, accueil">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {LIENS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-encre-2 transition-colors hover:text-encre"
            >
              {l.libelle}
            </Link>
          ))}
        </nav>

        {sansAction ? null : (
          <div className="ml-auto">
            <Button asChild taille="sm" variant={connecte ? 'secondaire' : 'principal'}>
              <Link href={connecte ? '/dashboard' : '/connexion'}>
                {connecte ? 'Mon tableau de bord' : 'Se connecter'}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
