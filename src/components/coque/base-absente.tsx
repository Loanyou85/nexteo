import { DatabaseZap } from 'lucide-react';
import { Logo } from '@/components/marque/logo';
import { Panneau } from '@/components/ui/panneau';
import type { EtatBase } from '@/server/etat';

export function BaseAbsente({ etat }: { etat: Extract<EtatBase, { pret: false }> }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Logo />
      <Panneau className="mt-8" interieur="p-6">
        <div className="flex items-center gap-3 text-warn">
          <DatabaseZap size={20} strokeWidth={1.8} aria-hidden />
          <h1 className="display text-[26px]">{etat.titre}</h1>
        </div>
        <p className="mt-3 text-sm text-text-2">{etat.explication}</p>
        <ol className="mt-5 space-y-2 text-sm text-text-1">
          {etat.aFaire.map((etape, i) => (
            <li key={etape} className="flex gap-3">
              <span className="tabular text-text-3">{i + 1}.</span>
              {etape}
            </li>
          ))}
        </ol>
      </Panneau>
    </main>
  );
}
