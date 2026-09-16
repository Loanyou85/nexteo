import Link from 'next/link';
import { TopBar } from '@/components/shell/top-bar';
import { InscriptionForm } from '@/components/auth/auth-form';
import { inscrire } from '@/server/actions/auth';
import { db } from '@/server/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Créer mon compte — Nexteo' };

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ idee?: string }>;
}) {
  const { idee } = await searchParams;
  const idea = idee ? await db.idea.findUnique({ where: { id: idee }, select: { title: true } }) : null;

  return (
    <>
      <TopBar sansAction />
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-xl font-extrabold text-white">
          {idea ? 'Un compte pour garder ton idée.' : 'Crée ton compte.'}
        </h1>
        <p className="mt-2 text-sm text-gris-300">
          {idea
            ? `On garde « ${idea.title} » et tout ce que tu as répondu. Trente secondes.`
            : 'Prénom, adresse, mot de passe. Rien d’autre. Tu choisiras ton idée ensuite.'}
        </p>

        <div className="mt-8">
          <InscriptionForm action={inscrire} ideaId={idee} />
        </div>

        <p className="mt-6 text-center text-sm text-gris-300">
          Tu as déjà un compte ?{' '}
          <Link href="/connexion" className="text-neo-100 underline underline-offset-4">
            Connecte-toi
          </Link>
        </p>
      </main>
    </>
  );
}
