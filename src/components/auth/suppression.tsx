'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Bouton } from '@/components/ui/bouton';
import { Saisie } from '@/components/ui/champ';
import { supprimerMonCompte, type EtatSuppression } from '@/server/actions/compte';

function Supprimer() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" variant="danger" disabled={pending}>
      {pending ? 'Suppression…' : 'Supprimer définitivement mon compte'}
    </Bouton>
  );
}

export function FormulaireSuppression({ email }: { email: string }) {
  const [etat, action] = useActionState<EtatSuppression, FormData>(supprimerMonCompte, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm text-text-2">
        Recopie <span className="font-mono text-text-1">{email}</span> pour confirmer :
        <Saisie name="confirmation" autoComplete="off" required className="mt-2 max-w-sm" />
      </label>
      {etat.erreur ? <p role="alert" className="text-sm text-fail">{etat.erreur}</p> : null}
      <Supprimer />
    </form>
  );
}
