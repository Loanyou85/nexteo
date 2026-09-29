import { beforeAll, describe, expect, it } from 'vitest';
import { preparerBaseTest, URL_TEST } from '@/test/base';

/**
 * Scénario de référence de bout en bout, contre une vraie base PostgreSQL et
 * l'éditeur simulé (section 33). Ignoré sans TEST_DATABASE_URL.
 */
describe.skipIf(!URL_TEST)('orchestrateur — scénario de référence', () => {
  let db: typeof import('@/server/db').db;
  let avancer: typeof import('@/server/orchestrateur/boucle').avancer;
  let lancer: typeof import('@/server/orchestrateur/lancement').lancer;
  let credits: typeof import('@/server/credits');
  let specZombie: typeof import('@/lib/gamespec/modeles').specZombie;
  let fournisseurUEFN: typeof import('@/server/orchestrateur/uefn').fournisseurUEFN;

  beforeAll(async () => {
    preparerBaseTest();
    ({ db } = await import('@/server/db'));
    ({ avancer } = await import('@/server/orchestrateur/boucle'));
    ({ lancer } = await import('@/server/orchestrateur/lancement'));
    credits = await import('@/server/credits');
    ({ specZombie } = await import('@/lib/gamespec/modeles'));
    ({ fournisseurUEFN } = await import('@/server/orchestrateur/uefn'));
  });

  async function projetAbonne() {
    const user = await db.user.create({ data: { email: `t-${Math.random().toString(36).slice(2)}@exemple.invalid` } });
    const pro = await db.plan.findUniqueOrThrow({ where: { slug: 'pro' } });
    const debut = new Date();
    const fin = new Date(Date.now() + 30 * 86_400_000);
    const sub = await db.subscription.create({ data: { userId: user.id, planId: pro.id, status: 'active', priceCents: pro.monthlyPriceCents, currentPeriodStart: debut, currentPeriodEnd: fin } });
    await credits.verserCreditsPeriode({ userId: user.id, subscriptionId: sub.id, credits: pro.monthlyCredits, debut, fin, moisReport: 1 });
    const projet = await db.project.create({ data: { userId: user.id, name: 'Zombie Hospital', genre: 'zombie_survival', currentSpecVersion: 1 } });
    const spec = specZombie({ gameId: projet.id });
    await db.gameSpec.create({ data: { projectId: projet.id, version: 1, specVersion: spec.specVersion, data: spec as object, author: 'ia' } });
    return { user, projet };
  }

  async function jusquAuBout(sessionId: string) {
    for (let i = 0; i < 300; i++) {
      const r = await avancer(sessionId, 5_000);
      if (r === 'termine' || r === 'en_attente') return r;
    }
    throw new Error('La session ne s’est pas terminée.');
  }

  it('construit, corrige, teste et atteint le palier Prêt', async () => {
    const { user, projet } = await projetAbonne();
    const r = await lancer({ userId: user.id, projectId: projet.id, autonomie: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(await jusquAuBout(r.sessionId)).toBe('termine');
    const s = await db.agentSession.findUniqueOrThrow({ where: { id: r.sessionId } });
    const p = await db.project.findUniqueOrThrow({ where: { id: projet.id } });
    expect(s.status).toBe('completed');
    expect(p.tier).toBe(5);

    // Les deux erreurs de compilation et l'erreur de gameplay ont été corrigées et vérifiées.
    const erreurs = await db.buildError.findMany({ where: { sessionId: s.id } });
    expect(erreurs.filter((e) => e.category !== 'runtime_error').every((e) => e.fixStatus === 'verified')).toBe(true);
    expect(erreurs.some((e) => e.category === 'gameplay_error')).toBe(true);

    // Débit au réel : exactement le coût converti, le reste libéré.
    const coutParCredit = Number((await db.pricingConfig.findUniqueOrThrow({ where: { key: 'COST_PER_CREDIT' } })).value);
    const attendu = Math.ceil(s.costEurMicros / (coutParCredit * 10_000));
    expect(s.creditsDebited).toBe(attendu);
    expect((await credits.solde(user.id)).total).toBe(75 - attendu);
  });

  it('réussit dix fois d’affilée — contre le simulateur, pas encore contre le vrai MCP (section 33)', async () => {
    for (let i = 0; i < 10; i++) {
      const { user, projet } = await projetAbonne();
      const r = await lancer({ userId: user.id, projectId: projet.id, autonomie: true });
      if (!r.ok) throw new Error(r.erreur);
      expect(await jusquAuBout(r.sessionId)).toBe('termine');
      expect((await db.project.findUniqueOrThrow({ where: { id: projet.id } })).tier).toBe(5);
    }
  }, 180_000);

  it('reprend une interruption brutale en plein build sans créer de doublon (section 34)', async () => {
    const { user, projet } = await projetAbonne();
    const r = await lancer({ userId: user.id, projectId: projet.id, autonomie: true });
    if (!r.ok) throw new Error(r.erreur);

    // Quelques pas, puis on « tue » l'exécutant au milieu d'une création :
    // l'éditeur a créé l'entité, mais la tâche est restée « en cours » et le
    // bail n'a jamais été rendu.
    await avancer(r.sessionId, 1);
    await avancer(r.sessionId, 1);
    await avancer(r.sessionId, 1);
    // La prochaine zone qui n'existe pas encore dans l'éditeur : c'est elle
    // que l'exécutant était en train de créer quand il est mort.
    const editeur = fournisseurUEFN(projet.id, 4);
    const existantes = new Set((await editeur.listEntities()).map((e) => e.stableId));
    const candidates = await db.buildTask.findMany({
      where: { plan: { sessions: { some: { id: r.sessionId } } }, type: 'entity.create', status: 'pending' },
      orderBy: { order: 'asc' },
    });
    const suivante = candidates.find((t) => !existantes.has((t.input as { stableId: string }).stableId))!;
    const input = suivante.input as { stableId: string; name: string; transform: never; components: never[] };
    await editeur.createEntity(input).catch(() => undefined);
    await db.buildTask.update({ where: { id: suivante.id }, data: { status: 'running' } });
    await db.project.update({ where: { id: projet.id }, data: { leaseOwner: 'executant-mort', leaseUntil: new Date(Date.now() - 1000) } });

    // Un autre exécutant reprend.
    expect(await jusquAuBout(r.sessionId)).toBe('termine');
    const entites = await db.sceneEntity.findMany({ where: { projectId: projet.id } });
    const ids = entites.map((e) => e.stableId);
    expect(new Set(ids).size).toBe(ids.length);
    const snap = await fournisseurUEFN(projet.id, 4).inspectProject();
    const stable = snap.entities.map((e) => e.stableId);
    expect(new Set(stable).size).toBe(stable.length);
    expect((await db.agentSession.findUniqueOrThrow({ where: { id: r.sessionId } })).status).toBe('completed');
  });

  it('au niveau 4, s’arrête sur le premier correctif et attend un accord', async () => {
    const { user, projet } = await projetAbonne();
    const r = await lancer({ userId: user.id, projectId: projet.id, autonomie: false });
    if (!r.ok) throw new Error(r.erreur);
    expect(await jusquAuBout(r.sessionId)).toBe('en_attente');
    const s = await db.agentSession.findUniqueOrThrow({ where: { id: r.sessionId } });
    expect(s.status).toBe('awaiting_human');
    expect(s.stopReason).toBe('correctif_a_valider');
  });

  it('refuse une seconde génération active sur le même projet', async () => {
    const { user, projet } = await projetAbonne();
    const a = await lancer({ userId: user.id, projectId: projet.id, autonomie: true });
    const b = await lancer({ userId: user.id, projectId: projet.id, autonomie: true });
    expect(a.ok && b.ok && a.sessionId === b.sessionId).toBe(true);
    await expect(
      db.agentSession.create({ data: { projectId: projet.id, planId: (await db.buildPlan.findFirstOrThrow({ where: { projectId: projet.id } })).id, provider: 'mock', status: 'queued' } }),
    ).rejects.toThrow();
  });
});
