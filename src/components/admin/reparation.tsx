'use client';

import { useState, useTransition } from 'react';
import { Wrench } from 'lucide-react';
import { Bouton } from '@/components/ui/bouton';
import { reparerBase, type EtatReparation } from '@/server/actions/reparation';

export function BoutonReparation() {
  const [etat, setEtat] = useState<EtatReparation | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <div className="space-y-3">
      <Bouton disabled={enCours} onClick={() => demarrer(async () => setEtat(await reparerBase()))}>
        <Wrench size={16} aria-hidden /> {enCours ? 'Création en cours…' : 'Créer les offres et réglages manquants'}
      </Bouton>
      {etat?.ok ? <p role="status" className="text-sm text-ok">{etat.ok}</p> : null}
      {etat?.erreur ? <p role="alert" className="text-sm text-fail">{etat.erreur}</p> : null}
    </div>
  );
}
