import Link from 'next/link';
import { BanniereSimulation } from '@/components/coque/banniere-simulation';
import { Pied } from '@/components/coque/pied';
import { Logo } from '@/components/marque/logo';
import { Bouton } from '@/components/ui/bouton';
import { sessionOuNull } from '@/server/auth';
import { modes } from '@/server/mode';

/** Coquille des pages publiques : accueil, tarifs, pages légales. */
export async function CoquePublique({ children, cta = true }: { children: React.ReactNode; cta?: boolean }) {
  const [session, m] = [await sessionOuNull(), modes()];
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-void-700/70 bg-void-900/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="Nexteo, accueil">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-text-2 sm:flex" aria-label="Navigation">
            <Link href="/#comment" className="hover:text-text-1">
              Comment ça marche
            </Link>
            <Link href="/tarifs" className="hover:text-text-1">
              Tarifs
            </Link>
            <Link href="/#prerequis" className="hover:text-text-1">
              Prérequis
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {session ? (
              <Bouton asChild taille="sm">
                <Link href="/dashboard">Mes projets</Link>
              </Bouton>
            ) : (
              <>
                <Link href="/connexion" className="text-sm text-text-2 hover:text-text-1">
                  Connexion
                </Link>
                {cta ? (
                  <Bouton asChild taille="sm">
                    <Link href="/inscription">Créer ma map</Link>
                  </Bouton>
                ) : null}
              </>
            )}
          </div>
        </div>
      </header>
      <BanniereSimulation uefn={m.uefn} ia={m.ia} />
      <main className="flex-1">{children}</main>
      <Pied />
    </div>
  );
}
