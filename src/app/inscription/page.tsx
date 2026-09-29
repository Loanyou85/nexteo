import Link from 'next/link';
import { CadreAuth } from '@/components/auth/cadre';
import { FormulaireInscription } from '@/components/auth/formulaires';

export const metadata = { title: 'Créer un compte' };

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;
  return (
    <CadreAuth
      titre="Créer un compte"
      sous="Le plan de jeu est gratuit. Les builds réels demandent une offre payante : chacun coûte des appels d’IA."
      bas={
        <>
          Déjà un compte ?{' '}
          <Link href={suite ? `/connexion?suite=${encodeURIComponent(suite)}` : '/connexion'} className="text-arc-cyan underline underline-offset-4">
            Se connecter
          </Link>
        </>
      }
    >
      <FormulaireInscription suite={suite} />
    </CadreAuth>
  );
}
