import { cn } from '@/lib/utils';

/** Padding 16, bordure 1 px, aucune ombre portée (section 5.4). */
export function Card({
  className,
  actif,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { actif?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-card border bg-surface p-carte',
        actif ? 'border-neo-500/40' : 'border-bordure',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitre({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold text-encre', className)} {...props} />;
}

export function CardTexte({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-encre-2', className)} {...props} />;
}
