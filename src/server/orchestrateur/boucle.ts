import 'server-only';
import { randomUUID } from 'node:crypto';
import type { AgentSession, BuildTask, Prisma } from '@prisma/client';
import { creditsPourCout } from '@/lib/credits/registre';
import { lireGameSpec } from '@/lib/gamespec/schema';
import { ETAPES, prochaineTache } from '@/lib/orchestrateur/plan';
import { PALIERS } from '@/lib/palier';
import { configEntier } from '@/server/config';
import { cloturerBuild, rembourserBuild } from '@/server/credits';
import { db } from '@/server/db';
import { emettre } from '@/server/orchestrateur/evenements';
import { executer, type Diagnostic, type Issue } from '@/server/orchestrateur/executeurs';
import { fournisseurUEFN } from '@/server/orchestrateur/uefn';
import { recalculerPalier } from '@/server/palier';

/**
 * La boucle d'agent (section 11).
 *
 *   tant que le projet n'est pas prêt :
 *     inspecter l'état réel du projet      ← jamais l'état supposé
 *     choisir la prochaine tâche exécutable
 *     exécuter, puis VÉRIFIER par une lecture
 *     si échec : analyser, corriger, recompiler, retester
 *     si budget atteint : arrêter et demander une intervention humaine
 *
 * Un seul exécutant par projet, grâce à un bail en base (et un index unique
 * qui interdit deux générations actives). Les commandes humaines s'appliquent
 * ENTRE deux tâches : un Stop n'interrompt jamais une écriture.
 */

const BAIL_MS = 45_000;
export const EXECUTANT = `${process.env.WORKER_ID || 'web'}:${randomUUID().slice(0, 8)}`;

const ACTIVES = ['queued', 'running'] as const;

type Session = AgentSession & { project: { id: string; userId: string; permissionLevel: number; autonomyConfirmedAt: Date | null } };

async function prendreBail(projectId: string): Promise<boolean> {
  const n = await db.$executeRaw`
    UPDATE "Project"
       SET "leaseOwner" = ${EXECUTANT}, "leaseUntil" = now() + (${BAIL_MS} * interval '1 millisecond')
     WHERE "id" = ${projectId}
       AND ("leaseUntil" IS NULL OR "leaseUntil" < now() OR "leaseOwner" = ${EXECUTANT})`;
  return n === 1;
}

async function rendreBail(projectId: string) {
  await db.$executeRaw`
    UPDATE "Project" SET "leaseUntil" = now() WHERE "id" = ${projectId} AND "leaseOwner" = ${EXECUTANT}`;
}

const libelleEtape = (cle: string) => ETAPES.find((e) => e.cle === cle)?.libelle ?? cle;

/**
 * Fait avancer une session pendant au plus `dureeMs`. Rend la main entre deux
 * tâches : c'est ce qui permet à une requête de la console, comme au worker,
 * de piloter la même session à tour de rôle sans jamais se chevaucher.
 */
export async function avancer(sessionId: string, dureeMs: number): Promise<'occupe' | 'termine' | 'en_cours' | 'en_attente'> {
  const s0 = await db.agentSession.findUnique({ where: { id: sessionId }, select: { projectId: true, status: true } });
  if (!s0) return 'termine';
  if (!(ACTIVES as readonly string[]).includes(s0.status) && s0.status !== 'stopping') return 'en_attente';
  if (!(await prendreBail(s0.projectId))) return 'occupe';

  // Une tâche encore « en cours » alors qu'on vient de prendre le bail a été
  // abandonnée par un exécutant mort en plein travail (éditeur figé, processus
  // tué). On la remet en file : les exécutants sont idempotents, la rejouer
  // ne crée rien en double.
  const orphelines = await db.buildTask.updateMany({
    where: { plan: { sessions: { some: { id: sessionId } } }, status: { in: ['running', 'verifying'] } },
    data: { status: 'pending' },
  });
  if (orphelines.count > 0) {
    await emettre({ sessionId, projectId: s0.projectId }, 'verification', `Reprise après interruption : ${orphelines.count} tâche(s) interrompue(s) remise(s) en file, sans doublon.`, { niveau: 'warn' });
  }

  const fin = Date.now() + dureeMs;
  try {
    while (Date.now() < fin) {
      const r = await unPas(sessionId);
      if (r !== 'continuer') return r;
      await prendreBail(s0.projectId);
    }
    return 'en_cours';
  } finally {
    await rendreBail(s0.projectId);
  }
}

async function unPas(sessionId: string): Promise<'continuer' | 'termine' | 'en_attente'> {
  const session = (await db.agentSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { project: { select: { id: true, userId: true, permissionLevel: true, autonomyConfirmedAt: true } } },
  })) as Session;
  const ctxEv = { sessionId, projectId: session.projectId };

  // Une session close (ou mise en attente) pendant le pas précédent ne doit
  // plus rien exécuter — et surtout pas être clôturée une seconde fois.
  if (session.status === 'completed' || session.status === 'stopped' || session.status === 'failed') return 'termine';
  if (session.status === 'paused' || session.status === 'awaiting_human') return 'en_attente';

  // ─── Commandes humaines, appliquées entre deux tâches ───────────────────
  if (session.pendingCommand) {
    const cmd = session.pendingCommand;
    await db.agentSession.update({ where: { id: sessionId }, data: { pendingCommand: null } });
    if (cmd === 'pause') {
      await db.agentSession.update({ where: { id: sessionId }, data: { status: 'paused' } });
      await emettre(ctxEv, 'session', 'En pause, après la tâche en cours. Rien n’a été interrompu.', { niveau: 'warn' });
      return 'en_attente';
    }
    if (cmd === 'stop' || cmd === 'annuler') {
      await cloturer(session, 'stopped', cmd === 'annuler' ? 'annulee_par_utilisateur' : 'arretee_par_utilisateur');
      return 'termine';
    }
  }

  if (session.status === 'stopping') {
    await cloturer(session, 'stopped', 'arretee_par_utilisateur');
    return 'termine';
  }

  if (session.status === 'queued') {
    await db.agentSession.update({ where: { id: sessionId }, data: { status: 'running', startedAt: session.startedAt ?? new Date() } });
    await emettre(ctxEv, 'session', 'Construction démarrée.', { niveau: 'info' });
  }

  // ─── Budgets (section 26) ───────────────────────────────────────────────
  const offre = await db.subscription.findUnique({ where: { userId: session.project.userId }, include: { plan: { include: { budget: true } } } });
  const budget = offre?.plan.budget ?? (await db.buildBudget.findFirstOrThrow({ where: { plan: { slug: 'createur' } } }));
  const coutParCredit = await configEntier('COST_PER_CREDIT');
  const minutes = session.startedAt ? (Date.now() - session.startedAt.getTime()) / 60_000 : 0;
  const creditsConsommes = creditsPourCout(session.costEurMicros, coutParCredit);

  const maxEtapes = budget.maxAgentSteps + session.stepsAllowance;
  const maxMinutes = budget.maxBuildMinutes + session.minutesAllowance;
  const depassement =
    session.steps >= maxEtapes
      ? { raison: 'budget_etapes', texte: `Limite de ${maxEtapes} étapes atteinte.` }
      : minutes >= maxMinutes
        ? { raison: 'budget_temps', texte: `Limite de ${maxMinutes} minutes atteinte.` }
        : creditsConsommes >= session.creditsReserved && session.creditsReserved > 0
          ? { raison: 'plafond_credits', texte: `Plafond de ${session.creditsReserved} crédits réservés atteint.` }
          : null;

  if (depassement) {
    await db.agentSession.update({ where: { id: sessionId }, data: { status: 'awaiting_human', stopReason: depassement.raison } });
    await emettre(ctxEv, 'budget', `${depassement.texte} Arrêt propre : l’état est conservé. Continuer demandera ta confirmation.`, { niveau: 'warn' });
    return 'en_attente';
  }

  // ─── Choisir la prochaine tâche ─────────────────────────────────────────
  const taches = await db.buildTask.findMany({ where: { planId: session.planId }, orderBy: { order: 'asc' } });
  const tache = prochaineTache(taches);

  if (!tache) {
    const restantes = taches.filter((t) => t.status === 'pending' || t.status === 'running' || t.status === 'verifying');
    if (restantes.length === 0) {
      await cloturer(session, 'completed', null);
      return 'termine';
    }
    // Des tâches attendent une dépendance échouée : c'est un blocage, pas une fin.
    await db.agentSession.update({ where: { id: sessionId }, data: { status: 'awaiting_human', stopReason: 'blocage' } });
    await emettre(ctxEv, 'session', 'Aucune tâche exécutable : une dépendance a échoué. Intervention demandée.', { niveau: 'fail' });
    return 'en_attente';
  }

  // Autorisation : au niveau 4, un correctif est PROPOSÉ puis attend un accord.
  if (tache.type === 'fix.apply' && session.project.permissionLevel < 5 && !(tache.input as { approuve?: boolean }).approuve) {
    await db.agentSession.update({ where: { id: sessionId }, data: { status: 'awaiting_human', stopReason: 'correctif_a_valider' } });
    await emettre(ctxEv, 'correctif', `Correctif proposé pour ${(tache.input as { fichier?: string }).fichier ?? 'le projet'} : il attend ton accord (niveau d’autorisation 4).`, { niveau: 'warn', taskKey: tache.key });
    return 'en_attente';
  }

  // ─── Exécuter ───────────────────────────────────────────────────────────
  const specLigne = await db.gameSpec.findFirstOrThrow({
    where: { projectId: session.projectId, version: (await db.buildPlan.findUniqueOrThrow({ where: { id: session.planId } })).specVersion },
  });
  const lu = lireGameSpec(specLigne.data);
  if (!lu.ok) {
    await cloturer(session, 'failed', 'plan_illisible');
    return 'termine';
  }

  const uefn = fournisseurUEFN(session.projectId, lu.spec.playerCount);
  // État toujours relu avant d'agir : l'utilisateur a pu toucher au projet.
  await uefn.inspectProject();

  const debut = new Date();
  await db.buildTask.update({ where: { id: tache.id }, data: { status: 'running', startedAt: debut, attempt: { increment: 1 } } });
  await emettre(ctxEv, 'tache_debut', tache.description, { taskKey: tache.key, data: { type: tache.type } });

  const courante = await db.buildTask.findUniqueOrThrow({ where: { id: tache.id } });
  const issue = await executer({
    session,
    tache: courante,
    userId: session.project.userId,
    spec: lu.spec,
    uefn,
    maxCorrectionsParFichier: budget.maxRetries,
  });

  await db.agentSession.update({ where: { id: sessionId }, data: { steps: { increment: 1 }, lastHeartbeat: new Date() } });
  await traiterIssue(session, courante, issue, taches, budget.maxRetries);
  await rafraichirEtatObserve(session.projectId, uefn);
  return 'continuer';
}

async function traiterIssue(session: Session, tache: BuildTask, issue: Issue, taches: BuildTask[], maxCorrections: number) {
  const ctxEv = { sessionId: session.id, projectId: session.projectId };
  const duree = Date.now() - (tache.startedAt?.getTime() ?? Date.now());

  if (issue.ok) {
    await db.buildTask.update({
      where: { id: tache.id },
      data: {
        status: 'done',
        finishedAt: new Date(),
        result: { ...((tache.result as object | null) ?? {}), ...(issue.resultat ?? {}) } as Prisma.InputJsonValue,
        error: undefined,
      },
    });
    await emettre(ctxEv, 'tache_fin', issue.message ?? tache.description, { niveau: 'ok', taskKey: tache.key, data: { dureeMs: duree } });

    // Un correctif appliqué puis une compilation réussie : le correctif est vérifié.
    if (tache.type === 'verse.compile') {
      await db.buildError.updateMany({ where: { sessionId: session.id, fixStatus: 'applied', category: { not: 'gameplay_error' } }, data: { fixStatus: 'verified' } });
    }
    if (tache.type === 'session.test') {
      await db.buildError.updateMany({ where: { sessionId: session.id, fixStatus: 'applied' }, data: { fixStatus: 'verified' } });
    }
    await majPalier(session);
    return;
  }

  await emettre(ctxEv, 'tache_echec', issue.message, { niveau: 'fail', taskKey: tache.key });

  // ─── Échec imputable à la plateforme : on réessaie, à l'identique ───────
  if (issue.raison === 'plateforme' || issue.raison === 'verification') {
    await db.agentSession.update({ where: { id: session.id }, data: { retries: { increment: 1 } } });
    if (tache.attempt < tache.maxAttempts) {
      await db.buildTask.update({ where: { id: tache.id }, data: { status: 'pending', error: { raison: issue.raison, message: issue.message } } });
      await emettre(ctxEv, 'verification', `Nouvelle tentative (${tache.attempt + 1}/${tache.maxAttempts}) — la tâche est idempotente : rien ne sera créé en double.`, { niveau: 'warn', taskKey: tache.key });
      return;
    }
    await db.buildTask.update({ where: { id: tache.id }, data: { status: 'failed', finishedAt: new Date(), error: { raison: issue.raison, message: issue.message } } });
    // Un éditeur qui répond « fait » sans rien faire, obstinément, est une
    // panne de la plateforme au même titre qu'un gel : on rembourse.
    await cloturer(session, 'failed', 'panne_plateforme');
    return;
  }

  // ─── Erreurs de code : analyser, corriger, recompiler, retester ─────────
  if (issue.raison === 'compilation' || issue.raison === 'gameplay') {
    await db.buildTask.update({
      where: { id: tache.id },
      data: { status: 'failed', finishedAt: new Date(), error: { raison: issue.raison, message: issue.message }, ...(issue.raison === 'compilation' ? { result: issue.resultat as Prisma.InputJsonValue } : {}) },
    });
    await majPalier(session);

    // Un seul correctif par fichier et par passe ; au-delà de la limite, on
    // s'arrête et on remonte l'erreur brute plutôt que de boucler (section 12).
    const parFichier = new Map<string, Diagnostic>();
    for (const d of issue.diagnostics) if (d.fichier && !parFichier.has(d.fichier)) parFichier.set(d.fichier, d);
    if (parFichier.size === 0) {
      await bloquer(session, 'erreur_sans_fichier', issue.diagnostics[0]?.brut ?? issue.message);
      return;
    }

    const deja = taches.filter((t) => t.type === 'fix.apply');
    const n0 = taches.filter((t) => t.type === 'error.analyze').length;
    const nouvelles: string[] = [];
    let i = 0;
    for (const [fichier, d] of parFichier) {
      const tentatives = deja.filter((t) => (t.input as { fichier?: string }).fichier === fichier).length;
      if (tentatives >= maxCorrections) {
        await bloquer(session, 'limite_corrections', `${fichier} : ${tentatives} corrections sans succès. Erreur brute : ${d.brut}`);
        return;
      }
      const n = n0 + ++i;
      const input = { buildErrorId: d.buildErrorId, fichier, brut: d.brut, ligne: d.ligne, categorie: d.categorie } as Prisma.InputJsonValue;
      const ordre = tache.order + i / 100;
      await db.buildTask.createMany({
        data: [
          { planId: session.planId, key: `analyse:${n}`, type: 'error.analyze', description: `Analyser l’erreur de ${fichier}`, dependsOn: [], order: Math.floor(ordre * 100) + 1, input, maxAttempts: 2 },
          { planId: session.planId, key: `correctif:${n}`, type: 'fix.apply', description: `Corriger ${fichier}`, dependsOn: [`analyse:${n}`], order: Math.floor(ordre * 100) + 2, input, maxAttempts: 2 },
        ],
      });
      nouvelles.push(`correctif:${n}`);
    }

    // Recompiler après les correctifs, puis rejouer le playtest.
    const compile = taches.find((t) => t.key === 'compile')!;
    await db.buildTask.update({
      where: { id: compile.id },
      data: { status: 'pending', dependsOn: [...new Set([...compile.dependsOn, ...nouvelles])] },
    });
    await db.buildTask.updateMany({
      where: { planId: session.planId, key: { in: ['playtest:start', 'playtest:test', 'playtest:stop', 'prepublication'] } },
      data: { status: 'pending' },
    });
    await renumeroter(session.planId);
    await emettre(ctxEv, 'correctif', `${parFichier.size} fichier(s) à corriger : ${[...parFichier.keys()].join(', ')}. Analyse, correctif, recompilation, nouveau test.`, { niveau: 'warn' });
    return;
  }

  // ─── Autre échec : on s'arrête et on montre l'erreur brute ──────────────
  await db.buildTask.update({ where: { id: tache.id }, data: { status: 'failed', finishedAt: new Date(), error: { raison: issue.raison, message: issue.message } } });
  await bloquer(session, 'echec_tache', issue.message);
}

/** Replace les tâches de débogage avant la recompilation, dans l'ordre d'affichage. */
async function renumeroter(planId: string) {
  const taches = await db.buildTask.findMany({ where: { planId } });
  const compile = taches.find((t) => t.key === 'compile')!;
  const debug = taches.filter((t) => t.type === 'error.analyze' || t.type === 'fix.apply').sort((a, b) => a.order - b.order);
  const autres = taches.filter((t) => !debug.includes(t)).sort((a, b) => a.order - b.order);
  const ordonnees = [...autres.slice(0, autres.indexOf(compile)), ...debug, ...autres.slice(autres.indexOf(compile))];
  await db.$transaction(ordonnees.map((t, i) => db.buildTask.update({ where: { id: t.id }, data: { order: i } })));
}

async function bloquer(session: Session, raison: string, brut: string) {
  await db.agentSession.update({ where: { id: session.id }, data: { status: 'awaiting_human', stopReason: raison } });
  await emettre({ sessionId: session.id, projectId: session.projectId }, 'session', `Intervention demandée. ${brut}`, { niveau: 'fail' });
}

async function majPalier(session: Session) {
  const { avant, apres } = await recalculerPalier(session.projectId);
  if (avant !== apres) {
    await emettre({ sessionId: session.id, projectId: session.projectId }, 'palier', `Palier ${apres} — ${PALIERS[apres].libelle}. ${PALIERS[apres].sens}`, {
      niveau: apres > avant ? 'ok' : 'warn',
      data: { avant, apres },
    });
  }
}

/** Reflet du projet relu, pour l'affichage. Jamais utilisé comme vérité par la boucle. */
async function rafraichirEtatObserve(projectId: string, uefn: ReturnType<typeof fournisseurUEFN>) {
  const snap = await uefn.inspectProject();
  const maintenant = new Date();
  await db.$transaction([
    db.verseFile.deleteMany({ where: { projectId, path: { notIn: snap.verseFiles.map((f) => f.path) } } }),
    ...snap.verseFiles.map((f) =>
      db.verseFile.upsert({
        where: { projectId_path: { projectId, path: f.path } },
        create: { projectId, path: f.path, content: f.content, contentHash: f.hash, module: f.path.replace('.verse', ''), observedAt: maintenant },
        update: { content: f.content, contentHash: f.hash, observedAt: maintenant },
      }),
    ),
    ...snap.devices.map((d) =>
      db.deviceInstance.upsert({
        where: { projectId_stableId: { projectId, stableId: d.label } },
        create: { projectId, stableId: d.label, uefnId: d.id, deviceType: d.deviceType, label: d.label, positionLuf: { ...d.position }, properties: d.properties as Prisma.InputJsonValue, observedAt: maintenant },
        update: { uefnId: d.id, positionLuf: { ...d.position }, properties: d.properties as Prisma.InputJsonValue, observedAt: maintenant },
      }),
    ),
    ...snap.entities.map((e) =>
      db.sceneEntity.upsert({
        where: { projectId_stableId: { projectId, stableId: e.stableId } },
        create: { projectId, stableId: e.stableId, uefnId: e.id, name: e.name, components: e.components as Prisma.InputJsonValue, transformLuf: e.transform as unknown as Prisma.InputJsonValue, observedAt: maintenant },
        update: { uefnId: e.id, transformLuf: e.transform as unknown as Prisma.InputJsonValue, observedAt: maintenant },
      }),
    ),
  ]);
}

/**
 * Clôture : débit au réel, ou remboursement si la plateforme est en cause
 * (règles 3 et 5 de l'offre), photographie du projet, palier final.
 */
export async function cloturer(session: AgentSession, statut: 'completed' | 'stopped' | 'failed', raison: string | null) {
  const ctxEv = { sessionId: session.id, projectId: session.projectId };
  const s = await db.agentSession.findUniqueOrThrow({ where: { id: session.id }, include: { project: true, plan: true } });
  const simule = s.provider === 'mock';
  const coutParCredit = await configEntier('COST_PER_CREDIT');

  if (raison === 'panne_plateforme') {
    const rendus = await rembourserBuild({ userId: s.project.userId, buildId: s.id, simulated: simule });
    await db.agentSession.update({ where: { id: s.id }, data: { refunded: true, creditsDebited: 0 } });
    await emettre(ctxEv, 'credits', `Échec dû à la plateforme : ${rendus} crédit(s) restitué(s), réservation libérée.`, { niveau: 'warn' });
  } else {
    const reels = creditsPourCout(s.costEurMicros, coutParCredit);
    const r = await cloturerBuild({ userId: s.project.userId, buildId: s.id, creditsReels: reels, simulated: simule });
    await db.agentSession.update({ where: { id: s.id }, data: { creditsDebited: r.debite } });
    await emettre(
      ctxEv,
      'credits',
      `${r.debite} crédit(s) débité(s) au coût réel (${(s.costEurMicros / 1_000_000).toFixed(2).replace('.', ',')} € d’IA${simule ? ', estimé : IA simulée' : ''}). Le reste de la réservation est libéré.`,
      { niveau: 'info' },
    );
  }

  const taches = await db.buildTask.findMany({ where: { planId: s.planId } });
  if (statut !== 'completed') {
    await db.buildTask.updateMany({ where: { planId: s.planId, status: 'pending' }, data: { status: 'skipped' } });
  }

  // Photographie du projet relu en fin de génération (section 21).
  const [fichiers, devices, entites, compte] = await Promise.all([
    db.verseFile.findMany({ where: { projectId: s.projectId }, select: { path: true, contentHash: true } }),
    db.deviceInstance.findMany({ where: { projectId: s.projectId }, select: { stableId: true, deviceType: true } }),
    db.sceneEntity.findMany({ where: { projectId: s.projectId }, select: { stableId: true } }),
    db.projectVersion.count({ where: { projectId: s.projectId } }),
  ]);
  const { apres } = await recalculerPalier(s.projectId);
  await db.projectVersion.create({
    data: {
      projectId: s.projectId,
      number: compte + 1,
      specVersion: s.plan.specVersion,
      sessionId: s.id,
      tier: apres,
      summary: `${taches.filter((t) => t.status === 'done').length} tâches faites, ${taches.filter((t) => t.type === 'fix.apply' && t.status === 'done').length} correctif(s) — ${statut === 'completed' ? 'terminée' : statut === 'stopped' ? 'arrêtée' : 'en échec'}`,
      snapshot: { fichiers, devices, entites } as Prisma.InputJsonValue,
    },
  });

  await db.agentSession.update({ where: { id: s.id }, data: { status: statut, stopReason: raison, finishedAt: new Date() } });
  await emettre(
    ctxEv,
    'session',
    statut === 'completed'
      ? `Construction terminée — palier ${apres}, ${PALIERS[apres].libelle}.`
      : statut === 'stopped'
        ? 'Construction arrêtée. L’état du projet est conservé.'
        : `Construction en échec (${raison}). L’état du projet est conservé.`,
    { niveau: statut === 'completed' ? 'ok' : statut === 'stopped' ? 'warn' : 'fail', data: { palier: apres } },
  );
  await emettre(ctxEv, 'palier', `Palier final : ${apres} — ${PALIERS[apres].libelle}.`, { niveau: 'info', data: { apres, final: true } });
}

export { libelleEtape };
