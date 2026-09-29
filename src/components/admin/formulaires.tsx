'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Bouton } from '@/components/ui/bouton';
import { Saisie } from '@/components/ui/champ';
import { ajusterSoldeUtilisateur, modifierOffre, modifierReglage, type EtatAdmin } from '@/server/actions/admin';

function Enregistrer({ texte = 'Enregistrer' }: { texte?: string }) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" taille="sm" disabled={pending}>
      {pending ? '…' : texte}
    </Bouton>
  );
}

function Retour({ etat }: { etat: EtatAdmin }) {
  if (etat.erreur) return <p role="alert" className="text-xs text-fail">{etat.erreur}</p>;
  if (etat.ok) return <p className="text-xs text-ok">{etat.ok}</p>;
  return null;
}

const eur = (c: number | null) => (c === null ? '' : (c / 100).toFixed(2).replace('.', ','));

export function FormulaireOffre({ p }: { p: { id: string; name: string; monthlyPriceCents: number; annualPriceCents: number | null; monthlyCredits: number; maxProjects: number | null; monthlyGamePlans: number | null; isActive: boolean } }) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(modifierOffre.bind(null, p.id), {});
  return (
    <form action={action} className="grid items-end gap-2 sm:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
      <label className="text-2xs text-text-3">
        Mensuel (€)
        <Saisie name="mensuel" defaultValue={eur(p.monthlyPriceCents)} className="tabular mt-1 h-9" />
      </label>
      <label className="text-2xs text-text-3">
        Annuel (€)
        <Saisie name="annuel" defaultValue={eur(p.annualPriceCents)} className="tabular mt-1 h-9" />
      </label>
      <label className="text-2xs text-text-3">
        Crédits / mois
        <Saisie name="credits" type="number" defaultValue={p.monthlyCredits} className="tabular mt-1 h-9" />
      </label>
      <label className="text-2xs text-text-3">
        Projets (vide = ∞)
        <Saisie name="projets" type="number" defaultValue={p.maxProjects ?? ''} className="tabular mt-1 h-9" />
      </label>
      <label className="text-2xs text-text-3">
        Plans / mois (vide = ∞)
        <Saisie name="plans" type="number" defaultValue={p.monthlyGamePlans ?? ''} className="tabular mt-1 h-9" />
      </label>
      <div className="flex items-center gap-3 pb-1">
        <label className="flex items-center gap-1.5 text-xs text-text-2">
          <input type="checkbox" name="actif" defaultChecked={p.isActive} className="accent-arc-blue" /> active
        </label>
        <Enregistrer />
      </div>
      <div className="sm:col-span-6">
        <Retour etat={etat} />
      </div>
    </form>
  );
}

export function FormulaireReglage({ cle, valeur, libelle }: { cle: string; valeur: string; libelle: string }) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(modifierReglage.bind(null, cle), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="text-2xs text-text-3">
        {libelle}
        <Saisie name="valeur" type="number" defaultValue={valeur} className="tabular mt-1 h-9 w-32" />
      </label>
      <Enregistrer />
      <Retour etat={etat} />
    </form>
  );
}

export function FormulaireAjustement() {
  const [etat, action] = useActionState<EtatAdmin, FormData>(ajusterSoldeUtilisateur, {});
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[minmax(0,1.3fr)_110px_minmax(0,2fr)_auto] sm:items-end">
      <label className="text-2xs text-text-3">
        E-mail du compte
        <Saisie name="email" type="email" required className="mt-1 h-9" />
      </label>
      <label className="text-2xs text-text-3">
        Crédits (±)
        <Saisie name="delta" type="number" required className="tabular mt-1 h-9" />
      </label>
      <label className="text-2xs text-text-3">
        Motif (obligatoire, conservé au registre)
        <Saisie name="note" required minLength={3} className="mt-1 h-9" />
      </label>
      <Enregistrer texte="Ajuster" />
      <div className="sm:col-span-4">
        <Retour etat={etat} />
      </div>
    </form>
  );
}
