import { domaineValide } from '@/lib/logo';

/**
 * Logo d'un annonceur.
 *
 * L'image passe toujours par la route de Nexteo, jamais par le site de
 * l'annonceur ni par un service tiers : le navigateur du visiteur ne parle
 * qu'à un seul domaine. La route rend toujours quelque chose, donc pas besoin
 * de gérer un état d'échec ici.
 */
export function LogoAnnonceur({
  nom,
  domaine,
  taille = 40,
  className,
}: {
  nom: string;
  domaine: string | null;
  taille?: number;
  className?: string;
}) {
  const cible = domaine && domaineValide(domaine) ? domaine : 'sans-domaine.invalid';

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/logo/${encodeURIComponent(cible)}?nom=${encodeURIComponent(nom)}`}
      alt=""
      width={taille}
      height={taille}
      loading="lazy"
      decoding="async"
      className={className ?? 'rounded-champ border border-bordure bg-surface object-contain'}
      style={{ width: taille, height: taille }}
    />
  );
}
