import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { BadgePalier, BarrePalier } from '@/components/ui/palier';
import { Bouton } from '@/components/ui/bouton';
import { dateCourte } from '@/lib/format';
import { PALIERS, estPalier, type Palier } from '@/lib/palier';

const GENRES: Record<string, string> = {
  zombie_survival: 'Survie zombie',
  gun_game: 'Gun Game',
  tycoon: 'Tycoon',
  racing: 'Course',
  horror: 'Horreur',
  pvp_arena: 'Arène JcJ',
  deathrun: 'Deathrun',
};

/**
 * Carte de projet : une carte de rareté. Sa bordure et son halo prennent la
 * couleur du palier atteint — c'est la seule chose qu'on doit voir de loin.
 */
export function CarteProjet({
  p,
}: {
  p: { id: string; name: string; genre: string; tier: number; derniereGeneration: Date | null; enCours: string | null };
}) {
  const palier: Palier = estPalier(p.tier) ? p.tier : 1;
  const couleur = PALIERS[palier].couleur;

  return (
    <article
      className="chanfrein relative p-px [--c:14px]"
      style={{ background: `linear-gradient(160deg, ${couleur}, color-mix(in srgb, ${couleur} 18%, var(--color-void-600)) 55%)` }}
    >
      <div className="chanfrein relative h-full overflow-hidden bg-void-800 p-5 [--c:13.4px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-25"
          style={{ background: `radial-gradient(80% 100% at 50% 0%, ${couleur}, transparent)` }}
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xs uppercase tracking-wider text-text-3">{GENRES[p.genre] ?? p.genre}</p>
              <h2 className="display mt-1 truncate text-[26px] text-text-1">{p.name}</h2>
            </div>
          </div>
          <div className="mt-4">
            <BadgePalier palier={palier} />
          </div>
          <BarrePalier palier={palier} valeur={(palier / 5) * 100} className="mt-4" />
          <p className="mt-2 text-xs text-text-3">
            {p.enCours ? 'Construction en cours' : p.derniereGeneration ? `Dernière génération le ${dateCourte(p.derniereGeneration)}` : 'Jamais construit'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Bouton asChild taille="sm">
              <Link href={p.enCours ? `/projet/${p.id}/build/${p.enCours}` : `/projet/${p.id}`}>
                Ouvrir <ArrowRight size={14} aria-hidden />
              </Link>
            </Bouton>
            <Bouton asChild taille="sm" variant="fantome">
              <Link href={`/projet/${p.id}#mise-a-jour`}>
                <RefreshCw size={14} aria-hidden /> Générer une mise à jour
              </Link>
            </Bouton>
          </div>
        </div>
      </div>
    </article>
  );
}
