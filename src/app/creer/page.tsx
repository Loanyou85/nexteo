import { Coque, EnTete } from '@/components/coque/coque';
import { Etapes } from '@/components/creation/etapes';
import { FormulaireIdee } from '@/components/creation/formulaire-idee';
import { Panneau } from '@/components/ui/panneau';
import { requireUser } from '@/server/auth';
import { offreDe, plansDuMois } from '@/server/offre';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Créer un jeu' };

export default async function CreerPage() {
  return (
    <Coque>
      <Contenu />
    </Coque>
  );
}

async function Contenu() {
  const user = await requireUser();
  const offre = await offreDe(user.id);
  const restants =
    offre.plan.monthlyGamePlans === null ? null : Math.max(0, offre.plan.monthlyGamePlans - (await plansDuMois(user.id)));

  return (
    <>
      <EnTete
        avant={<Etapes active={1} />}
        titre="Décris ton jeu"
        sous="L’agent en tire un plan de jeu structuré, que tu corrigeras avant de lancer quoi que ce soit."
      />
      <div className="px-4 pb-12 sm:px-6">
        <Panneau className="max-w-3xl" interieur="p-5 sm:p-7">
          <FormulaireIdee restants={restants} />
        </Panneau>
      </div>
    </>
  );
}
