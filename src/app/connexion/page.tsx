import Link from 'next/link';
import { CadreAuth } from '@/components/auth/cadre';
import { FormulaireConnexion } from '@/components/auth/formulaires';

export const metadata = { title: 'Connexion' };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;
  return (
    <CadreAuth
      titre="Connexion"
      sous="Reprends là où l’agent s’est arrêté."
      bas={
        <>
          Pas encore de compte ?{' '}
          <Link href={suite ? `/inscription?suite=${encodeURIComponent(suite)}` : '/inscription'} className="text-arc-cyan underline underline-offset-4">
            En créer un
          </Link>
        </>
      }
    >
      <FormulaireConnexion suite={suite} />
    </CadreAuth>
  );
}
