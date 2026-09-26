import Link from 'next/link';
import { TopBar } from '@/components/shell/top-bar';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Page introuvable — Nexteo' };

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
        <h1 className="text-xl font-extrabold text-encre">Cette page n’existe pas.</h1>
        <p className="mt-3 text-sm text-encre-2">
          Le lien est peut-être ancien, ou mal recopié. Il n’y a rien à réparer de ton côté.
        </p>
        <Button asChild taille="bloc" className="mt-8">
          <Link href="/">Revenir à l’accueil</Link>
        </Button>
      </main>
    </>
  );
}
