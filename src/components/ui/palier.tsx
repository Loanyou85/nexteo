import { PALIERS, type Palier } from '@/lib/palier';
import { cn } from '@/lib/utils';

/**
 * Badge de palier : biseau 6 px, libellé en Anton (jamais sous 20 px).
 * `pulse` rejoue l'animation de changement de palier, une seule fois.
 */
export function BadgePalier({
  palier,
  numero = false,
  pulse = false,
  className,
}: {
  palier: Palier;
  numero?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  const p = PALIERS[palier];
  return (
    <span
      key={pulse ? `pulse-${palier}` : undefined}
      className={cn(
        'chanfrein display inline-flex h-9 items-center gap-2 px-3 text-[20px] [--c:6px]',
        pulse && 'anim-palier',
        className,
      )}
      style={{
        background: `color-mix(in srgb, ${p.couleur} 16%, transparent)`,
        color: p.couleur,
      }}
      title={p.sens}
    >
      <span aria-hidden className="h-2 w-2 shrink-0" style={{ background: p.couleur }} />
      {numero ? `Palier ${palier} — ${p.libelle}` : p.libelle}
    </span>
  );
}

/** Point de statut compact, pour les listes denses : couleur + nom accessible. */
export function PointPalier({ palier, className }: { palier: Palier; className?: string }) {
  const p = PALIERS[palier];
  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 shrink-0', className)}
      style={{ background: p.couleur, boxShadow: `0 0 10px ${p.couleur}66` }}
      role="img"
      aria-label={`Palier ${palier} — ${p.libelle}`}
    />
  );
}

/**
 * Barre de progression : aplat de la couleur du palier atteint, diagonale à
 * 45° en surimpression. Sa valeur vient des tâches réellement terminées —
 * jamais d'une animation qui avance toute seule.
 */
export function BarrePalier({
  palier,
  valeur,
  className,
}: {
  palier: Palier;
  valeur: number;
  className?: string;
}) {
  const part = Math.max(0, Math.min(100, valeur));
  return (
    <div
      className={cn('h-2 w-full overflow-hidden bg-void-700', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(part)}
    >
      <div
        className="rayure h-full transition-[width] duration-300"
        style={{ width: `${part}%`, backgroundColor: PALIERS[palier].couleur }}
      />
    </div>
  );
}
