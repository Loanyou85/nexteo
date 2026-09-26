import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Écran d'abonnement requis.
 *
 * Il ne floute rien. Un contenu flouté laisse croire qu'on cache peu de
 * chose, et personne ne paie pour lever un flou : on annonce donc ce qu'il y a
 * derrière, chiffres réels à l'appui, et on s'arrête là.
 *
 * Aucun compte à rebours, aucune rareté inventée. La résiliation en deux clics
 * est écrite sous le bouton, parce que c'est ce qui lève le doute au moment de
 * décider.
 */
export function AbonnementRequis({
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
    <div className="rounded-card border border-bordure bg-fond p-6 sm:p-8">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-card bg-neo-100">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-neo-600" aria-hidden>
          <path
            d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <p className="mt-5 text-center text-base font-semibold text-encre">
        La fiche complète demande un abonnement.
      </p>

      <p className="mx-auto mt-3 max-w-lg text-center text-sm text-encre-2">
        {mois > 0
          ? `${nom} diffuse depuis ${mois} mois.`
          : `${nom} n’a plus d’annonce en diffusion.`}{' '}
        Nexteo a archivé {annonces} de ses annonces
        {retirees > 0 ? `, dont ${retirees} que Meta a déjà supprimées` : ''}.
      </p>

      <ul className="mx-auto mt-6 max-w-md space-y-1.5 text-sm text-encre">
        {[
          'La chronologie de diffusion, interruptions comprises',
          'Le détail du signal, composante par composante',
          'Toutes les accroches et les pages de destination',
          'Les annonces retirées par Meta, introuvables ailleurs',
          'Les annonceurs proches',
        ].map((l) => (
          <li key={l} className="flex gap-2">
            <span aria-hidden className="text-neo-500">
              ·
            </span>
            {l}
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild taille="md">
          <Link href="/tarifs">Voir les offres</Link>
        </Button>
        {connecte ? null : (
          <Button asChild taille="md" variant="secondaire">
            <Link href="/connexion">J’ai déjà un compte</Link>
          </Button>
        )}
      </div>

      <p className="mt-4 text-center text-2xs text-encre-2">
        Résiliation en deux clics depuis le portail Stripe. Aucun engagement.
      </p>
    </div>
  );
}
