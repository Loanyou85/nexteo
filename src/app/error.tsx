'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Logo } from '@/components/marque/logo';
import { Bouton } from '@/components/ui/bouton';

/**
 * Erreur inattendue dans une page. Le visiteur ne voit ni message technique ni
 * trace : seulement une référence (`digest`) qu'il peut nous transmettre et
 * qui retrouve l'erreur dans les journaux du serveur.
 */
export default function ErreurPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Link href="/" aria-label="Nexteo, accueil">
        <Logo />
      </Link>
      <h1 className="display text-[36px]">Quelque chose s’est mal passé.</h1>
      <p className="max-w-md text-text-2">Ce n’est pas ta faute. Rien de ce que tu as saisi n’a été perdu ni facturé par cette erreur.</p>
      {error.digest ? <p className="tabular text-xs text-text-3">Référence : {error.digest}</p> : null}
      <div className="flex flex-wrap justify-center gap-3">
        <Bouton onClick={reset}>Réessayer</Bouton>
        <Bouton asChild variant="secondaire">
          <Link href="/">Retour à l’accueil</Link>
        </Bouton>
      </div>
    </main>
  );
}
