import { cn } from '@/lib/utils';

/**
 * L'escalier : trois marches qui montent, et le palier détaché en haut à
 * droite — ce qu'on vise. Dessiné, jamais importé.
 */
export function LogoMark({ className, variant = 'neo' }: { className?: string; variant?: 'neo' | 'mono' | 'nuit' }) {
  // Sur fond clair, l'escalier se dessine à l'encre et seul le palier porte la
  // couleur de marque : c'est lui qu'on doit voir en premier.
  // Sur fond clair l'escalier se dessine à l'encre, sur la barre latérale il
  // passe en clair. Le palier garde la couleur de marque dans les deux cas :
  // c'est lui qu'on doit voir en premier.
  const trait =
    variant === 'nuit' ? 'var(--color-nuit-encre)'
    : variant === 'neo' ? 'var(--color-encre)'
    : 'currentColor';
  const palier = variant === 'mono' ? 'currentColor' : 'var(--color-neo-500)';
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn('h-7 w-7', className)} aria-hidden="true">
      <path
        d="M2 30v-6.5c0-1.4 1.1-2.5 2.5-2.5H11v-6.5c0-1.4 1.1-2.5 2.5-2.5H20"
        stroke={trait}
        strokeWidth="6.5"
        strokeLinecap="square"
      />
      <rect x="21" y="2" width="9" height="9" rx="2.8" fill={palier} />
    </svg>
  );
}

export function Logo({
  className,
  variant,
}: {
  className?: string;
  variant?: 'neo' | 'mono' | 'nuit';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark variant={variant} />
      <span
        className={cn(
          'font-display text-lg font-extrabold tracking-[-0.03em]',
          variant === 'nuit' ? 'text-nuit-encre' : 'text-encre',
        )}
      >
        Nexteo
      </span>
    </span>
  );
}
