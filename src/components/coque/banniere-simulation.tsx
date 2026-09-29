import { FlaskConical } from 'lucide-react';
import type { ModeIa, ModeUefn } from '@/server/mode';

/**
 * Bannière permanente de simulation (garde-fou n° 1).
 *
 * Elle n'est pas refermable. Une simulation qu'on peut masquer finit masquée,
 * et une capture d'écran de build simulé circule alors comme un vrai.
 */
export function BanniereSimulation({ uefn, ia }: { uefn: ModeUefn; ia: ModeIa }) {
  if (uefn !== 'mock' && ia !== 'simule') return null;

  const parties = [
    uefn === 'mock' ? 'aucun UEFN n’est branché : les builds tournent contre un éditeur simulé' : null,
    ia === 'simule' ? 'aucune clé d’IA n’est configurée : les plans et correctifs viennent d’une IA simulée' : null,
  ].filter(Boolean);

  return (
    <div
      role="status"
      className="rayure flex items-center gap-2.5 border-b border-warn/40 bg-warn/12 px-4 py-2 text-xs text-warn sm:px-6"
    >
      <FlaskConical size={14} strokeWidth={2} className="shrink-0" aria-hidden />
      <p>
        <strong className="font-medium">Simulation.</strong> {parties.join(' ; ')}. Rien de ce qui
        s’affiche ici ne s’est produit dans un vrai projet.
      </p>
    </div>
  );
}
