import 'server-only';
import { createHash } from 'node:crypto';
import type { AgentSession, BuildTask, Prisma } from '@prisma/client';
import type { GameSpec } from '@/lib/gamespec/schema';
import { genererMetadonnees, verifierPrepublication } from '@/lib/orchestrateur/prepublication';
import { evaluer, genererTests, mesurer } from '@/lib/tests';
import { luf, type LUFTransform, type LUFVector } from '@/lib/uefn/coordinates';
import { PanneEditeur, type UEFNProvider } from '@/lib/uefn/provider';
import { analyserSortieCompilateur, erreursSeulement } from '@/lib/verse/erreurs';
import { db } from '@/server/db';
import { appelIA } from '@/server/ia';
import { emettre } from '@/server/orchestrateur/evenements';

/**
 * Exécutants de tâches (sections 11 à 18).
 *
 * Règle commune, non négociable : **une tâche n'est jamais réputée réussie.**
 * Après chaque écriture, on relit. Après chaque placement, on liste. Après
 * chaque compilation, on lit le résultat. Le MCP peut répondre « succès » sans
 * que l'effet soit là.
 *
 * Chaque exécutant est aussi IDEMPOTENT : il vérifie l'existence avant de
 * créer. Rejoué après un gel de l'éditeur, il ne crée pas de doublon.
 */

export type Contexte = {
  session: AgentSession;
  tache: BuildTask;
  userId: string;
  spec: GameSpec;
  uefn: UEFNProvider;
  maxCorrectionsParFichier: number;
};

export type Diagnostic = { fichier: string | null; brut: string; ligne: number | null; categorie: string; buildErrorId: string };

export type Issue =
  | { ok: true; resultat?: Record<string, unknown>; message?: string }
  | { ok: false; raison: 'plateforme'; message: string }
  | { ok: false; raison: 'verification'; message: string }
  | { ok: false; raison: 'compilation'; message: string; diagnostics: Diagnostic[]; resultat: Record<string, unknown> }
  | { ok: false; raison: 'gameplay'; message: string; diagnostics: Diagnostic[] }
  | { ok: false; raison: 'autre'; message: string };

const DELAI_MS = 30_000;

/** Délai sur chaque appel à l'éditeur : un gel devient une panne explicite, pas une attente infinie. */
async function avecDelai<T>(operation: string, p: Promise<T>): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new PanneEditeur('mcp_timeout', `Délai dépassé (${DELAI_MS / 1000} s) pendant ${operation}.`)), DELAI_MS);
  });
  try {
    return await Promise.race([p, delai]);
  } finally {
    clearTimeout(minuteur);
  }
}

/** Lignes ajoutées + retirées, comptées comme des multiensembles : insérer une ligne en tête vaut 1, pas 12. */
function lignesModifiees(avant: string, apres: string): number {
  const compte = new Map<string, number>();
  for (const l of avant.split('\n')) compte.set(l, (compte.get(l) ?? 0) + 1);
  let ajoutees = 0;
  for (const l of apres.split('\n')) {
    const n = compte.get(l) ?? 0;
    if (n > 0) compte.set(l, n - 1);
    else ajoutees++;
  }
  const retirees = [...compte.values()].reduce((a, b) => a + b, 0);
  return ajoutees + retirees;
}

const empreinte = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const ev = (c: Contexte) => ({ sessionId: c.session.id, projectId: c.session.projectId });

/** Module Verse responsable de chaque type de test : c'est lui qu'on corrige. */
const MODULE_DU_TEST: Record<string, string> = {
  round_starts: 'round_manager',
  win_reachable: 'round_manager',
  enemies_spawn: 'zombie_spawner',
  boss_appears: 'zombie_spawner',
  elimination_rewards: 'currency_system',
  hud_ready: 'hud_manager',
  players_spawn: 'game_manager',
  lose_possible: 'game_manager',
};

// ─── Exécutants ──────────────────────────────────────────────────────────

async function verifierPlan(c: Contexte): Promise<Issue> {
  const catalogue = await db.deviceDefinition.findMany({ select: { deviceType: true, verifiedAt: true } });
  const connus = new Set(catalogue.map((d) => d.deviceType));
  const inconnus = [...new Set(c.spec.devices.map((d) => d.deviceType))].filter((t) => !connus.has(t));
  if (inconnus.length) return { ok: false, raison: 'autre', message: `Devices absents du registre : ${inconnus.join(', ')}` };

  // Le catalogue de l'éditeur lui-même : un device du plan qu'il ne connaît
  // pas serait refusé au placement, autant le savoir maintenant.
  const editeur = new Set((await avecDelai('device.list_catalog', c.uefn.listDeviceCatalog())).map((d) => d.deviceType));
  const refuses = [...new Set(c.spec.devices.map((d) => d.deviceType))].filter((t) => !editeur.has(t));
  if (refuses.length) return { ok: false, raison: 'autre', message: `L’éditeur ne connaît pas : ${refuses.join(', ')}` };

  const jamaisVerifies = catalogue.filter((d) => !d.verifiedAt).length;
  return {
    ok: true,
    message: `${c.spec.devices.length} devices du plan présents au catalogue${jamaisVerifies ? ` (catalogue simulé, ${jamaisVerifies} devices jamais vérifiés contre le vrai MCP)` : ''}.`,
  };
}

async function creerProjet(c: Contexte): Promise<Issue> {
  const avant = await avecDelai('project.inspect', c.uefn.inspectProject());
  if (!avant.exists) await avecDelai('project.create', c.uefn.createProject(c.spec.title));
  const apres = await avecDelai('project.inspect', c.uefn.inspectProject());
  if (!apres.exists) return { ok: false, raison: 'verification', message: 'L’éditeur a répondu, mais le projet n’existe pas à la relecture.' };
  return { ok: true, message: avant.exists ? 'Projet déjà présent, rien recréé.' : `Projet « ${apres.name} » créé et relu.` };
}

async function creerEntite(c: Contexte): Promise<Issue> {
  const input = c.tache.input as { stableId: string; name: string; transform: LUFTransform; components: { type: string }[] };
  const existantes = await avecDelai('scene_graph.list', c.uefn.listEntities());
  if (!existantes.some((e) => e.stableId === input.stableId)) {
    await avecDelai('scene_graph.create_entity', c.uefn.createEntity(input));
  }
  const relues = await avecDelai('scene_graph.list', c.uefn.listEntities());
  const trouvee = relues.find((e) => e.stableId === input.stableId);
  if (!trouvee) return { ok: false, raison: 'verification', message: `Entité ${input.stableId} absente à la relecture.` };
  const doublons = relues.filter((e) => e.stableId === input.stableId).length;
  if (doublons > 1) return { ok: false, raison: 'verification', message: `${doublons} entités ${input.stableId} : doublon détecté.` };
  return { ok: true, message: `Zone ${input.name} présente (${trouvee.id}).` };
}

async function placerDevice(c: Contexte): Promise<Issue> {
  const input = c.tache.input as { deviceType: string; label: string; position: { left: number; up: number; forward: number } };
  const position: LUFVector = luf(input.position.left, input.position.up, input.position.forward);
  const places = await avecDelai('device.list_placed', c.uefn.listPlacedDevices());
  if (!places.some((d) => d.label === input.label)) {
    await avecDelai('device.place', c.uefn.placeDevice(input.deviceType, position, input.label));
  }
  const relus = await avecDelai('device.list_placed', c.uefn.listPlacedDevices());
  const trouve = relus.find((d) => d.label === input.label);
  if (!trouve) {
    return { ok: false, raison: 'verification', message: `L’éditeur a répondu « placé », mais « ${input.label} » est absent à la relecture.` };
  }
  return { ok: true, resultat: { uefnId: trouve.id }, message: `${input.deviceType} « ${input.label} » présent (${trouve.id}).` };
}

async function configurerDevice(c: Contexte): Promise<Issue> {
  const input = c.tache.input as { label: string; properties: Record<string, unknown> };
  const places = await avecDelai('device.list_placed', c.uefn.listPlacedDevices());
  const d = places.find((x) => x.label === input.label);
  if (!d) return { ok: false, raison: 'verification', message: `« ${input.label} » introuvable : impossible de le configurer.` };
  if (Object.keys(input.properties).length) await avecDelai('device.set_properties', c.uefn.configureDevice(d.id, input.properties));
  const relu = (await avecDelai('device.list_placed', c.uefn.listPlacedDevices())).find((x) => x.label === input.label);
  const manquantes = Object.entries(input.properties).filter(([k, v]) => relu?.properties[k] !== v).map(([k]) => k);
  if (manquantes.length) return { ok: false, raison: 'verification', message: `Propriétés non appliquées : ${manquantes.join(', ')}` };
  return { ok: true, message: `« ${input.label} » configuré (${Object.keys(input.properties).length} propriété(s) relue(s)).` };
}

async function ecrireModule(c: Contexte): Promise<Issue> {
  const input = c.tache.input as {
    module: string;
    path: string;
    responsibility: string;
    empreinte?: string;
    /** Mise à jour : empreinte des données et du fichier à la génération précédente. */
    anterieur?: { empreinte: string; hash: string };
  };
  const precedent = c.tache.result as { contenu?: string } | null;

  // Mise à jour : si les données de ce module n'ont pas changé, on ne
  // régénère rien. On relit le fichier réel pour savoir quoi dire.
  if (input.anterieur && input.anterieur.empreinte === input.empreinte) {
    const reel = await avecDelai('verse.read', c.uefn.readVerseFile(input.path));
    if (reel !== null) {
      const intact = empreinte(reel) === input.anterieur.hash;
      return {
        ok: true,
        message: intact
          ? `${input.path} inchangé depuis la version précédente : rien régénéré, rien réécrit.`
          : `${input.path} a été modifié dans UEFN depuis la dernière génération : conservé tel quel.`,
      };
    }
  }

  // Rejoué après une interruption : on réutilise le code déjà généré au lieu
  // de repayer un appel d'IA.
  let contenu = precedent?.contenu;
  if (!contenu) {
    const existant = await avecDelai('verse.read', c.uefn.readVerseFile(input.path));
    const r = await appelIA({ userId: c.userId, projectId: c.session.projectId, buildId: c.session.id, type: 'verse' }, (ia) =>
      ia.codeGeneration({
        intention: 'module',
        chemin: input.path,
        consigne: input.responsibility,
        contexte: JSON.stringify({
          titre: c.spec.title,
          joueurs: c.spec.playerCount,
          manches: c.spec.rounds,
          devices: c.spec.devices.map((d) => ({ id: d.stableId, type: d.deviceType })),
          modules: c.spec.verseModules,
          ui: c.spec.ui,
          monnaie: c.spec.currency,
        }),
        simulation: { spec: c.spec, module: input.module, premiere: existant === null },
      }),
    );
    contenu = r.valeur;
    await db.buildTask.update({ where: { id: c.tache.id }, data: { result: { contenu } } });
  }

  await avecDelai('verse.write', c.uefn.writeVerseFile(input.path, contenu));
  const relu = await avecDelai('verse.read', c.uefn.readVerseFile(input.path));
  if (relu === null || empreinte(relu) !== empreinte(contenu)) {
    return { ok: false, raison: 'verification', message: `${input.path} relu différent de ce qui a été écrit.` };
  }
  return { ok: true, resultat: { contenu, lignes: contenu.split('\n').length }, message: `${input.path} écrit et relu (${contenu.split('\n').length} lignes).` };
}

async function compiler(c: Contexte): Promise<Issue> {
  const r = await avecDelai('verse.compile', c.uefn.compile());
  const analyse = analyserSortieCompilateur(r.output);
  const erreurs = erreursSeulement(analyse);
  const resultat = { ok: r.ok, output: r.output, durationMs: r.durationMs, erreurs: erreurs.length };

  // Le résultat se LIT : un code de retour « ok » avec des erreurs dans la
  // sortie n'est pas une compilation réussie.
  if (r.ok && erreurs.length === 0) return { ok: true, resultat, message: 'Compilation réussie, 0 erreur.' };

  const diagnostics: Diagnostic[] = [];
  for (const d of erreurs) {
    const e = await db.buildError.create({
      data: {
        projectId: c.session.projectId,
        sessionId: c.session.id,
        category: d.categorie,
        severity: 'blocking',
        source: { fichier: d.fichier, ligne: d.ligne, colonne: d.colonne, code: d.code } as Prisma.InputJsonValue,
        raw: d.brut,
        evidence: [],
      },
    });
    diagnostics.push({ fichier: d.fichier, brut: d.brut, ligne: d.ligne, categorie: d.categorie, buildErrorId: e.id });
    await emettre(ev(c), 'erreur', d.brut, { niveau: 'fail', taskKey: c.tache.key, data: { fichier: d.fichier, ligne: d.ligne } });
  }
  for (const brut of analyse.nonReconnues) {
    await emettre(ev(c), 'erreur', `Ligne non reconnue par le parseur : ${brut}`, { niveau: 'warn', taskKey: c.tache.key });
  }
  return { ok: false, raison: 'compilation', message: `${erreurs.length} erreur(s) de compilation.`, diagnostics, resultat };
}

async function demarrerPlaytest(c: Contexte): Promise<Issue> {
  const handle = await avecDelai('session.start', c.uefn.startPlaytest());
  // Attente bornée de la connexion du client : une session qui ne démarre pas
  // est un échec explicite, pas une attente infinie (section 18).
  for (let i = 0; i < 20; i++) {
    const etat = await avecDelai('session.state', c.uefn.getSessionState(handle));
    if (etat === 'running') return { ok: true, resultat: { handle }, message: `Client connecté (session ${handle.id}).` };
    if (etat === 'failed' || etat === 'stopped') return { ok: false, raison: 'plateforme', message: `La session s’est arrêtée avant de démarrer (${etat}).` };
  }
  return { ok: false, raison: 'plateforme', message: 'Le client ne s’est pas connecté dans le délai imparti.' };
}

async function testerPartie(c: Contexte): Promise<Issue> {
  const logs = await avecDelai('session.get_logs', c.uefn.getLogs());
  for (const l of logs) {
    await emettre(ev(c), 'log', l.text, { niveau: l.level === 'error' ? 'fail' : l.level === 'warning' ? 'warn' : 'info', taskKey: c.tache.key });
  }

  const tests = genererTests(c.spec);
  const specs = await Promise.all(
    tests.map((t) =>
      db.testSpec.upsert({
        where: { projectId_specVersion_key: { projectId: c.session.projectId, specVersion: c.spec.version, key: t.key } },
        create: { projectId: c.session.projectId, specVersion: c.spec.version, ...t },
        update: {},
      }),
    ),
  );

  const { mesures, preuves } = mesurer(logs);
  const run = await db.testRun.create({
    data: { sessionId: c.session.id, attempt: c.tache.attempt, startedAt: new Date(), logCount: logs.length },
  });

  const diagnostics: Diagnostic[] = [];
  let passes = 0;
  for (const [i, t] of tests.entries()) {
    const v = evaluer(t, mesures, preuves);
    await db.testResult.create({ data: { runId: run.id, testSpecId: specs[i]!.id, passed: v.passe, observed: v.observe, evidence: v.preuves } });
    await emettre(ev(c), 'test', `${v.passe ? 'Réussi' : 'Échoué'} — ${t.description} (${t.assertion} ; observé : ${v.observe})`, {
      niveau: v.passe ? 'ok' : t.severity === 'blocking' ? 'fail' : 'warn',
      taskKey: c.tache.key,
    });
    if (v.passe) {
      passes++;
      continue;
    }
    if (t.severity !== 'blocking') continue;

    const exigence = c.spec.testRequirements.find((r) => r.id === t.key);
    const moduleVise = exigence ? MODULE_DU_TEST[exigence.kind] : undefined;
    const brut = `Test « ${t.key} » échoué : ${t.assertion} attendu, observé ${v.observe}.`;
    const e = await db.buildError.create({
      data: {
        projectId: c.session.projectId,
        sessionId: c.session.id,
        category: 'gameplay_error',
        severity: 'blocking',
        source: { test: t.key, fichier: moduleVise ? `${moduleVise}.verse` : null } as Prisma.InputJsonValue,
        raw: brut,
        evidence: v.preuves,
      },
    });
    diagnostics.push({ fichier: moduleVise ? `${moduleVise}.verse` : null, brut, ligne: null, categorie: 'gameplay_error', buildErrorId: e.id });
  }

  // Les erreurs d'exécution des logs sont conservées telles quelles.
  for (const l of logs.filter((x) => x.level === 'error')) {
    await db.buildError.create({
      data: { projectId: c.session.projectId, sessionId: c.session.id, category: 'runtime_error', severity: 'blocking', source: {}, raw: l.text, evidence: [l.text] },
    });
  }

  await db.testRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), passed: passes, failed: tests.length - passes } });

  if (diagnostics.length) return { ok: false, raison: 'gameplay', message: `${diagnostics.length} test(s) bloquant(s) en échec.`, diagnostics };
  return { ok: true, resultat: { passes, total: tests.length, logs: logs.length }, message: `${passes}/${tests.length} tests réussis sur ${logs.length} lignes de log.` };
}

async function arreterPlaytest(c: Contexte): Promise<Issue> {
  const debut = await db.buildTask.findFirst({ where: { planId: c.tache.planId, key: 'playtest:start' } });
  const handle = (debut?.result as { handle?: { id: string } } | null)?.handle;
  if (handle) {
    await avecDelai('session.stop', c.uefn.stopPlaytest(handle));
    const etat = await avecDelai('session.state', c.uefn.getSessionState(handle));
    if (etat !== 'stopped') return { ok: false, raison: 'verification', message: `Session encore « ${etat} » après l’arrêt.` };
  }
  return { ok: true, message: 'Session arrêtée.' };
}

async function analyserErreur(c: Contexte): Promise<Issue> {
  const input = c.tache.input as { buildErrorId: string; fichier: string | null; brut: string; ligne: number | null; categorie: string };
  const contenu = input.fichier ? await avecDelai('verse.read', c.uefn.readVerseFile(input.fichier)) : null;
  const r = await appelIA({ userId: c.userId, projectId: c.session.projectId, buildId: c.session.id, type: 'analyse' }, (ia) =>
    ia.analyze({ brut: input.brut, fichier: input.fichier, ligne: input.ligne, contenuFichier: contenu, categorie: input.categorie }),
  );
  await db.buildError.update({
    where: { id: input.buildErrorId },
    data: { suggestedFix: `${r.valeur.cause} — ${r.valeur.strategie}`, fixStatus: 'proposed' },
  });
  return { ok: true, resultat: { ...r.valeur }, message: r.valeur.cause };
}

async function appliquerCorrectif(c: Contexte): Promise<Issue> {
  const input = c.tache.input as { buildErrorId: string; fichier: string | null; brut: string; ligne: number | null; categorie: string };
  if (!input.fichier) return { ok: false, raison: 'autre', message: 'Erreur sans fichier identifié : correction automatique impossible.' };

  const actuel = await avecDelai('verse.read', c.uefn.readVerseFile(input.fichier));
  if (actuel === null) return { ok: false, raison: 'verification', message: `${input.fichier} introuvable dans le projet.` };

  const r = await appelIA({ userId: c.userId, projectId: c.session.projectId, buildId: c.session.id, type: 'correctif' }, (ia) =>
    ia.codeGeneration({
      intention: 'correctif',
      chemin: input.fichier!,
      consigne: 'Corriger l’erreur en modifiant le minimum nécessaire.',
      contexte: JSON.stringify({ modules: c.spec.verseModules.map((m) => m.name) }),
      contenuActuel: actuel,
      erreur: { brut: input.brut, fichier: input.fichier, ligne: input.ligne, contenuFichier: actuel, categorie: input.categorie },
    }),
  );

  if (r.valeur === actuel) {
    await db.buildError.update({ where: { id: input.buildErrorId }, data: { fixStatus: 'failed' } });
    return { ok: false, raison: 'autre', message: `Aucun correctif trouvé pour ${input.fichier} : le fichier est inchangé.` };
  }

  await avecDelai('verse.write', c.uefn.writeVerseFile(input.fichier, r.valeur));
  const relu = await avecDelai('verse.read', c.uefn.readVerseFile(input.fichier));
  if (relu !== r.valeur) return { ok: false, raison: 'verification', message: `${input.fichier} relu différent du correctif écrit.` };

  await db.buildError.update({ where: { id: input.buildErrorId }, data: { fixStatus: 'applied' } });
  const changees = lignesModifiees(actuel, r.valeur);
  return { ok: true, resultat: { fichier: input.fichier, avant: actuel, apres: r.valeur }, message: `${input.fichier} corrigé (${changees} ligne(s) modifiée(s)), relu.` };
}

async function prepublier(c: Contexte): Promise<Issue> {
  const snap = await avecDelai('project.inspect', c.uefn.inspectProject());
  const run = await db.testRun.findFirst({
    where: { sessionId: c.session.id },
    orderBy: { startedAt: 'desc' },
    include: { results: { include: { spec: true } } },
  });
  const compile = await db.buildTask.findFirst({ where: { planId: c.tache.planId, key: 'compile' } });
  const resultats = run?.results ?? [];
  const bloquants = resultats.filter((r) => r.spec.severity === 'blocking');
  const passe = (kind: string) => {
    const id = c.spec.testRequirements.find((t) => t.kind === kind)?.id;
    return !!resultats.find((r) => r.spec.key === id)?.passed;
  };
  const erreursExecution = await db.buildError.count({ where: { sessionId: c.session.id, category: 'runtime_error' } });
  const meta = genererMetadonnees(c.spec);

  const verdict = verifierPrepublication({
    spec: c.spec,
    compilationReussie: (compile?.result as { ok?: boolean } | null)?.ok === true,
    erreursExecution,
    devicesPresents: snap.devices.map((d) => d.label),
    apparitionsJoueur: snap.devices.filter((d) => d.deviceType === 'player_spawner_device').length,
    testsBloquants: {
      total: bloquants.length,
      reussis: bloquants.filter((r) => r.passed).length,
      echoues: bloquants.filter((r) => !r.passed).map((r) => r.spec.key),
    },
    testVictoireReussi: passe('win_reachable'),
    testDefaiteReussi: passe('lose_possible'),
    metadonnees: meta,
  });

  await db.prePublishCheck.create({
    data: {
      projectId: c.session.projectId,
      sessionId: c.session.id,
      ready: verdict.pret,
      checks: { controles: verdict.controles, metadonnees: meta } as unknown as Prisma.InputJsonValue,
    },
  });
  const ko = verdict.controles.filter((x) => !x.ok);
  return {
    ok: true,
    resultat: { pret: verdict.pret },
    message: verdict.pret ? 'PRÊT — tous les contrôles de pré-publication sont au vert.' : `PAS PRÊT — ${ko.map((x) => x.libelle).join(' ; ')}.`,
  };
}

const EXECUTANTS: Record<string, (c: Contexte) => Promise<Issue>> = {
  'verify.plan': verifierPlan,
  'project.create': creerProjet,
  'entity.create': creerEntite,
  'device.place': placerDevice,
  'device.configure': configurerDevice,
  'verse.write': ecrireModule,
  'ui.build': ecrireModule,
  'verse.compile': compiler,
  'session.start': demarrerPlaytest,
  'session.test': testerPartie,
  'session.stop': arreterPlaytest,
  'error.analyze': analyserErreur,
  'fix.apply': appliquerCorrectif,
  'verify.prepublish': prepublier,
};

export async function executer(c: Contexte): Promise<Issue> {
  const f = EXECUTANTS[c.tache.type];
  if (!f) return { ok: false, raison: 'autre', message: `Type de tâche inconnu : ${c.tache.type}` };
  try {
    return await f(c);
  } catch (e) {
    if (e instanceof PanneEditeur) return { ok: false, raison: 'plateforme', message: e.message };
    if ((e as { plateforme?: boolean }).plateforme) return { ok: false, raison: 'plateforme', message: (e as Error).message };
    return { ok: false, raison: 'autre', message: (e as Error).message };
  }
}
