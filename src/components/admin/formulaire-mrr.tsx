'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { enregistrerMrrDeclare, oublierMrrDeclare, type ResultatMrr } from '@/server/actions/mrr';

/**
 * Saisie d'un MRR déclaré, une ligne à la fois.
 *
 * Le formulaire est posé dans la ligne de l'annonceur et non dans une boîte de
 * dialogue : la saisie se fait en série, sur vingt entreprises d'affilée, et
 * ouvrir puis fermer une fenêtre à chaque fois doublerait le nombre de gestes.
 *
 * Les trois champs partent ensemble. Un montant sans sa source ne veut rien
 * dire, donc le serveur refuse — mieux vaut un refus qu'un chiffre orphelin.
 */

function Envoyer({ enfant }: { enfant: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" taille="xs" disabled={pending}>
      {pending ? 'Enregistrement…' : enfant}
    </Button>
  );
}

function Oublier() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" taille="xs" variant="danger" disabled={pending} title="Retirer ce montant">
      <Trash2 size={14} strokeWidth={1.75} aria-hidden />
      <span className="sr-only">Retirer le montant déclaré</span>
    </Button>
  );
}

const jourIso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

export function FormulaireMrr({
  advertiserId,
  montantCents,
  source,
  releveLe,
}: {
  advertiserId: string;
  montantCents: number | null;
  source: string | null;
  releveLe: Date | null;
}) {
  const [etat, action] = useActionState<ResultatMrr | null, FormData>(enregistrerMrrDeclare, null);
  const [etatOubli, actionOubli] = useActionState<ResultatMrr | null, FormData>(
    oublierMrrDeclare,
    null,
  );

  const message = etatOubli ?? etat;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="advertiserId" value={advertiserId} />

          <label className="block">
            <span className="block text-2xs text-encre-2">€ / mois</span>
            <Input
              name="montantEuros"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              required
              defaultValue={montantCents != null ? String(montantCents / 100) : ''}
              placeholder="12000"
              className="tabular h-9 w-28 text-sm"
            />
          </label>

          <label className="block min-w-0 flex-1">
            <span className="block text-2xs text-encre-2">Lien vers la publication</span>
            <Input
              name="source"
              type="url"
              required
              defaultValue={source ?? ''}
              placeholder="https://…"
              className="h-9 w-full min-w-48 text-sm"
            />
          </label>

          <label className="block">
            <span className="block text-2xs text-encre-2">Date du relevé</span>
            <Input
              name="releveLe"
              type="date"
              required
              max={jourIso(new Date())}
              defaultValue={jourIso(releveLe)}
              className="h-9 w-40 text-sm"
            />
          </label>

          <Envoyer enfant={montantCents != null ? 'Corriger' : 'Enregistrer'} />
        </form>

        {montantCents != null ? (
          <form action={actionOubli}>
            <input type="hidden" name="advertiserId" value={advertiserId} />
            <Oublier />
          </form>
        ) : null}
      </div>

      {message ? (
        message.ok ? (
          <p className="flex items-center gap-1.5 text-2xs text-neo-600">
            <Check size={13} strokeWidth={2} aria-hidden />
            {message.nom} : enregistré.
          </p>
        ) : (
          <p role="alert" className="text-2xs text-alerte">
            {message.erreur}
          </p>
        )
      ) : null}
    </div>
  );
}
