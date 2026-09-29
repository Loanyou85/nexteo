import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Boutons biseautés à 8 px.
 *
 * `principal` porte le dégradé de marque — un seul par écran. Tout le reste
 * est en aplat : un écran où tout brille ne désigne plus rien.
 */
const variantes = cva(
  'chanfrein inline-flex items-center justify-center gap-2 font-medium transition-[filter,background-color,color] duration-150 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-arc-cyan [--c:8px]',
  {
    variants: {
      variant: {
        principal: 'degrade-arc text-white hover:brightness-115',
        secondaire: 'bg-void-700 text-text-1 hover:bg-void-600',
        fantome: 'text-text-2 hover:text-text-1',
        danger: 'bg-fail/15 text-fail hover:bg-fail/25',
      },
      taille: {
        sm: 'h-9 px-3.5 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-13 px-7 text-base',
      },
    },
    defaultVariants: { variant: 'secondaire', taille: 'md' },
  },
);

export interface BoutonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variantes> {
  asChild?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Bouton({ className, variant, taille, asChild = false, ...props }: BoutonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(variantes({ variant, taille }), className)} {...props} />;
}
