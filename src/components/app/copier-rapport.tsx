'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Un bouton qui met le rapport dans le presse-papier, pour l'envoyer tel quel. */
export function CopierRapport({ rapport }: { rapport: string }) {
  const [copie, setCopie] = useState(false);

  return (
    <Button
      type="button"
      variant="secondaire"
      taille="bloc"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(rapport);
        } catch {
          return;
        }
        setCopie(true);
        navigator.vibrate?.(10);
        setTimeout(() => setCopie(false), 2000);
      }}
    >
      {copie ? 'Rapport copié' : 'Copier le rapport'}
    </Button>
  );
}
