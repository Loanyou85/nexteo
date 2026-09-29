'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Rocket } from 'lucide-react';
import { Bouton } from '@/components/ui/bouton';
import { Panneau } from '@/components/ui/panneau';
import { lancerConstruction, type EtatLancement } from '@/server/actions/construction';
import type { Estimation } from '@/server/orchestrateur/lancement';

function Lancer({ autorise }: { autorise: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" variant="principal" taille="lg" className="w-full" disabled={!autorise || pending}>
      <Rocket size={17} aria-hidden />
      {pending ? 'Préparation du plan de construction…' : 'Lancer la construction'}
    </Bouton>
  );
}

/**
 * Lancement (étape 3). L'estimation est annoncée AVANT, jamais découverte
 * après ; sans solde suffisant, on propose une recharge ou une montée
 * d'offre — jamais un lancement à découvert.
 */
export function PanneauLancement({ projectId, est, simulation }: { projectId: string; est: Estimation; simulation: boolean }) {
  const [etat, action] = useActionState<EtatLancement, FormData>(lancerConstruction.bind(null, projectId), {});
  const [autonomie, setAutonomie] = useState(true);

  return (
    <Panneau interieur="p-5" actif>
      <h3 className="display text-[22px]">Lancer la construction</h3>
      <p className="mt-3 text-sm text-text-1">
        Ce build devrait consommer environ <strong className="tabular text-arc-cyan">{est.estimation} crédits</strong>. Il t’en reste{' '}
        <strong className="tabular">{est.solde}</strong>.
      </p>
      <p className="mt-1 text-xs text-text-3">
        {est.plafond} crédits seront réservés au lancement. Une réservation n’est pas un débit : seul le coût réel est prélevé à la
        fin, et une panne de la plateforme est remboursée.
      </p>

      {!est.autorise ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-warn">{est.raison}</p>
          <div className="flex flex-wrap gap-2">
            <Bouton asChild taille="sm" variant="secondaire">
              <Link href="/tarifs">Voir les offres</Link>
            </Bouton>
            <Bouton asChild taille="sm" variant="fantome">
              <Link href="/tarifs#recharge">Recharger 20 crédits</Link>
            </Bouton>
          </div>
        </div>
      ) : (
        <form action={action} className="mt-4 space-y-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="autonomie"
              checked={autonomie}
              onChange={(e) => setAutonomie(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-arc-blue"
            />
            <span>
              <span className="text-text-1">Construction autonome complète (niveau 5)</span>
              <span className="block text-xs text-text-3">
                Sans elle, l’agent construit et teste, mais attend ton accord avant chaque correctif.
              </span>
            </span>
          </label>

          {autonomie ? (
            <label className="chanfrein flex items-start gap-3 bg-void-700/60 p-3 text-xs text-text-2 [--c:8px]">
              <input type="checkbox" name="confirmation" required className="mt-0.5 h-4 w-4 accent-arc-blue" />
              <span>
                Je confirme que l’agent peut, sur ce projet, écrire et modifier le Verse, placer et configurer des devices, créer
                des entités, lancer des playtests et appliquer ses propres correctifs sans m’attendre. Il ne modifie rien hors du
                projet et ne publie jamais.
              </span>
            </label>
          ) : null}

          {etat.erreur ? (
            <p role="alert" className="text-sm text-fail">
              {etat.erreur}
            </p>
          ) : null}
          <Lancer autorise={est.autorise} />
          {simulation ? (
            <p className="text-2xs text-warn">Simulation : aucun UEFN n’est branché, la construction tournera contre l’éditeur simulé.</p>
          ) : null}
        </form>
      )}
    </Panneau>
  );
}
