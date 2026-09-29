import type { LUFTransform, LUFVector } from '@/lib/uefn/coordinates';

/**
 * La seule porte vers UEFN (section 10).
 *
 * Aucune logique métier n'appelle un outil MCP directement : tout passe par
 * cette interface. Le MCP est en bêta, ses outils vont changer de nom et de
 * forme — ce jour-là, on modifie une implémentation, pas l'orchestrateur.
 *
 * Toutes les positions sont en Left-Up-Forward. La conversion vers le XYZ du
 * MCP se fait dans l'implémentation, par l'adaptateur de coordonnées.
 *
 * Écart assumé avec la section 10 : `placeDevice` et `createEntity` prennent
 * un identifiant stable. Sans lui, une reprise après un gel de l'éditeur ne
 * peut pas savoir si l'objet existe déjà — et crée un doublon.
 */

export type VerseFile = { path: string; content: string; hash: string };
export type VerseMatch = { path: string; line: number; text: string };

export type CompileResult = {
  ok: boolean;
  /** Sortie brute du compilateur, toujours conservée. */
  output: string;
  durationMs: number;
};

export type DeviceDefinition = {
  deviceType: string;
  displayName: string;
  properties: string[];
};

export type DeviceInstance = {
  id: string;
  /** Identifiant stable dérivé du GameSpec, posé en étiquette dans UEFN. */
  label: string;
  deviceType: string;
  position: LUFVector;
  properties: Record<string, unknown>;
};

export type ComponentSpec = { type: string; properties?: Record<string, unknown> };
export type EntitySpec = { stableId: string; name: string; transform: LUFTransform; components: ComponentSpec[] };
export type SceneEntity = { id: string; stableId: string; name: string; transform: LUFTransform; components: ComponentSpec[] };

export type ProjectSnapshot = {
  exists: boolean;
  name: string | null;
  verseFiles: VerseFile[];
  devices: DeviceInstance[];
  entities: SceneEntity[];
};

export type SessionHandle = { id: string };
export type SessionState = 'starting' | 'running' | 'stopped' | 'failed';
export type LogEntry = { at: string; level: 'info' | 'warning' | 'error'; text: string };

export interface UEFNProvider {
  readonly kind: 'mock' | 'mcp';

  // Projet
  inspectProject(): Promise<ProjectSnapshot>;
  createProject(name: string): Promise<void>;

  // Verse
  listVerseFiles(): Promise<VerseFile[]>;
  readVerseFile(path: string): Promise<string | null>;
  writeVerseFile(path: string, content: string): Promise<void>;
  searchVerse(query: string): Promise<VerseMatch[]>;
  compile(): Promise<CompileResult>;

  // Devices
  listDeviceCatalog(): Promise<DeviceDefinition[]>;
  listPlacedDevices(): Promise<DeviceInstance[]>;
  placeDevice(type: string, at: LUFVector, label: string): Promise<DeviceInstance>;
  configureDevice(id: string, props: Record<string, unknown>): Promise<void>;

  // Scene Graph
  listEntities(): Promise<SceneEntity[]>;
  createEntity(spec: EntitySpec): Promise<SceneEntity>;
  addComponent(entityId: string, component: ComponentSpec): Promise<void>;
  setTransform(entityId: string, transform: LUFTransform): Promise<void>;

  // Session
  startPlaytest(): Promise<SessionHandle>;
  stopPlaytest(handle: SessionHandle): Promise<void>;
  getSessionState(handle: SessionHandle): Promise<SessionState>;
  getLogs(since?: Date): Promise<LogEntry[]>;
}

/**
 * Pannes imputables à la plateforme — éditeur figé, MCP injoignable, agent
 * local tombé. Elles déclenchent une reprise, et un remboursement si le build
 * échoue à cause d'elles (section 2.2 de l'offre, règle 5).
 */
export class PanneEditeur extends Error {
  readonly plateforme = true;
  constructor(
    readonly categorie: 'mcp_timeout' | 'editor_hang' | 'mcp_unreachable',
    message: string,
  ) {
    super(message);
    this.name = 'PanneEditeur';
  }
}

export function estPannePlateforme(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { plateforme?: unknown }).plateforme === true;
}
