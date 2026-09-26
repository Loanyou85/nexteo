import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FICHES_GRATUITES_PAR_MOIS } from '@/lib/plans';

/**
 * Mur payant (section 9.2).
 *
 * Il apparaît au moment où la valeur est évidente, jamais avant — et il
 * commence par dire ce qu'il y a derrière, chiffres réels à l'appui. Aucun
 * compte à rebours, aucune rareté inventée : la résiliation tient en deux
 * clics et c'est écrit ici.
 */
export function MurPayant({
  nom,
  mois,
  annonces,
  retirees,
  connecte,
}: {
  nom: string;
  mois: number;
  annonces: number;
  retirees: number;
  connecte: boolean;
}) {
  return (
    <div className="rounded-card border border-neo-500/40 bg-neo-100/40 p-6">
      <p className="text-base font-semibold text-encre">
        {mois > 0
          ? `${nom} diffuse depuis ${mois} mois.`
          : `${nom} n’a plus d’annonce en diffusion.`}{' '}
        Nexteo a archivé {annonces} de ses annonces
        {retirees > 0 ? `, dont ${retirees} que Meta a déjà supprimées` : ''}.
      </p>

      <p className="mt-2 max-w-xl text-sm text-encre-2">
        Tu as utilisé tes {FICHES_GRATUITES_PAR_MOIS} fiches complètes du mois. Un abonnement ouvre
        les fiches sans limite, la chronologie de diffusion et les annonces que Meta a retirées de
        son archive — celles-là ne sont plus consultables ailleurs.
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button asChild taille="md">
          <Link href="/tarifs">Voir les offres</Link>
        </Button>
        {connecte ? null : (
          <Button asChild taille="md" variant="secondaire">
            <Link href="/connexion">J’ai déjà un compte</Link>
          </Button>
        )}
      </div>

      <p className="mt-4 text-2xs text-encre-2">
        Résiliation en deux clics depuis le portail Stripe. Aucun engagement.
      </p>
    </div>
  );
}
