'use client';

import { useTransition } from 'react';
import { Bouton } from '@/components/ui/bouton';
import { restaurerVersion } from '@/server/actions/projets';

export function BoutonRestaurer({ projectId, version }: { projectId: string; version: number }) {
  const [enCours, demarrer] = useTransition();
  return (
    <Bouton taille="sm" variant="fantome" disabled={enCours} onClick={() => demarrer(() => restaurerVersion(projectId, version))}>
      {enCours ? 'Restauration…' : 'Restaurer'}
    </Bouton>
  );
}
