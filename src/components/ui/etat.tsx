import { cn } from '@/lib/utils';

export type Etat = 'ok' | 'warn' | 'fail' | 'idle' | 'actif';

const COULEURS: Record<Etat, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  fail: 'bg-fail',
  idle: 'bg-idle',
  actif: 'bg-arc-cyan',
};

/** Point d'état système : rond plein pour un fait, rond vide pour une absence. */
export function PointEtat({ etat, vide = false, className }: { etat: Etat; vide?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-2.5 w-2.5 shrink-0 rounded-full',
        vide ? 'border-2 border-idle bg-transparent' : COULEURS[etat],
        etat === 'actif' && !vide && 'anim-pouls',
        className,
      )}
    />
  );
}
