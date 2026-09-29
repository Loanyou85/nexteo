'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Circle, Loader2, RotateCcw, XCircle } from 'lucide-react';
import demo from '@/content/build-demo.json';
import { BadgePalier, BarrePalier } from '@/components/ui/palier';
import { estPalier, type Palier } from '@/lib/palier';
import { cn } from '@/lib/utils';

/**
 * Rejeu d'un build RÉEL (section 5.1), enregistré contre l'éditeur simulé.
 * Rien n'est écrit à la main : les lignes, les durées, les échecs et les
 * paliers viennent de l'enregistrement. L'étiquette dit ce que c'est.
 */

type Ev = { t: number; type: string; niveau: string; etape: string | null; message: string; palier: number | null };
const EVENEMENTS = demo.evenements as Ev[];
const ACCELERATION = 4;

export function RejeuConsole() {
  const [t, setT] = useState(0);
  const [lance, setLance] = useState(false);
  const cadre = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const fin = EVENEMENTS.at(-1)?.t ?? 0;

  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const obs = new IntersectionObserver((e) => e[0]?.isIntersecting && setLance(true), { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!lance) return;
    const debut = performance.now() - t / ACCELERATION;
    let id = 0;
    const tick = () => {
      const x = (performance.now() - debut) * ACCELERATION;
      setT(Math.min(x, fin));
      if (x < fin) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lance]);

  const passes = useMemo(() => EVENEMENTS.filter((e) => e.t <= t), [t]);
  const palierBrut = [...passes].reverse().find((e) => e.type === 'palier' && e.palier)?.palier ?? 1;
  const palier: Palier = estPalier(palierBrut) ? palierBrut : 1;

  const etapes = demo.etapes.map((e) => {
    const siens = passes.filter((x) => x.etape === e.cle);
    const debut = siens.find((x) => x.type === 'tache_debut');
    const echec = siens.some((x) => x.type === 'tache_echec');
    const tous = EVENEMENTS.filter((x) => x.etape === e.cle);
    const derniere = tous.at(-1);
    const faite = !!derniere && derniere.t <= t;
    const d = debut && faite ? (derniere!.t - debut.t) / 1000 : null;
    return { ...e, statut: faite ? 'faite' : debut ? (echec ? 'echec' : 'en_cours') : 'attente', duree: d, existe: tous.length > 0 };
  }).filter((e) => e.existe);

  const lignes = passes.filter((e) => e.type !== 'tache_debut').slice(-9);
  useEffect(() => {
    if (zone.current) zone.current.scrollTop = zone.current.scrollHeight;
  }, [lignes.length]);

  return (
    <div ref={cadre} className="chanfrein bg-void-600 p-px [--c:14px]">
      <div className="chanfrein bg-void-800 [--c:13.4px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-void-700 px-5 py-4">
          <p className="display text-[26px] text-text-1">{demo.titre}</p>
          <BadgePalier palier={palier} numero pulse />
        </div>
        <BarrePalier palier={palier} valeur={(t / fin) * 100} className="h-1.5" />
        <div className="grid gap-0 sm:grid-cols-[210px_minmax(0,1fr)]">
          <ol className="space-y-1 border-b border-void-700 p-4 text-sm sm:border-b-0 sm:border-r">
            {etapes.map((e) => (
              <li key={e.cle} className="flex items-center gap-2">
                {e.statut === 'faite' ? (
                  <Check size={14} strokeWidth={3} className="text-ok" aria-hidden />
                ) : e.statut === 'en_cours' ? (
                  <Loader2 size={14} className="animate-spin text-arc-cyan" aria-hidden />
                ) : e.statut === 'echec' ? (
                  <XCircle size={14} className="text-fail" aria-hidden />
                ) : (
                  <Circle size={12} className="text-idle" aria-hidden />
                )}
                <span className={cn('flex-1 truncate', e.statut === 'attente' ? 'text-text-3' : 'text-text-1')}>{e.libelle}</span>
                <span className="tabular text-2xs text-text-3">{e.duree !== null ? `${e.duree.toFixed(0)} s` : ''}</span>
              </li>
            ))}
          </ol>
          <div ref={zone} className="h-[252px] overflow-hidden bg-void-900 p-3 font-mono text-[12px] leading-relaxed">
            {lignes.map((e, i) => (
              <p
                key={`${e.t}-${i}`}
                className={cn(
                  'truncate',
                  e.niveau === 'fail' ? 'text-fail' : e.niveau === 'warn' ? 'text-warn' : e.niveau === 'ok' ? 'text-ok' : e.type === 'log' ? 'text-text-3' : 'text-text-2',
                )}
              >
                {e.message}
              </p>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-void-700 px-5 py-2.5 text-2xs text-text-3">
          <span>Build réel contre l’éditeur simulé, rejoué ×{ACCELERATION} — {Math.round(demo.dureeMs / 1000)} s au total</span>
          <button type="button" onClick={() => { setT(0); setLance(false); requestAnimationFrame(() => setLance(true)); }} className="flex items-center gap-1 hover:text-text-1">
            <RotateCcw size={12} aria-hidden /> Rejouer
          </button>
        </div>
      </div>
    </div>
  );
}
