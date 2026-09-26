'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { BellOff, BellRing, FolderPlus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  basculerSuivi,
  creerCollection,
  retirerElement,
  supprimerCollection,
  type Resultat,
} from '@/server/actions/bibliotheque';

/**
 * Boutons de la bibliothèque.
 *
 * Chaque action est un formulaire, pas un `onClick` qui appelle un point
 * d'API : la page continue de fonctionner pendant le chargement du JavaScript,
 * et le rafraîchissement après écriture vient du serveur, donc l'écran ne peut
 * pas afficher un état qui n'existe pas en base.
 */

function Message({ etat }: { etat: Resultat | null }) {
  if (!etat) return null;
  return etat.ok ? (
    <span className="text-2xs text-neo-600">{etat.message}</span>
  ) : (
    <span role="alert" className="text-2xs text-alerte">
      {etat.erreur}
    </span>
  );
}

function EnCours({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <span className={pending ? 'opacity-50' : undefined}>{children}</span>;
}

export function RetirerElement({ savedItemId }: { savedItemId: string }) {
  const [etat, action] = useActionState<Resultat | null, FormData>(retirerElement, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="savedItemId" value={savedItemId} />
      <button
        type="submit"
        title="Retirer de la bibliothèque"
        className="rounded-champ p-1.5 text-encre-2 transition-colors hover:bg-fond hover:text-alerte"
      >
        <EnCours>
          <X size={15} strokeWidth={1.75} aria-hidden />
        </EnCours>
        <span className="sr-only">Retirer de la bibliothèque</span>
      </button>
      <Message etat={etat} />
    </form>
  );
}

export function CreerCollection() {
  const [etat, action] = useActionState<Resultat | null, FormData>(creerCollection, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Input
        name="name"
        required
        maxLength={60}
        placeholder="Nom de la collection"
        aria-label="Nom de la collection"
        className="h-11 w-full max-w-xs text-sm"
      />
      <Button type="submit" taille="sm" variant="secondaire">
        <FolderPlus size={15} strokeWidth={1.75} aria-hidden />
        Créer
      </Button>
      <Message etat={etat} />
    </form>
  );
}

export function SupprimerCollection({ collectionId, nom }: { collectionId: string; nom: string }) {
  const [etat, action] = useActionState<Resultat | null, FormData>(supprimerCollection, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="collectionId" value={collectionId} />
      <button
        type="submit"
        title={`Supprimer la collection ${nom}`}
        className="rounded-champ p-1.5 text-encre-2 transition-colors hover:bg-fond hover:text-alerte"
      >
        <EnCours>
          <Trash2 size={15} strokeWidth={1.75} aria-hidden />
        </EnCours>
        <span className="sr-only">Supprimer la collection {nom}</span>
      </button>
      <Message etat={etat} />
    </form>
  );
}

export function BasculerSuivi({ advertiserId, suivi }: { advertiserId: string; suivi: boolean }) {
  const [etat, action] = useActionState<Resultat | null, FormData>(basculerSuivi, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="advertiserId" value={advertiserId} />
      <Button type="submit" taille="xs" variant={suivi ? 'secondaire' : 'principal'}>
        {suivi ? (
          <>
            <BellOff size={14} strokeWidth={1.75} aria-hidden />
            Ne plus suivre
          </>
        ) : (
          <>
            <BellRing size={14} strokeWidth={1.75} aria-hidden />
            Suivre
          </>
        )}
      </Button>
      <Message etat={etat} />
    </form>
  );
}
