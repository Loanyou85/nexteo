'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Écran d'erreur.
 *
 * Aucun message technique n'est montré : ni trace d'appels, ni nom de fichier,
 * ni nom de table. Mais on ne laisse jamais quelqu'un devant une page morte
 * non plus — il y a toujours quelque chose à faire, et l'identifiant de
 * l'incident permet de le retrouver dans les journaux.
 */
export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[nexteo]', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
      <h1 className="text-xl font-extrabold text-encre">Ça a coincé de notre côté.</h1>
      <p className="mt-3 text-sm text-encre-2">
        Ta réponse n’a peut-être pas été enregistrée. Réessaie : dans la plupart des cas, ça repart.
      </p>

      <div className="mt-8 space-y-3">
        <Button type="button" taille="bloc" onClick={reset}>
          Réessayer
        </Button>
        <Button asChild taille="bloc" variant="secondaire">
          <Link href="/">Revenir à l’accueil</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="mt-8 text-center font-mono text-xs text-encre-2">
          Incident {error.digest}
        </p>
      ) : null}
    </main>
  );
}
