import { cn } from '@/lib/utils';

const base =
  'w-full border border-void-600 bg-void-900 px-3.5 text-sm text-text-1 placeholder:text-text-3 transition-colors focus-visible:border-void-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-blue/40';

export function Saisie({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input className={cn(base, 'h-11', className)} {...props} />;
}

export function ZoneTexte({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return <textarea className={cn(base, 'min-h-28 py-3 leading-relaxed', className)} {...props} />;
}

export function Selecteur({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(base, 'h-11 appearance-none pr-8', className)} {...props} />;
}

/** Champ complet : intitulé, aide, erreur reliée pour les lecteurs d'écran. */
export function Champ({
  intitule,
  aide,
  erreur,
  htmlFor,
  children,
  className,
}: {
  intitule: string;
  aide?: string;
  erreur?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text-1">
        {intitule}
      </label>
      {aide ? <p className="text-xs text-text-3">{aide}</p> : null}
      {children}
      {erreur ? (
        <p role="alert" className="text-xs text-fail">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
