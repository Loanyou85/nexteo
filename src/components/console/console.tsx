'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Check, ChevronRight, Circle, Loader2, Pause, Play, Square, Wrench, X, XCircle, RotateCcw } from 'lucide-react';
import { BadgePalier, BarrePalier } from '@/components/ui/palier';
import { Bouton } from '@/components/ui/bouton';
import { Panneau } from '@/components/ui/panneau';
import { PointEtat } from '@/components/ui/etat';
import { duree, euros2 } from '@/lib/format';
import { PALIERS, estPalier, type Palier } from '@/lib/palier';
import { cn } from '@/lib/utils';
import { commander, type Commande } from '@/server/actions/construction';
import type { EtatConsole, EvenementVue } from '@/server/console';

/**
 * Console de build (sections 5.4 et 25).
 *
 * Tout ce qu'elle affiche arrive par le flux SSE et vient de la base : aucune
 * étape fictive, aucune barre qui avance toute seule. Les logs s'ajoutent
 * sans animation — il y en aura des milliers — et le défilement ne suit que
 * si l'utilisateur est déjà en bas.
 */

const MAX_LIGNES = 2_000;

type Filtre = 'tout' | 'erreurs' | 'tests' | 'jeu';

const RAISONS: Record<string, string> = {
  correctif_a_valider: 'Un correctif attend ton accord.',
  plafond_credits: 'Plafond de crédits atteint.',
  budget_etapes: 'Limite d’étapes atteinte.',
  budget_temps: 'Limite de durée atteinte.',
  limite_corrections: 'Trop de corrections sans succès sur un fichier.',
  blocage: 'Une dépendance a échoué.',
  echec_tache: 'Une tâche a échoué.',
  erreur_sans_fichier: 'Erreur sans fichier identifiable.',
  panne_plateforme: 'Panne de la plateforme : crédits restitués.',
  arretee_par_utilisateur: 'Arrêtée à ta demande.',
  annulee_par_utilisateur: 'Annulée à ta demande.',
};

const STATUTS: Record<string, { texte: string; etat: 'ok' | 'warn' | 'fail' | 'idle' | 'actif' }> = {
  queued: { texte: 'En file', etat: 'idle' },
  running: { texte: 'En cours', etat: 'actif' },
  paused: { texte: 'En pause', etat: 'warn' },
  stopping: { texte: 'Arrêt demandé', etat: 'warn' },
  awaiting_human: { texte: 'Intervention demandée', etat: 'warn' },
  completed: { texte: 'Terminée', etat: 'ok' },
  stopped: { texte: 'Arrêtée', etat: 'idle' },
  failed: { texte: 'En échec', etat: 'fail' },
};

function IconeEtape({ statut }: { statut: string }) {
  if (statut === 'faite' || statut === 'done' || statut === 'skipped')
    return <Check size={15} strokeWidth={3} className="anim-coche text-ok" aria-label="fait" />;
  if (statut === 'en_cours' || statut === 'running' || statut === 'verifying')
    return <Loader2 size={15} strokeWidth={2.4} className="animate-spin text-arc-cyan" aria-label="en cours" />;
  if (statut === 'echec' || statut === 'failed') return <XCircle size={15} strokeWidth={2.2} className="text-fail" aria-label="échec" />;
  return <Circle size={13} strokeWidth={2} className="text-idle" aria-label="en attente" />;
}

function classeLigne(e: EvenementVue): string {
  if (e.level === 'fail') return 'text-fail anim-erreur';
  if (e.level === 'warn') return 'text-warn';
  if (e.level === 'ok') return 'text-ok';
  if (e.type === 'log') return 'text-text-2';
  return 'text-text-1';
}

export function Console({
  sessionId,
  titre,
  etatInitial,
  evenementsInitiaux,
}: {
  sessionId: string;
  titre: string;
  etatInitial: EtatConsole;
  evenementsInitiaux: EvenementVue[];
}) {
  const [etat, setEtat] = useState(etatInitial);
  const [lignes, setLignes] = useState(evenementsInitiaux);
  const [connecte, setConnecte] = useState(false);
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());
  const [pulse, setPulse] = useState(false);
  const [erreurCmd, setErreurCmd] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const zone = useRef<HTMLDivElement>(null);
  const enBas = useRef(true);
  const palierPrecedent = useRef(etatInitial.tier);

  useEffect(() => {
    const dernier = evenementsInitiaux.at(-1)?.seq ?? '0';
    const source = new EventSource(`/api/builds/${sessionId}/events?depuis=${dernier}`);
    source.onopen = () => setConnecte(true);
    source.onerror = () => setConnecte(false);
    source.addEventListener('evenement', (m) => {
      const e = JSON.parse((m as MessageEvent).data) as EvenementVue;
      setLignes((l) => (l.some((x) => x.seq === e.seq) ? l : [...l, e].slice(-MAX_LIGNES)));
    });
    source.addEventListener('etat', (m) => setEtat(JSON.parse((m as MessageEvent).data) as EtatConsole));
    source.addEventListener('fin', () => source.close());
    return () => source.close();
  }, [sessionId, evenementsInitiaux]);

  // Changement de palier : la carte se recolore et le badge pulse UNE fois.
  useEffect(() => {
    if (etat.tier !== palierPrecedent.current) {
      palierPrecedent.current = etat.tier;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 650);
      return () => clearTimeout(t);
    }
  }, [etat.tier]);

  // On ne repositionne le défilement que si l'utilisateur était déjà en bas.
  useEffect(() => {
    const z = zone.current;
    if (z && enBas.current) z.scrollTop = z.scrollHeight;
  }, [lignes, filtre]);

  const visibles = useMemo(
    () =>
      lignes.filter((e) =>
        filtre === 'tout'
          ? e.type !== 'tache_debut'
          : filtre === 'erreurs'
            ? e.level === 'fail' || e.type === 'erreur'
            : filtre === 'tests'
              ? e.type === 'test'
              : e.type === 'log',
      ),
    [lignes, filtre],
  );

  const palier: Palier = estPalier(etat.tier) ? etat.tier : 1;
  const statut = STATUTS[etat.session.status] ?? STATUTS.queued!;
  const actif = ['queued', 'running', 'stopping'].includes(etat.session.status);
  const termine = ['completed', 'stopped', 'failed'].includes(etat.session.status);

  function lancer(c: Commande) {
    setErreurCmd(null);
    demarrer(async () => {
      const r = await commander(sessionId, c);
      if (r.erreur) setErreurCmd(r.erreur);
    });
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      {/* En-tête : le nom du jeu et son palier, fil conducteur du produit. */}
      <div className="border-b border-void-700 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="display truncate text-[34px] text-text-1 sm:text-[42px]">{titre}</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-text-2">
              <PointEtat etat={statut.etat} />
              {statut.texte}
              {etat.session.stopReason ? <span className="text-text-3">— {RAISONS[etat.session.stopReason] ?? etat.session.stopReason}</span> : null}
            </p>
          </div>
          <BadgePalier palier={palier} numero pulse={pulse} />
        </div>
        <BarrePalier palier={palier} valeur={etat.progression} className="mt-4" />
      </div>

      <div className="grid flex-1 gap-0 lg:grid-cols-[300px_minmax(0,1fr)_280px]">
        {/* Chronologie des tâches, réelle. */}
        <aside className="border-b border-void-700 p-4 lg:border-b-0 lg:border-r" aria-label="Chronologie">
          <ol className="space-y-0.5">
            {etat.etapes.map((e) => {
              const ouverte = ouvertes.has(e.cle) || e.statut === 'en_cours' || e.statut === 'echec';
              return (
                <li key={e.cle}>
                  <button
                    type="button"
                    onClick={() =>
                      setOuvertes((o) => {
                        const n = new Set(o);
                        if (n.has(e.cle)) n.delete(e.cle);
                        else n.add(e.cle);
                        return n;
                      })
                    }
                    aria-expanded={ouverte}
                    className={cn('flex w-full items-center gap-2.5 px-2 py-2 text-left text-sm transition-colors hover:bg-void-800', e.statut === 'en_cours' && 'bg-void-800')}
                  >
                    <span className="flex w-4 justify-center">
                      <IconeEtape statut={e.statut} />
                    </span>
                    <span className={cn('flex-1', e.statut === 'attente' ? 'text-text-3' : 'text-text-1')}>{e.libelle}</span>
                    <span className="tabular text-xs text-text-3">{duree(e.dureeMs)}</span>
                    <ChevronRight size={14} className={cn('text-text-3 transition-transform', ouverte && 'rotate-90')} aria-hidden />
                  </button>
                  {ouverte ? (
                    <ul className="mb-2 ml-[1.35rem] border-l border-void-700 pl-3">
                      {e.taches.map((t) => (
                        <li key={t.key} className="flex items-center gap-2 py-1 text-xs">
                          <IconeEtape statut={t.status} />
                          <span className={cn('flex-1 truncate', t.status === 'pending' ? 'text-text-3' : 'text-text-2')} title={t.description}>
                            {t.description}
                          </span>
                          {t.attempt > 1 ? <span className="text-warn">×{t.attempt}</span> : null}
                          <span className="tabular text-text-3">{duree(t.dureeMs)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Logs en direct : JetBrains Mono, casse normale, aucune animation d'ajout. */}
        <section className="flex min-h-[420px] min-w-0 flex-col border-b border-void-700 lg:border-b-0" aria-label="Logs en direct">
          <div className="flex flex-wrap items-center gap-1 border-b border-void-700 px-3 py-2 text-xs">
            {(
              [
                ['tout', 'Tout'],
                ['erreurs', 'Erreurs'],
                ['tests', 'Tests'],
                ['jeu', 'Logs du jeu'],
              ] as [Filtre, string][]
            ).map(([f, l]) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltre(f)}
                aria-pressed={filtre === f}
                className={cn('px-2.5 py-1 transition-colors', filtre === f ? 'bg-void-700 text-text-1' : 'text-text-3 hover:text-text-1')}
              >
                {l}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-1.5 text-text-3">
              <PointEtat etat={connecte ? 'ok' : termine ? 'idle' : 'warn'} />
              {connecte ? 'flux en direct' : termine ? 'flux clos' : 'reconnexion…'}
            </span>
          </div>
          <div
            ref={zone}
            onScroll={(ev) => {
              const z = ev.currentTarget;
              enBas.current = z.scrollHeight - z.scrollTop - z.clientHeight < 24;
            }}
            className="h-[60vh] min-h-[420px] overflow-y-auto bg-void-900 px-3 py-2 font-mono text-code lg:h-[calc(100dvh-16rem)]"
            role="log"
            aria-live="off"
          >
            {visibles.length === 0 ? <p className="text-text-3">Rien pour l’instant.</p> : null}
            {visibles.map((e) => (
              <div key={e.seq} className={cn('whitespace-pre-wrap break-words py-px', classeLigne(e))}>
                <span className="select-none text-text-3">{new Date(e.at).toLocaleTimeString('fr-FR')} </span>
                {e.type === 'test' ? <span className="text-text-3">[test] </span> : e.type === 'log' ? <span className="text-text-3">[jeu] </span> : null}
                {e.message}
              </div>
            ))}
          </div>
        </section>

        {/* État et commandes. */}
        <aside className="space-y-4 p-4 lg:border-l lg:border-void-700" aria-label="État et commandes">
          <Panneau interieur="p-4" biseau={10}>
            <h2 className="text-2xs uppercase tracking-wider text-text-3">Connexion</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-text-2">UEFN</dt>
                <dd className="flex items-center gap-1.5 text-warn">
                  <PointEtat etat="warn" />
                  {etat.session.provider === 'mock' ? 'simulé' : 'connecté'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-text-2">Agent local</dt>
                <dd className="text-text-3">{etat.session.provider === 'mock' ? 'non requis' : '—'}</dd>
              </div>
            </dl>
            {etat.session.provider === 'mock' ? (
              <p className="mt-3 text-2xs leading-relaxed text-text-3">
                Aucun éditeur réel n’est branché : ce build tourne contre un simulateur déterministe.
              </p>
            ) : null}
          </Panneau>

          <Panneau interieur="p-4" biseau={10}>
            <h2 className="text-2xs uppercase tracking-wider text-text-3">Crédits</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-2">Estimation</dt>
                <dd className="tabular">{etat.session.creditsEstimated}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-2">Réservés</dt>
                <dd className="tabular">{etat.session.creditsReserved}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-2">{termine ? 'Débités' : 'Consommés'}</dt>
                <dd className="tabular text-arc-cyan">{termine ? (etat.session.creditsDebited ?? 0) : etat.session.creditsConsommes}</dd>
              </div>
              <div className="flex justify-between text-xs text-text-3">
                <dt>Coût IA{etat.session.provider === 'mock' ? ' estimé' : ''}</dt>
                <dd className="tabular">{euros2(etat.session.costEurMicros)}</dd>
              </div>
            </dl>
            {etat.session.refunded ? <p className="mt-2 text-xs text-ok">Crédits restitués : l’échec vient de la plateforme.</p> : null}
          </Panneau>

          {etat.correctifPropose ? (
            <Panneau interieur="p-4" biseau={10} couleurBord="var(--color-warn)">
              <h2 className="flex items-center gap-2 text-sm font-medium text-warn">
                <Wrench size={15} aria-hidden /> Correctif proposé
              </h2>
              <p className="mt-2 font-mono text-2xs leading-relaxed text-text-2">{etat.correctifPropose.brut}</p>
              {etat.correctifPropose.suggestion ? <p className="mt-2 text-xs text-text-1">{etat.correctifPropose.suggestion}</p> : null}
              <Bouton variant="principal" taille="sm" className="mt-3 w-full" disabled={enCours} onClick={() => lancer('appliquer')}>
                Appliquer le correctif
              </Bouton>
            </Panneau>
          ) : null}

          <div className="space-y-2">
            <h2 className="text-2xs uppercase tracking-wider text-text-3">Commandes</h2>
            <div className="grid grid-cols-2 gap-2">
              {etat.session.status === 'running' || etat.session.status === 'queued' ? (
                <Bouton taille="sm" disabled={enCours} onClick={() => lancer('pause')}>
                  <Pause size={14} aria-hidden /> Pause
                </Bouton>
              ) : null}
              {etat.session.status === 'paused' || (etat.session.status === 'awaiting_human' && etat.session.stopReason !== 'correctif_a_valider') ? (
                <Bouton taille="sm" disabled={enCours} onClick={() => lancer('continuer')}>
                  <Play size={14} aria-hidden /> Continuer
                </Bouton>
              ) : null}
              {etat.session.status === 'awaiting_human' && ['blocage', 'echec_tache'].includes(etat.session.stopReason ?? '') ? (
                <Bouton taille="sm" disabled={enCours} onClick={() => lancer('reessayer')}>
                  <RotateCcw size={14} aria-hidden /> Réessayer
                </Bouton>
              ) : null}
              {!termine ? (
                <>
                  <Bouton taille="sm" variant="danger" disabled={enCours} onClick={() => lancer('stop')}>
                    <Square size={13} aria-hidden /> Stop
                  </Bouton>
                  <Bouton taille="sm" variant="fantome" disabled={enCours} onClick={() => lancer('annuler')}>
                    <X size={14} aria-hidden /> Annuler
                  </Bouton>
                </>
              ) : null}
            </div>
            {erreurCmd ? <p className="text-xs text-fail">{erreurCmd}</p> : null}
            <p className="text-2xs leading-relaxed text-text-3">
              {actif ? 'Stop et Pause prennent effet après la tâche en cours, jamais au milieu d’une écriture.' : termine ? `Construction close au palier ${palier} — ${PALIERS[palier].libelle}.` : ''}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
