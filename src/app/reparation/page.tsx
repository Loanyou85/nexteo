import Link from 'next/link';
import { BoutonReparation } from '@/components/admin/reparation';
import { Logo } from '@/components/marque/logo';
import { Panneau } from '@/components/ui/panneau';
import { requireAdmin } from '@/server/auth';
import { db } from '@/server/db';

export const dynamic = 'force-dynamic';
// Le semis enchaîne plusieurs dizaines de requêtes : on lui laisse le temps.
export const maxDuration = 60;
export const metadata = { title: 'Réparation de la base', robots: { index: false } };

/**
 * Volontairement sans la coque habituelle : celle-ci vérifie que la base est
 * prête, et cette page sert justement quand elle ne l'est pas.
 */
export default async function ReparationPage() {
  await requireAdmin();
  const comptes = async () => {
    try {
      const [offres, reglages, devices, modeles] = await Promise.all([
        db.plan.count(),
        db.pricingConfig.count(),
        db.deviceDefinition.count(),
        db.gameTemplate.count(),
      ]);
      return { offres, reglages, devices, modeles, erreur: null as string | null };
    } catch (e) {
      return { offres: 0, reglages: 0, devices: 0, modeles: 0, erreur: String((e as Error).message).split('\n').pop() ?? 'lecture impossible' };
    }
  };
  const c = await comptes();

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-12">
      <Link href="/" aria-label="Nexteo, accueil">
        <Logo />
      </Link>
      <Panneau interieur="p-6">
        <h1 className="display text-[30px]">Réparer la base</h1>
        <p className="mt-2 text-sm text-text-2">
          Crée les offres, les réglages chiffrés, les devices et les modèles qui manquent. Rien n’est effacé ni modifié : un prix que tu as
          changé reste tel quel.
        </p>
        <dl className="tabular mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-text-2">Offres</dt>
          <dd className={c.offres === 0 ? 'text-fail' : 'text-text-1'}>{c.offres}</dd>
          <dt className="text-text-2">Réglages chiffrés</dt>
          <dd className={c.reglages === 0 ? 'text-fail' : 'text-text-1'}>{c.reglages}</dd>
          <dt className="text-text-2">Devices du catalogue</dt>
          <dd className="text-text-1">{c.devices}</dd>
          <dt className="text-text-2">Modèles de map</dt>
          <dd className="text-text-1">{c.modeles}</dd>
        </dl>
        {c.erreur ? <p className="mt-4 text-sm text-fail">Lecture impossible : {c.erreur}</p> : null}
        <div className="mt-6">
          <BoutonReparation />
        </div>
      </Panneau>
      <p className="text-center text-xs text-text-3">
        <Link href="/admin" className="underline underline-offset-4">
          Administration
        </Link>
        {' · '}
        <Link href="/api/sante?stripe=1" className="underline underline-offset-4">
          Vérifier la configuration
        </Link>
      </p>
    </main>
  );
}
