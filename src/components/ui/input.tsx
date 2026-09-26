import { cn } from '@/lib/utils';

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-champ border border-bordure bg-surface px-3.5 text-base text-encre',
        'placeholder:text-encre-2/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neo-500',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-encre', className)} {...props} />;
}

/** Champ complet : intitulé, aide, message d'erreur relié pour les lecteurs d'écran. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint ? <p className="text-xs text-encre-2">{hint}</p> : null}
      {children}
      {error ? (
        <p role="alert" className="text-xs text-alerte">
          {error}
        </p>
      ) : null}
    </div>
  );
}
