import Link from 'next/link';
import { Logo } from '@/components/marque/logo';
import { Bouton } from '@/components/ui/bouton';

export const metadata = { title: 'Page introuvable' };

/**
 * 404. Volontairement sans appel à la base ni à la session : une page
 * d'erreur qui dépend de ce qui est peut-être en panne n'affiche rien.
 */
export default function NonTrouvee() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Link href="/" aria-label="Nexteo, accueil">
        <Logo />
      </Link>
      <p className="tabular display text-[96px] leading-none text-text-3">404</p>
      <h1 className="display text-[36px]">Cette page n’existe pas.</h1>
      <p className="max-w-md text-text-2">L’adresse est peut-être mal recopiée, ou la page a déménagé.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Bouton asChild>
          <Link href="/">Retour à l’accueil</Link>
        </Bouton>
        <Bouton asChild variant="secondaire">
          <Link href="/tarifs">Voir les tarifs</Link>
        </Bouton>
      </div>
    </main>
  );
}
