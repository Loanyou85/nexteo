import Link from 'next/link';
import { TopBar } from '@/components/shell/top-bar';
import { Button } from '@/components/ui/button';
import { ConnexionForm } from '@/components/auth/auth-form';
import { connecter } from '@/server/actions/auth';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Me connecter — Nexteo' };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;
  return (
    <>
      <TopBar sansAction />
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-xl font-extrabold text-encre">Content de te revoir.</h1>
        <div className="mt-8">
          <ConnexionForm action={connecter} suite={suite} />
        </div>
        <div className="mt-8 border-t border-bordure pt-6">
          <p className="text-center text-sm text-encre-2">Pas encore de compte ?</p>
          <Button asChild variant="secondaire" taille="bloc" className="mt-4">
            <Link href="/inscription">Créer un compte</Link>
          </Button>
          <p className="mt-4 text-center text-xs text-encre-2">
            Tu peux aussi{' '}
            <Link href="/diagnostic" className="text-neo-600 underline underline-offset-4">
              trouver ton idée d’abord
            </Link>{' '}
            — le diagnostic ne demande aucune inscription.
          </p>
        </div>
      </main>
    </>
  );
}
