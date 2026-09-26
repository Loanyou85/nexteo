import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Un seul bouton `principal` par écran (section 5.2).
 *
 * Les couleurs passent par les tokens de surface, jamais par une teinte en
 * dur : le même bouton se pose sur l'accueil sombre et dans l'application
 * claire sans variante à écrire.
 *
 * Le rayon reste discret. Ce produit est un outil de travail, pas une page
 * d'inscription — `capsule` existe pour le seul appel à l'action de l'accueil,
 * qui reçoit du trafic TikTok et doit se voir.
 */
const variantes = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neo-500',
  {
    variants: {
      variant: {
        principal: 'bg-neo-500 text-white hover:bg-neo-600',
        secondaire: 'border border-bordure bg-surface text-encre hover:border-neo-500/40',
        fantome: 'text-encre-2 hover:text-encre',
        danger: 'border border-bordure bg-surface text-encre hover:border-alerte/50',
      },
      taille: {
        // 36 px suffit à la souris dans un tableau dense ; 44 px est le
        // plancher tactile et reste le défaut.
        xs: 'h-9 rounded-bouton px-3 text-sm',
        sm: 'h-11 rounded-bouton px-4 text-sm',
        md: 'h-11 rounded-bouton px-5 text-base',
        lg: 'h-13 rounded-bouton px-6 text-md',
        capsule: 'h-13 rounded-capsule px-7 text-md font-semibold',
        bloc: 'h-12 w-full rounded-bouton px-5 text-base',
      },
    },
    defaultVariants: { variant: 'principal', taille: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variantes> {
  asChild?: boolean;
  /** React 19 : `ref` est une prop ordinaire. */
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({ className, variant, taille, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(variantes({ variant, taille }), className)} {...props} />;
}

export { variantes as buttonVariants };
