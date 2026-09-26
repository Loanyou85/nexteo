'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import type { AuthState } from '@/server/actions/auth';

function Envoyer({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" taille="bloc" disabled={pending}>
      {pending ? 'Un instant…' : label}
    </Button>
  );
}

export function InscriptionForm({
  action,
}: {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Ton prénom" error={state.champ === 'firstName' ? state.error : undefined}>
        <Input name="firstName" autoComplete="given-name" required minLength={2} />
      </Field>

      <Field label="Ton adresse e-mail" error={state.champ === 'email' ? state.error : undefined}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>

      <Field
        label="Ton mot de passe"
        hint="Au moins huit caractères. Une phrase longue vaut mieux qu’un mot compliqué."
        error={state.champ === 'password' ? state.error : undefined}
      >
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>

      <label className="flex items-start gap-3 text-xs text-encre-2">
        <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 accent-neo-500" />
        <span>
          J’accepte les conditions générales et la politique de confidentialité. Je peux exporter ou
          supprimer mes données à tout moment depuis mon compte.
        </span>
      </label>

      {state.error && !state.champ ? (
        <p role="alert" className="text-sm text-alerte">
          {state.error}
        </p>
      ) : null}

      <Envoyer label="Créer mon compte" />
    </form>
  );
}

export function ConnexionForm({
  action,
  suite,
}: {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  suite?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {suite ? <input type="hidden" name="suite" value={suite} /> : null}

      <Field label="Ton adresse e-mail">
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>

      <Field label="Ton mot de passe">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>

      {state.error ? (
        <p role="alert" className="text-sm text-alerte">
          {state.error}
        </p>
      ) : null}

      <Envoyer label="Me connecter" />
    </form>
  );
}
