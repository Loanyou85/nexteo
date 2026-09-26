import { cn } from '@/lib/utils';

/** Squelettes de chargement plutôt que rotateurs (section 5.4). */
export function Squelette({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('squelette h-4 w-full', className)} aria-hidden {...props} />;
}

export function LigneSquelette() {
  return (
    <div className="flex h-ligne items-center gap-4 border-b border-bordure px-carte">
      <Squelette className="w-40" />
      <Squelette className="w-24" />
      <Squelette className="ml-auto w-16" />
    </div>
  );
}
