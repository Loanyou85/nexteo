'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Save } from 'lucide-react';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Saisie, Selecteur, ZoneTexte } from '@/components/ui/champ';
import { Panneau } from '@/components/ui/panneau';
import type { Parametres } from '@/lib/gamespec/parametres';
import { enregistrerParametres, type EtatParametres } from '@/server/actions/projets';

/**
 * Le plan de jeu en formulaire, pas en JSON (section 5.3, étape 2).
 * L'utilisateur corrige ce qui ne va pas AVANT de lancer quoi que ce soit.
 */

const ENVIRONNEMENTS: [string, string][] = [
  ['hopital', 'Hôpital'],
  ['ville', 'Ville'],
  ['prison', 'Prison'],
  ['base_militaire', 'Base militaire'],
  ['ile', 'Île'],
  ['entrepot', 'Entrepôt'],
  ['arene', 'Arène'],
  ['laboratoire', 'Laboratoire'],
  ['circuit', 'Circuit'],
];

const HUD: [keyof Parametres['ui'], string][] = [
  ['score', 'Score'],
  ['health', 'Santé'],
  ['currency', 'Monnaie'],
  ['timer', 'Minuteur'],
  ['round', 'Manche'],
  ['objectives', 'Objectifs'],
  ['leaderboard', 'Classement'],
];

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <Panneau interieur="p-5">
      <h3 className="display text-[20px] text-text-1">{titre}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </Panneau>
  );
}

function Nombre({ nom, intitule, valeur, min, max, pas, aide }: { nom: keyof Parametres; intitule: string; valeur: number; min: number; max: number; pas?: number; aide?: string }) {
  return (
    <Champ intitule={intitule} htmlFor={nom} aide={aide}>
      <Saisie id={nom} name={nom} type="number" defaultValue={valeur} min={min} max={max} step={pas ?? 1} required className="tabular" />
    </Champ>
  );
}

function Enregistrer() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" variant="secondaire" disabled={pending}>
      <Save size={16} strokeWidth={1.8} aria-hidden />
      {pending ? 'Enregistrement…' : 'Enregistrer les modifications'}
    </Bouton>
  );
}

export function FormulairePlan({ projectId, p }: { projectId: string; p: Parametres }) {
  const [etat, action] = useActionState<EtatParametres, FormData>(enregistrerParametres.bind(null, projectId), {});

  return (
    <form action={action} className="space-y-4">
      <Section titre="Le jeu">
        <Champ intitule="Titre" htmlFor="title" className="sm:col-span-2 lg:col-span-1">
          <Saisie id="title" name="title" defaultValue={p.title} required maxLength={60} />
        </Champ>
        <Nombre nom="playerCount" intitule="Joueurs" valeur={p.playerCount} min={1} max={16} />
        <Champ intitule="Environnement" htmlFor="environment">
          <Selecteur id="environment" name="environment" defaultValue={p.environment}>
            {ENVIRONNEMENTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Selecteur>
        </Champ>
        <Champ intitule="Taille de la carte" htmlFor="mapSize">
          <Selecteur id="mapSize" name="mapSize" defaultValue={p.mapSize}>
            <option value="small">Petite</option>
            <option value="medium">Moyenne</option>
            <option value="large">Grande</option>
          </Selecteur>
        </Champ>
        <Champ intitule="Description" htmlFor="description" className="sm:col-span-2 lg:col-span-3">
          <ZoneTexte id="description" name="description" defaultValue={p.description} maxLength={600} rows={3} />
        </Champ>
      </Section>

      <Section titre="Manches">
        <Nombre nom="rounds" intitule="Nombre de manches" valeur={p.rounds} min={1} max={50} />
        <Nombre nom="durationSeconds" intitule="Durée d’une manche (s)" valeur={p.durationSeconds} min={30} max={600} />
        <Nombre nom="betweenRoundsSeconds" intitule="Pause entre manches (s)" valeur={p.betweenRoundsSeconds} min={0} max={120} />
      </Section>

      <Section titre="Ennemis">
        <Nombre nom="zombieHealth" intitule="Santé d’un zombie" valeur={p.zombieHealth} min={1} max={10000} />
        <Nombre nom="zombieSpeed" intitule="Vitesse (× référence)" valeur={p.zombieSpeed} min={0.1} max={5} pas={0.1} />
        <Nombre nom="zombieSpawnRate" intitule="Apparitions par minute" valeur={p.zombieSpawnRate} min={0} max={120} />
        <Nombre nom="bossRound" intitule="Manche du boss" valeur={p.bossRound} min={0} max={50} aide="0 = pas de boss." />
        <Nombre nom="bossHealth" intitule="Santé du boss" valeur={p.bossHealth} min={1} max={10000} />
      </Section>

      <Section titre="Monnaie">
        <Champ intitule="Nom" htmlFor="currencyName">
          <Saisie id="currencyName" name="currencyName" defaultValue={p.currencyName} required maxLength={24} />
        </Champ>
        <Nombre nom="rewardElimination" intitule="Gain par élimination" valeur={p.rewardElimination} min={1} max={100000} />
        <Nombre nom="rewardRound" intitule="Gain en fin de manche" valeur={p.rewardRound} min={1} max={100000} />
        <Nombre nom="rewardBoss" intitule="Gain pour le boss" valeur={p.rewardBoss} min={1} max={100000} />
      </Section>

      <Panneau interieur="p-5">
        <h3 className="display text-[20px] text-text-1">Interface</h3>
        <fieldset className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          <legend className="sr-only">Éléments affichés à l’écran</legend>
          {HUD.map(([cle, libelle]) => (
            <label key={cle} className="flex items-center gap-2 text-sm text-text-1">
              <input type="checkbox" name={`ui_${cle}`} defaultChecked={p.ui[cle]} className="h-4 w-4 accent-arc-blue" />
              {libelle}
            </label>
          ))}
        </fieldset>
      </Panneau>

      <div className="flex flex-wrap items-center gap-4">
        <Enregistrer />
        {etat.erreur ? (
          <p role="alert" className="text-sm text-fail">
            {etat.erreur}
          </p>
        ) : etat.ok ? (
          <p className="text-sm text-ok">{etat.ok}</p>
        ) : (
          <p className="text-xs text-text-3">Chaque enregistrement crée une nouvelle version, comparable et restaurable.</p>
        )}
      </div>
    </form>
  );
}
