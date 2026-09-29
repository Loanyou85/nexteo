'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Saisie, ZoneTexte } from '@/components/ui/champ';
import { genererPlan, type EtatCreation } from '@/server/actions/projets';

const EXEMPLE = {
  titre: 'Zombie Hospital',
  idee: 'Crée un jeu de survie zombie à 4 joueurs dans un hôpital : 10 manches de plus en plus dures, de l’or à chaque élimination pour s’équiper entre les vagues, et un boss à la manche 10.',
};

function Generer() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" variant="principal" taille="lg" disabled={pending}>
      <Sparkles size={17} strokeWidth={2} aria-hidden />
      {pending ? 'L’agent rédige le plan…' : 'Générer le plan de jeu'}
    </Bouton>
  );
}

export function FormulaireIdee({ restants }: { restants: number | null }) {
  const [etat, action] = useActionState<EtatCreation, FormData>(genererPlan, {});
  const titre = useRef<HTMLInputElement>(null);
  const idee = useRef<HTMLTextAreaElement>(null);

  return (
    <form action={action} className="space-y-5">
      <Champ intitule="Titre" htmlFor="titre" erreur={etat.champ === 'titre' ? etat.erreur : undefined}>
        <Saisie ref={titre} id="titre" name="titre" required minLength={2} maxLength={60} placeholder="Zombie Hospital" />
      </Champ>

      <Champ
        intitule="Ton idée"
        htmlFor="idee"
        aide="Une ou deux phrases suffisent. Le nombre de joueurs, de manches ou le lieu, s’ils sont écrits, sont repris tels quels."
        erreur={etat.champ === 'idee' ? etat.erreur : undefined}
      >
        <ZoneTexte ref={idee} id="idee" name="idee" required minLength={12} maxLength={1200} rows={5} />
      </Champ>

      <button
        type="button"
        onClick={() => {
          if (titre.current) titre.current.value = EXEMPLE.titre;
          if (idee.current) idee.current.value = EXEMPLE.idee;
          idee.current?.focus();
        }}
        className="chanfrein w-full bg-void-700/60 p-3 text-left text-sm text-text-2 transition-colors [--c:8px] hover:bg-void-700 hover:text-text-1"
      >
        <span className="block text-2xs uppercase tracking-wider text-arc-cyan">Exemple — cliquer pour l’utiliser</span>
        <span className="mt-1 block">{EXEMPLE.idee}</span>
      </button>

      {etat.erreur && !etat.champ ? (
        <p role="alert" className="text-sm text-fail">
          {etat.erreur}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Generer />
        <p className="text-xs text-text-3">
          {restants === null
            ? 'Plans de jeu illimités sur ton offre. Générer un plan ne consomme aucun crédit.'
            : `${restants} plan${restants > 1 ? 's' : ''} de jeu restant${restants > 1 ? 's' : ''} ce mois-ci. Générer un plan ne consomme aucun crédit.`}
        </p>
      </div>
    </form>
  );
}
