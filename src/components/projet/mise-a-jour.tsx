'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { RefreshCw } from 'lucide-react';
import { Bouton } from '@/components/ui/bouton';
import { ZoneTexte } from '@/components/ui/champ';
import { demanderMiseAJour, type EtatMiseAJour } from '@/server/actions/mise-a-jour';

function Envoyer() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" variant="principal" disabled={pending}>
      <RefreshCw size={15} aria-hidden />
      {pending ? 'Traduction en plan…' : 'Préparer la mise à jour'}
    </Bouton>
  );
}

export function FormulaireMiseAJour({ projectId }: { projectId: string }) {
  const [etat, action] = useActionState<EtatMiseAJour, FormData>(demanderMiseAJour.bind(null, projectId), {});
  return (
    <form action={action} className="space-y-3">
      <ZoneTexte
        name="demande"
        rows={3}
        required
        minLength={6}
        maxLength={600}
        placeholder="Ajoute un boss à la vague 10. Rends les zombies plus rapides."
        aria-label="Modification demandée"
      />
      {etat.erreur ? (
        <p role="alert" className="text-sm text-fail">
          {etat.erreur}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Envoyer />
        <p className="text-xs text-text-3">Tu relis le plan modifié avant de lancer. Seuls les modules concernés seront reconstruits.</p>
      </div>
    </form>
  );
}
