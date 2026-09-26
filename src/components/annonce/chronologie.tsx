import { cn } from '@/lib/utils';
import type { BandeChronologie } from '@/server/annonceur-fiche';

/**
 * Chronologie de diffusion : la visualisation signature du produit.
 *
 * Une bande par annonce, posée sur la fenêtre observée. Ce qu'on vient y
 * chercher, ce sont les trous — une entreprise qui coupe puis reprend n'a pas
 * le même comportement que celle qui n'a jamais arrêté. Une moyenne ou un
 * compteur effaceraient exactement ça.
 *
 * Violet quand l'annonce tourne encore, gris quand elle est arrêtée. Jamais
 * de vert, et aucun axe monétaire.
 */

function mois(debut: Date, fin: Date): { libelle: string; gauche: number }[] {
  const etendue = Math.max(1, fin.getTime() - debut.getTime());
  const reperes: { libelle: string; gauche: number }[] = [];
  const curseur = new Date(debut.getFullYear(), debut.getMonth(), 1);

  // Au-delà de dix-huit mois on n'étiquette qu'un mois sur trois : sinon les
  // libellés se chevauchent et plus rien n'est lisible.
  const total = (fin.getFullYear() - debut.getFullYear()) * 12 + fin.getMonth() - debut.getMonth();
  const pas = total > 18 ? 3 : total > 9 ? 2 : 1;

  let i = 0;
  while (curseur <= fin) {
    if (curseur >= debut && i % pas === 0) {
      reperes.push({
        libelle: curseur.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        gauche: ((curseur.getTime() - debut.getTime()) / etendue) * 100,
      });
    }
    curseur.setMonth(curseur.getMonth() + 1);
    i += 1;
  }
  return reperes;
}

export function Chronologie({
  bandes,
  debut,
  fin,
}: {
  bandes: BandeChronologie[];
  debut: Date;
  fin: Date;
}) {
  if (bandes.length === 0) {
    return <p className="text-sm text-encre-2">Aucune annonce archivée pour cet annonceur.</p>;
  }

  const reperes = mois(debut, fin);
  const dateCourte = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <figure className="overflow-x-auto">
      <div className="min-w-[560px]">
        {/* Repères temporels */}
        <div className="relative mb-2 h-4 border-b border-bordure">
          {reperes.map((r) => (
            <span
              key={r.libelle + r.gauche}
              className="absolute -translate-x-1/2 text-2xs text-encre-2"
              style={{ left: `${r.gauche}%` }}
            >
              {r.libelle}
            </span>
          ))}
        </div>

        <ul className="space-y-1">
          {bandes.map((b) => (
            <li key={b.id} className="relative h-3.5">
              <div
                className={cn(
                  'absolute top-0 h-full rounded-capsule',
                  b.active ? 'bg-actif' : 'bg-arrete/45',
                  // Une annonce retirée par Meta se distingue : c'est elle
                  // qu'on ne peut plus trouver ailleurs.
                  b.retiree && 'ring-1 ring-neo-500/60',
                )}
                style={{ left: `${b.gauche}%`, width: `${b.largeur}%` }}
                title={`${b.titre} — du ${dateCourte(b.debut)} ${
                  b.fin ? `au ${dateCourte(b.fin)}` : '(en cours)'
                }${b.retiree ? ' — retirée de l’archive Meta' : ''}`}
              />
            </li>
          ))}
        </ul>
      </div>

      <figcaption className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-2xs text-encre-2">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-5 rounded-capsule bg-actif" /> En diffusion
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-5 rounded-capsule bg-arrete/45" /> Arrêtée
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-5 rounded-capsule bg-arrete/45 ring-1 ring-neo-500/60" />
          Retirée par Meta, conservée ici
        </span>
      </figcaption>
    </figure>
  );
}
