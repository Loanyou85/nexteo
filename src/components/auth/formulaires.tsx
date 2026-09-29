'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Saisie } from '@/components/ui/champ';
import { connecter, inscrire, type AuthState } from '@/server/actions/auth';

function Envoyer({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" variant="principal" taille="lg" className="w-full" disabled={pending}>
      {pending ? 'Un instant…' : children}
    </Bouton>
  );
}

export function FormulaireInscription({ suite }: { suite?: string }) {
  const [etat, action] = useActionState<AuthState, FormData>(inscrire, {});
  return (
    <form action={action} className="space-y-4">
      {suite ? <input type="hidden" name="suite" value={suite} /> : null}
      <Champ intitule="Prénom" htmlFor="firstName" erreur={etat.champ === 'firstName' ? etat.error : undefined}>
        <Saisie id="firstName" name="firstName" autoComplete="given-name" required minLength={2} />
      </Champ>
      <Champ intitule="E-mail" htmlFor="email" erreur={etat.champ === 'email' ? etat.error : undefined}>
        <Saisie id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Champ>
      <Champ
        intitule="Mot de passe"
        htmlFor="password"
        aide="Huit caractères au moins. Une phrase vaut mieux qu’un mot compliqué."
        erreur={etat.champ === 'password' ? etat.error : undefined}
      >
        <Saisie id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Champ>
      <label className="flex items-start gap-3 text-xs leading-relaxed text-text-2">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-arc-blue" />
        <span>
          J’accepte la{' '}
          <Link href="/legal/confidentialite" className="text-arc-cyan underline underline-offset-4">
            politique de confidentialité
          </Link>
          , qui précise notamment que le code Verse de mes projets est transmis au fournisseur d’IA
          pour être généré et corrigé.
        </span>
      </label>
      {etat.error && !etat.champ ? (
        <p role="alert" className="text-sm text-fail">
          {etat.error}
        </p>
      ) : null}
      <Envoyer>Créer mon compte</Envoyer>
    </form>
  );
}

export function FormulaireConnexion({ suite }: { suite?: string }) {
  const [etat, action] = useActionState<AuthState, FormData>(connecter, {});
  return (
    <form action={action} className="space-y-4">
      {suite ? <input type="hidden" name="suite" value={suite} /> : null}
      <Champ intitule="E-mail" htmlFor="email">
        <Saisie id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Champ>
      <Champ intitule="Mot de passe" htmlFor="password">
        <Saisie id="password" name="password" type="password" autoComplete="current-password" required />
      </Champ>
      {etat.error ? (
        <p role="alert" className="text-sm text-fail">
          {etat.error}
        </p>
      ) : null}
      <Envoyer>Se connecter</Envoyer>
    </form>
  );
}
