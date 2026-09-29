import { createHash } from 'node:crypto';
import {
  transformVersLUF,
  transformVersXYZ,
  versLUF,
  versXYZ,
  xyz,
  xyzQuat,
  type LUFTransform,
  type LUFVector,
  type XYZTransform,
} from '@/lib/uefn/coordinates';
import {
  PanneEditeur,
  type CompileResult,
  type ComponentSpec,
  type DeviceDefinition,
  type DeviceInstance,
  type EntitySpec,
  type LogEntry,
  type ProjectSnapshot,
  type SceneEntity,
  type SessionHandle,
  type SessionState,
  type UEFNProvider,
  type VerseFile,
  type VerseMatch,
} from '@/lib/uefn/provider';
import { compilerSimule } from '@/lib/uefn/mock/compilateur';
import { executerPartie } from '@/lib/uefn/mock/execution';

/**
 * MockUEFNProvider — un éditeur UEFN simulé, déterministe (section 10).
 *
 * Indispensable : sans lui, personne ne travaille sur l'orchestrateur,
 * l'interface ou les tests sans PC Windows. Il simule les échecs autant que
 * les succès, et il est SIGNALÉ partout où il tourne.
 *
 * Il stocke les positions en XYZ, comme le vrai MCP, et convertit à l'entrée
 * et à la sortie par l'adaptateur : le chemin de conversion est donc exercé à
 * chaque build simulé, pas seulement dans les tests unitaires.
 */

type Plain3 = { x: number; y: number; z: number };
type PlainQ = Plain3 & { w: number };

export type EtatSimulation = {
  projet: { nom: string } | null;
  verse: Record<string, { content: string; hash: string }>;
  /** Fichiers tels qu'à la dernière compilation réussie : c'est ce que la partie exécute. */
  verseCompile: Record<string, string> | null;
  devices: Record<string, { id: string; label: string; deviceType: string; position: Plain3; properties: Record<string, unknown> }>;
  entities: Record<string, { id: string; stableId: string; name: string; position: Plain3; rotation: PlainQ; scale: Plain3; components: ComponentSpec[] }>;
  session: { id: string; etat: SessionState; sondages: number; logs: LogEntry[] } | null;
  compteur: number;
  pannesJouees: string[];
};

export function etatInitial(): EtatSimulation {
  return { projet: null, verse: {}, verseCompile: null, devices: {}, entities: {}, session: null, compteur: 0, pannesJouees: [] };
}

export interface DepotSimulation {
  lire(): Promise<EtatSimulation>;
  ecrire(etat: EtatSimulation): Promise<void>;
}

export class DepotMemoire implements DepotSimulation {
  constructor(private etat: EtatSimulation = etatInitial()) {}
  async lire() {
    return structuredClone(this.etat);
  }
  async ecrire(e: EtatSimulation) {
    this.etat = structuredClone(e);
  }
}

/**
 * `realiste` rejoue une fois chacune des pannes connues du vrai MCP : un
 * placement qui répond « succès » sans rien créer, et un gel de l'éditeur
 * après une création d'entité. `aucune` sert aux tests qui isolent autre chose.
 */
export type ModePannes = 'aucune' | 'realiste';

export type OptionsMock = {
  pannes?: ModePannes;
  /** Multiplicateur des latences simulées. 0 dans les tests. */
  latence?: number;
  /** Nombre de joueurs simulés dans une partie. */
  joueurs?: number;
};

const LATENCES_MS = {
  inspecter: 150,
  ecrire: 300,
  compiler: 1600,
  placer: 250,
  configurer: 150,
  entite: 350,
  demarrer: 1200,
  sonder: 600,
  logs: 400,
  arreter: 300,
};

const CATALOGUE: DeviceDefinition[] = [
  { deviceType: 'player_spawner_device', displayName: 'Apparition de joueur', properties: ['team', 'enabled'] },
  { deviceType: 'creature_spawner_device', displayName: 'Générateur de créatures', properties: ['creature_type', 'max_spawned', 'health_multiplier', 'spawn_rate'] },
  { deviceType: 'timer_device', displayName: 'Minuteur', properties: ['duration', 'visible'] },
  { deviceType: 'round_settings_device', displayName: 'Réglages de manche', properties: ['rounds', 'round_end_condition'] },
  { deviceType: 'elimination_manager_device', displayName: 'Gestionnaire d’éliminations', properties: ['target_type'] },
  { deviceType: 'score_manager_device', displayName: 'Gestionnaire de score', properties: ['score_per_elimination'] },
  { deviceType: 'hud_message_device', displayName: 'Message HUD', properties: ['message', 'duration'] },
  { deviceType: 'item_granter_device', displayName: 'Distributeur d’objets', properties: ['item', 'grant_on_spawn'] },
  { deviceType: 'vending_machine_device', displayName: 'Distributeur automatique', properties: ['currency', 'items'] },
  { deviceType: 'end_game_device', displayName: 'Fin de partie', properties: ['winning_team'] },
  { deviceType: 'barrier_device', displayName: 'Barrière', properties: ['enabled'] },
  { deviceType: 'tracker_device', displayName: 'Suivi d’objectif', properties: ['target_value'] },
];

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

export class MockUEFNProvider implements UEFNProvider {
  readonly kind = 'mock' as const;
  private readonly pannes: ModePannes;
  private readonly latence: number;
  private readonly joueurs: number;

  constructor(
    private readonly depot: DepotSimulation,
    options: OptionsMock = {},
  ) {
    this.pannes = options.pannes ?? 'realiste';
    this.latence = options.latence ?? 1;
    this.joueurs = options.joueurs ?? 4;
  }

  private async attendre(op: keyof typeof LATENCES_MS) {
    const ms = LATENCES_MS[op] * this.latence;
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  }

  private async avec<T>(op: keyof typeof LATENCES_MS, f: (e: EtatSimulation) => T | Promise<T>, ecrire = true): Promise<T> {
    await this.attendre(op);
    const e = await this.depot.lire();
    e.compteur += 1;
    try {
      const r = await f(e);
      if (ecrire) await this.depot.ecrire(e);
      return r;
    } catch (err) {
      // Une panne après effet (gel) garde l'effet : c'est tout l'intérêt.
      await this.depot.ecrire(e);
      throw err;
    }
  }

  /** Une panne ne se joue qu'une fois par projet, pour rester lisible et reproductible. */
  private panne(e: EtatSimulation, nom: string, condition: boolean): boolean {
    if (this.pannes !== 'realiste' || !condition || e.pannesJouees.includes(nom)) return false;
    e.pannesJouees.push(nom);
    return true;
  }

  private exiger(e: EtatSimulation) {
    if (!e.projet) throw new Error('Aucun projet ouvert dans l’éditeur simulé.');
  }

  // ─── Projet ─────────────────────────────────────────────────────────────

  async inspectProject(): Promise<ProjectSnapshot> {
    return this.avec('inspecter', (e) => ({
      exists: !!e.projet,
      name: e.projet?.nom ?? null,
      verseFiles: Object.entries(e.verse).map(([path, f]) => ({ path, content: f.content, hash: f.hash })),
      devices: Object.values(e.devices).map((d) => this.versInstance(d)),
      entities: Object.values(e.entities).map((x) => this.versEntite(x)),
    }), false);
  }

  async createProject(name: string): Promise<void> {
    await this.avec('ecrire', (e) => {
      if (!e.projet) e.projet = { nom: name };
    });
  }

  // ─── Verse ──────────────────────────────────────────────────────────────

  async listVerseFiles(): Promise<VerseFile[]> {
    return this.avec('inspecter', (e) => Object.entries(e.verse).map(([path, f]) => ({ path, content: f.content, hash: f.hash })), false);
  }

  async readVerseFile(path: string): Promise<string | null> {
    return this.avec('inspecter', (e) => e.verse[path]?.content ?? null, false);
  }

  async writeVerseFile(path: string, content: string): Promise<void> {
    await this.avec('ecrire', (e) => {
      this.exiger(e);
      e.verse[path] = { content, hash: hash(content) };
    });
  }

  async searchVerse(query: string): Promise<VerseMatch[]> {
    return this.avec('inspecter', (e) =>
      Object.entries(e.verse).flatMap(([path, f]) =>
        f.content.split('\n').flatMap((text, i) => (text.includes(query) ? [{ path, line: i + 1, text }] : [])),
      ), false);
  }

  async compile(): Promise<CompileResult> {
    const debut = Date.now();
    return this.avec('compiler', (e) => {
      this.exiger(e);
      const r = compilerSimule(
        Object.entries(e.verse).map(([path, f]) => ({ path, content: f.content })),
        (e.projet?.nom ?? 'Projet').replace(/\s+/g, ''),
      );
      if (r.ok) e.verseCompile = Object.fromEntries(Object.entries(e.verse).map(([p, f]) => [p, f.content]));
      return { ok: r.ok, output: r.output, durationMs: Date.now() - debut };
    });
  }

  // ─── Devices ────────────────────────────────────────────────────────────

  async listDeviceCatalog(): Promise<DeviceDefinition[]> {
    return this.avec('inspecter', () => CATALOGUE, false);
  }

  async listPlacedDevices(): Promise<DeviceInstance[]> {
    return this.avec('inspecter', (e) => Object.values(e.devices).map((d) => this.versInstance(d)), false);
  }

  async placeDevice(type: string, at: LUFVector, label: string): Promise<DeviceInstance> {
    return this.avec('placer', (e) => {
      this.exiger(e);
      if (!CATALOGUE.some((c) => c.deviceType === type)) {
        throw new Error(`Device inconnu du catalogue : ${type}`);
      }
      const id = `dev_${hash(label + e.compteur)}`;
      const d = { id, label, deviceType: type, position: { ...versXYZ(at) }, properties: {} };
      // Panne connue : le MCP répond « succès » mais rien n'est créé. Seule
      // une relecture (listPlacedDevices) peut le voir.
      const placements = Object.keys(e.devices).length;
      if (this.panne(e, 'succes_sans_effet', placements === 2)) return this.versInstance(d);
      e.devices[id] = d;
      return this.versInstance(d);
    });
  }

  async configureDevice(id: string, props: Record<string, unknown>): Promise<void> {
    await this.avec('configurer', (e) => {
      const d = e.devices[id];
      if (!d) throw new Error(`Device ${id} introuvable.`);
      d.properties = { ...d.properties, ...props };
    });
  }

  // ─── Scene Graph ────────────────────────────────────────────────────────

  async listEntities(): Promise<SceneEntity[]> {
    return this.avec('inspecter', (e) => Object.values(e.entities).map((x) => this.versEntite(x)), false);
  }

  async createEntity(spec: EntitySpec): Promise<SceneEntity> {
    return this.avec('entite', (e) => {
      this.exiger(e);
      const t = transformVersXYZ(spec.transform);
      const id = `ent_${hash(spec.stableId + e.compteur)}`;
      e.entities[id] = {
        id,
        stableId: spec.stableId,
        name: spec.name,
        position: { ...t.position },
        rotation: { ...t.rotation },
        scale: { ...t.scale },
        components: spec.components,
      };
      // Panne connue : l'éditeur se fige APRÈS avoir créé l'entité. L'appel
      // expire, mais l'objet existe — une reprise naïve créerait un doublon.
      if (this.panne(e, 'gel_apres_creation', Object.keys(e.entities).length === 1)) {
        throw new PanneEditeur('editor_hang', 'L’éditeur ne répond plus (délai de 30 s dépassé pendant scene_graph.create_entity).');
      }
      return this.versEntite(e.entities[id]!);
    });
  }

  async addComponent(entityId: string, component: ComponentSpec): Promise<void> {
    await this.avec('entite', (e) => {
      const x = e.entities[entityId];
      if (!x) throw new Error(`Entité ${entityId} introuvable.`);
      x.components.push(component);
    });
  }

  async setTransform(entityId: string, transform: LUFTransform): Promise<void> {
    await this.avec('entite', (e) => {
      const x = e.entities[entityId];
      if (!x) throw new Error(`Entité ${entityId} introuvable.`);
      const t = transformVersXYZ(transform);
      x.position = { ...t.position };
      x.rotation = { ...t.rotation };
      x.scale = { ...t.scale };
    });
  }

  // ─── Session ────────────────────────────────────────────────────────────

  async startPlaytest(): Promise<SessionHandle> {
    return this.avec('demarrer', (e) => {
      this.exiger(e);
      const id = `pie_${e.compteur}`;
      e.session = { id, etat: 'starting', sondages: 0, logs: [] };
      return { id };
    });
  }

  async getSessionState(handle: SessionHandle): Promise<SessionState> {
    return this.avec('sonder', (e) => {
      const s = e.session;
      if (!s || s.id !== handle.id) return 'stopped';
      s.sondages += 1;
      // Le client met un moment à se connecter : la session passe à
      // « running » au deuxième sondage, et la partie se joue alors.
      if (s.etat === 'starting' && s.sondages >= 2) {
        s.etat = 'running';
        const devices: Record<string, number> = {};
        for (const d of Object.values(e.devices)) devices[d.deviceType] = (devices[d.deviceType] ?? 0) + 1;
        s.logs = e.verseCompile
          ? executerPartie({ fichiers: e.verseCompile, devices, joueurs: this.joueurs })
          : [{ at: new Date().toISOString(), level: 'warning', text: 'LogVerse: no compiled Verse code, session running without scripts' }];
      }
      return s.etat;
    });
  }

  async getLogs(): Promise<LogEntry[]> {
    return this.avec('logs', (e) => e.session?.logs ?? [], false);
  }

  async stopPlaytest(handle: SessionHandle): Promise<void> {
    await this.avec('arreter', (e) => {
      if (e.session?.id === handle.id) e.session.etat = 'stopped';
    });
  }

  // ─── Conversions ────────────────────────────────────────────────────────

  private versInstance(d: EtatSimulation['devices'][string]): DeviceInstance {
    return {
      id: d.id,
      label: d.label,
      deviceType: d.deviceType,
      position: versLUF(xyz(d.position.x, d.position.y, d.position.z)),
      properties: d.properties,
    };
  }

  private versEntite(x: EtatSimulation['entities'][string]): SceneEntity {
    const t: XYZTransform = {
      position: xyz(x.position.x, x.position.y, x.position.z),
      rotation: xyzQuat(x.rotation.x, x.rotation.y, x.rotation.z, x.rotation.w),
      scale: xyz(x.scale.x, x.scale.y, x.scale.z),
    };
    return { id: x.id, stableId: x.stableId, name: x.name, transform: transformVersLUF(t), components: x.components };
  }
}
