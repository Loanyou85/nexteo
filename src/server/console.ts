import 'server-only';
import { creditsPourCout } from '@/lib/credits/registre';
import { ETAPES } from '@/lib/orchestrateur/plan';
import { configEntier } from '@/server/config';
import { db } from '@/server/db';

/**
 * Ce que la console affiche, relu en base. Aucune donnée n'est fabriquée :
 * une étape sans tâche n'apparaît pas, une durée est celle mesurée.
 */

export type TacheVue = {
  key: string;
  type: string;
  etape: string;
  description: string;
  status: string;
  attempt: number;
  dureeMs: number | null;
};

export type EtapeVue = {
  cle: string;
  libelle: string;
  statut: 'faite' | 'en_cours' | 'echec' | 'attente';
  dureeMs: number | null;
  taches: TacheVue[];
};

export type EtatConsole = {
  session: {
    id: string;
    status: string;
    stopReason: string | null;
    steps: number;
    retries: number;
    creditsReserved: number;
    creditsEstimated: number;
    creditsDebited: number | null;
    /** Crédits déjà consommés au coût réel, calculés avec COST_PER_CREDIT lu en base. */
    creditsConsommes: number;
    costEurMicros: number;
    refunded: boolean;
    provider: string;
  };
  tier: number;
  etapes: EtapeVue[];
  progression: number;
  /** Au niveau 4 : le correctif analysé qui attend l'accord de l'utilisateur. */
  correctifPropose: { fichier: string | null; brut: string; suggestion: string | null } | null;
};

const etapeDe = (t: { type: string; input: unknown }) => {
  if (t.type === 'error.analyze' || t.type === 'fix.apply') return 'debogage';
  return ((t.input as { etape?: string } | null)?.etape ?? 'plan') as string;
};

export async function etatConsole(sessionId: string): Promise<EtatConsole | null> {
  const s = await db.agentSession.findUnique({
    where: { id: sessionId },
    include: { plan: { include: { tasks: { orderBy: { order: 'asc' } } } }, project: { select: { tier: true } } },
  });
  if (!s) return null;

  const taches: TacheVue[] = s.plan.tasks.map((t) => ({
    key: t.key,
    type: t.type,
    etape: etapeDe(t),
    description: t.description,
    status: t.status,
    attempt: t.attempt,
    dureeMs: t.startedAt && t.finishedAt ? t.finishedAt.getTime() - t.startedAt.getTime() : null,
  }));

  const etapes: EtapeVue[] = ETAPES.flatMap((e) => {
    const liste = taches.filter((t) => t.etape === e.cle);
    if (liste.length === 0) return [];
    const toutes = (p: (t: TacheVue) => boolean) => liste.every(p);
    const statut: EtapeVue['statut'] = liste.some((t) => t.status === 'running' || t.status === 'verifying')
      ? 'en_cours'
      : toutes((t) => t.status === 'done' || t.status === 'skipped')
        ? 'faite'
        : liste.some((t) => t.status === 'failed') && !liste.some((t) => t.status === 'pending')
          ? 'echec'
          : 'attente';
    const duree = liste.reduce((n, t) => n + (t.dureeMs ?? 0), 0);
    return [{ cle: e.cle, libelle: e.libelle, statut, dureeMs: duree > 0 ? duree : null, taches: liste }];
  });

  const faites = taches.filter((t) => t.status === 'done' || t.status === 'skipped').length;

  let correctifPropose: EtatConsole['correctifPropose'] = null;
  if (s.status === 'awaiting_human' && s.stopReason === 'correctif_a_valider') {
    const t = s.plan.tasks.find((x) => x.type === 'fix.apply' && x.status === 'pending');
    const input = t?.input as { buildErrorId?: string; fichier?: string | null; brut?: string } | undefined;
    const erreur = input?.buildErrorId ? await db.buildError.findUnique({ where: { id: input.buildErrorId } }) : null;
    correctifPropose = { fichier: input?.fichier ?? null, brut: input?.brut ?? '', suggestion: erreur?.suggestedFix ?? null };
  }

  return {
    session: {
      id: s.id,
      status: s.status,
      stopReason: s.stopReason,
      steps: s.steps,
      retries: s.retries,
      creditsReserved: s.creditsReserved,
      creditsEstimated: s.creditsEstimated,
      creditsDebited: s.creditsDebited,
      creditsConsommes: creditsPourCout(s.costEurMicros, await configEntier('COST_PER_CREDIT')),
      costEurMicros: s.costEurMicros,
      refunded: s.refunded,
      provider: s.provider,
    },
    tier: s.project.tier,
    etapes,
    progression: taches.length ? Math.round((faites / taches.length) * 100) : 0,
    correctifPropose,
  };
}

export type EvenementVue = {
  seq: string;
  type: string;
  level: string;
  taskKey: string | null;
  message: string;
  data: unknown;
  at: string;
};

export async function evenementsDepuis(sessionId: string, apres: bigint, limite = 500): Promise<EvenementVue[]> {
  const lignes = await db.agentEvent.findMany({
    where: { sessionId, seq: { gt: apres } },
    orderBy: { seq: 'asc' },
    take: limite,
  });
  return lignes.map((e) => ({
    seq: e.seq.toString(),
    type: e.type,
    level: e.level,
    taskKey: e.taskKey,
    message: e.message,
    data: e.data,
    at: e.createdAt.toISOString(),
  }));
}

/** Un worker a-t-il donné signe de vie récemment ? */
export async function workerVivant(): Promise<boolean> {
  const w = await db.workerHeartbeat.findFirst({ where: { seenAt: { gt: new Date(Date.now() - 15_000) } } });
  return !!w;
}
