import Link from 'next/link';
import { TopBar } from '@/components/shell/top-bar';
import { InscriptionForm } from '@/components/auth/auth-form';
import { inscrire } from '@/server/actions/auth';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Créer mon compte — Nexteo' };

export default function InscriptionPage() {
  return (
    <>
      <TopBar sansAction />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-xl">Crée ton compte.</h1>
        <p className="mt-2 text-sm text-encre-2">
          Prénom, adresse, mot de passe. Rien d’autre. La recherche et la liste des annonceurs
          restent accessibles sans compte.
        </p>

        <div className="mt-8">
          <InscriptionForm action={inscrire} />
        </div>

        <p className="mt-6 text-center text-sm text-encre-2">
          Tu as déjà un compte ?{' '}
          <Link href="/connexion" className="text-neo-600 underline underline-offset-4">
            Connecte-toi
          </Link>
        </p>
      </main>
    </>
  );
}
