'use client';

import { useState, useTransition } from 'react';
import { Copy, KeyRound, Search, Trash2 } from 'lucide-react';
import { Bouton } from '@/components/ui/bouton';
import { Panneau } from '@/components/ui/panneau';
import { PointEtat } from '@/components/ui/etat';
import { decouvrirOutils, genererCode, revoquer, type EtatCode, type EtatDecouverte } from '@/server/actions/agent';

export type AgentVue = { id: string; nom: string; version: string | null; vuLe: string | null; vivant: boolean };
export type CatalogueVue = { protocole: string | null; le: string | null; outils: { name: string; description?: string }[] } | null;

function Copier({ texte, libelle }: { texte: string; libelle: string }) {
  const [fait, setFait] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(texte).then(() => {
          setFait(true);
          setTimeout(() => setFait(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 text-xs text-arc-cyan underline underline-offset-4"
    >
      <Copy size={13} aria-hidden /> {fait ? 'Copié' : libelle}
    </button>
  );
}

/**
 * Agent local : appairage, état, révocation et découverte des outils du MCP.
 * Le catalogue affiché est celui que l'éditeur annonce réellement — c'est la
 * seule source fiable des noms d'outils, le MCP étant en bêta.
 */
export function PanneauAgent({ agents, catalogue, vivant }: { agents: AgentVue[]; catalogue: CatalogueVue; vivant: boolean }) {
  const [code, setCode] = useState<EtatCode | null>(null);
  const [decouverte, setDecouverte] = useState<EtatDecouverte | null>(null);
  const [enCours, demarrer] = useTransition();
  const commande = code?.code ? `npm run agent -- pair ${code.code} --site ${code.site}` : '';

  return (
    <Panneau interieur="p-5">
      <h2 className="display text-[22px]">Agent Nexteo</h2>
      <p className="mt-2 text-sm text-text-2">
        Le petit programme qui relie ce site à ton UEFN, sur ton PC. Il ne reçoit que trois ordres — tester, lister les outils, en appeler
        un — et ne parle qu’à ton éditeur local.
      </p>

      {agents.length > 0 ? (
        <ul className="mt-4 divide-y divide-void-700 border-y border-void-700">
          {agents.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              <PointEtat etat={a.vivant ? 'ok' : 'idle'} vide={!a.vivant} />
              <span className="font-mono text-code text-text-1">{a.nom}</span>
              <span className="text-xs text-text-3">
                {a.vivant ? 'connecté' : 'hors ligne'}
                {a.version ? ` · v${a.version}` : ''}
                {a.vuLe ? ` · vu ${a.vuLe}` : ''}
              </span>
              <button
                type="button"
                disabled={enCours}
                onClick={() => demarrer(() => revoquer(a.id))}
                className="ml-auto inline-flex items-center gap-1.5 text-xs text-fail underline underline-offset-4 disabled:opacity-50"
              >
                <Trash2 size={13} aria-hidden /> Révoquer
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 space-y-3">
        <Bouton
          variant="secondaire"
          taille="sm"
          disabled={enCours}
          onClick={() => demarrer(async () => setCode(await genererCode()))}
        >
          <KeyRound size={15} aria-hidden /> Générer un code d’appairage
        </Bouton>
        {code?.code ? (
          <div className="chanfrein space-y-3 bg-void-700/60 p-4 [--c:8px]">
            <p className="text-xs text-text-3">Valable 10 minutes, utilisable une seule fois. Il ne sera plus affiché.</p>
            <p className="tabular display text-[36px] tracking-widest text-text-1" aria-label={`Code ${code.code}`}>
              {code.code}
            </p>
            <p className="text-xs text-text-2">Sur ton PC, dans le dossier du projet Nexteo :</p>
            <pre className="overflow-x-auto bg-void-900 p-3 font-mono text-code text-text-1">{commande}</pre>
            <Copier texte={commande} libelle="Copier la commande" />
            <p className="text-2xs text-text-3">
              Puis lance <code className="font-mono">npm run agent -- run</code>. Node.js est requis pour l’instant ; un exécutable Windows autonome viendra plus tard.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-6 border-t border-void-700 pt-4">
        <h3 className="text-sm font-medium text-text-1">Outils du MCP d’UEFN</h3>
        <p className="mt-1 text-xs text-text-3">
          La liste réelle que ton éditeur annonce. Nexteo ne devine aucun nom d’outil : le MCP est en bêta, et c’est cette liste qui décide de ce qui peut être construit pour de vrai.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Bouton
            taille="sm"
            disabled={!vivant || enCours}
            onClick={() => demarrer(async () => setDecouverte(await decouvrirOutils()))}
          >
            <Search size={15} aria-hidden /> {enCours ? 'Interrogation de l’éditeur…' : 'Découvrir les outils'}
          </Bouton>
          {!vivant ? <span className="text-xs text-text-3">Nécessite un agent connecté.</span> : null}
        </div>
        {decouverte?.erreur ? (
          <p role="alert" className="mt-3 text-sm text-fail">
            {decouverte.erreur}
          </p>
        ) : null}
        {decouverte?.nombre !== undefined ? <p className="mt-3 text-sm text-ok">{decouverte.nombre} outil(s) découvert(s).</p> : null}

        {catalogue ? (
          <div className="mt-4">
            <p className="text-xs text-text-2">
              {catalogue.outils.length} outil(s)
              {catalogue.protocole ? ` · protocole ${catalogue.protocole}` : ''}
              {catalogue.le ? ` · relevé ${catalogue.le}` : ''}
            </p>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto font-mono text-code">
              {catalogue.outils.map((o) => (
                <li key={o.name} className="flex gap-2" title={o.description}>
                  <span className="text-text-1">{o.name}</span>
                  {o.description ? <span className="truncate font-sans text-xs text-text-3">{o.description}</span> : null}
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Copier texte={JSON.stringify({ protocolVersion: catalogue.protocole, outils: catalogue.outils }, null, 2)} libelle="Copier le catalogue (JSON)" />
            </div>
          </div>
        ) : null}
      </div>
    </Panneau>
  );
}
