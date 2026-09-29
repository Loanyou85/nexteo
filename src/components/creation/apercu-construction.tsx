import { Box, FileCode2, FlaskConical } from 'lucide-react';
import { Panneau } from '@/components/ui/panneau';
import type { GameSpec } from '@/lib/gamespec/schema';

/**
 * Ce que l'agent va construire, dérivé du plan. En lecture seule : ces
 * listes se recalculent quand on change les paramètres, elles ne s'éditent
 * pas une à une.
 */
export function ApercuConstruction({
  spec,
  verifies,
}: {
  spec: GameSpec;
  /** Types de devices confrontés au catalogue réel du MCP. */
  verifies: Set<string>;
}) {
  const devices = Object.entries(
    spec.devices.reduce<Record<string, number>>((acc, d) => {
      acc[d.deviceType] = (acc[d.deviceType] ?? 0) + 1;
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-4">
      <Panneau interieur="p-5">
        <div className="flex items-center gap-2 text-text-2">
          <Box size={16} strokeWidth={1.8} aria-hidden />
          <h3 className="text-sm font-medium text-text-1">Devices ({spec.devices.length})</h3>
        </div>
        <ul className="mt-3 space-y-1.5 font-mono text-code">
          {devices.map(([type, n]) => (
            <li key={type} className="flex items-center justify-between gap-3">
              <span className="truncate text-text-1">{type}</span>
              <span className="flex shrink-0 items-center gap-2">
                {verifies.has(type) ? null : (
                  <span className="text-2xs font-sans text-warn" title="Jamais confronté au catalogue réel du MCP">
                    non vérifié
                  </span>
                )}
                <span className="tabular text-text-3">×{n}</span>
              </span>
            </li>
          ))}
        </ul>
        {verifies.size === 0 ? (
          <p className="mt-3 text-2xs leading-relaxed text-text-3">
            Catalogue simulé : aucun de ces devices n’a encore été vérifié contre le vrai MCP. Ils le seront à la première
            connexion d’un éditeur UEFN.
          </p>
        ) : null}
      </Panneau>

      <Panneau interieur="p-5">
        <div className="flex items-center gap-2 text-text-2">
          <FileCode2 size={16} strokeWidth={1.8} aria-hidden />
          <h3 className="text-sm font-medium text-text-1">Modules Verse ({spec.verseModules.length})</h3>
        </div>
        <ul className="mt-3 space-y-2">
          {spec.verseModules.map((m) => (
            <li key={m.name}>
              <p className="font-mono text-code text-text-1">{m.name}.verse</p>
              <p className="text-xs text-text-3">{m.responsibility}</p>
            </li>
          ))}
        </ul>
      </Panneau>

      <Panneau interieur="p-5">
        <div className="flex items-center gap-2 text-text-2">
          <FlaskConical size={16} strokeWidth={1.8} aria-hidden />
          <h3 className="text-sm font-medium text-text-1">Tests générés ({spec.testRequirements.length})</h3>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {spec.testRequirements.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3">
              <span className="text-text-1">{t.description}</span>
              <span className={t.severity === 'blocking' ? 'shrink-0 text-2xs text-arc-cyan' : 'shrink-0 text-2xs text-text-3'}>
                {t.severity === 'blocking' ? 'bloquant' : 'avertissement'}
              </span>
            </li>
          ))}
        </ul>
      </Panneau>
    </div>
  );
}
