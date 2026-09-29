import 'server-only';
import { Prisma, type CreditLedger } from '@prisma/client';
import {
  ajuster,
  cloturer,
  disponible,
  expirer,
  recharger,
  rembourser,
  reserver,
  soldes,
  verserPeriode,
  type Ecriture,
  type Ligne,
} from '@/lib/credits/registre';
import { db } from '@/server/db';

/**
 * Le registre de crédits, en base.
 *
 * Chaque opération prend un verrou consultatif sur l'utilisateur pour la durée
 * de sa transaction : deux builds lancés au même instant ne peuvent pas
 * réserver les mêmes crédits. Les écritures portent une clé d'idempotence
 * unique ; une écriture déjà présente est ignorée (ON CONFLICT DO NOTHING),
 * ce qui rend chaque opération rejouable.
 */

type Tx = Prisma.TransactionClient;

function versLigne(l: CreditLedger): Ligne {
  return {
    delta: l.delta,
    bucket: l.bucket,
    reason: l.reason,
    buildId: l.buildId,
    expiresAt: l.expiresAt,
    idempotencyKey: l.idempotencyKey,
    createdAt: l.createdAt,
  };
}

async function verrouiller(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`credits:${userId}`}))`;
}

async function lignesDe(tx: Tx, userId: string): Promise<Ligne[]> {
  const lignes = await tx.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return lignes.map(versLigne);
}

async function ecrire(
  tx: Tx,
  userId: string,
  ecritures: Ecriture[],
  extra: { stripeEventId?: string; actorId?: string; simulated?: boolean } = {},
): Promise<number> {
  if (ecritures.length === 0) return 0;
  const r = await tx.creditLedger.createMany({
    data: ecritures.map((e) => ({
      userId,
      delta: e.delta,
      bucket: e.bucket,
      reason: e.reason,
      buildId: e.buildId ?? null,
      expiresAt: e.expiresAt ?? null,
      idempotencyKey: e.idempotencyKey,
      note: e.note ?? null,
      stripeEventId: extra.stripeEventId ?? null,
      actorId: extra.actorId ?? null,
      simulated: extra.simulated ?? false,
    })),
    skipDuplicates: true,
  });
  return r.count;
}

/** Exécute une opération sur le solde d'un utilisateur, sous verrou. */
export async function avecRegistre<T>(
  userId: string,
  operation: (lignes: Ligne[], tx: Tx) => Promise<T>,
  client: typeof db = db,
): Promise<T> {
  return client.$transaction(async (tx) => {
    await verrouiller(tx, userId);
    // Les expirations dues sont appliquées avant toute lecture : un solde
    // affiché ou réservé ne doit jamais compter des crédits déjà périmés.
    const brutes = await lignesDe(tx, userId);
    const dues = expirer(brutes, new Date());
    if (dues.length) await ecrire(tx, userId, dues);
    const lignes = dues.length ? await lignesDe(tx, userId) : brutes;
    return operation(lignes, tx);
  });
}

export async function solde(userId: string, client: typeof db = db) {
  return avecRegistre(
    userId,
    async (lignes) => ({ total: disponible(lignes), parCompartiment: soldes(lignes) }),
    client,
  );
}

export async function reserverPourBuild(
  args: { userId: string; buildId: string; credits: number; simulated: boolean },
  client: typeof db = db,
) {
  return avecRegistre(
    args.userId,
    async (lignes, tx) => {
      const e = reserver(lignes, args.buildId, args.credits);
      await ecrire(tx, args.userId, e, { simulated: args.simulated });
      return { reserve: args.credits, restant: disponible(lignes) - args.credits };
    },
    client,
  );
}

export async function cloturerBuild(
  args: { userId: string; buildId: string; creditsReels: number; simulated: boolean },
  client: typeof db = db,
) {
  return avecRegistre(
    args.userId,
    async (lignes, tx) => {
      const r = cloturer(lignes, args.buildId, args.creditsReels);
      await ecrire(tx, args.userId, r.ecritures, { simulated: args.simulated });
      return { debite: r.debite, absorbe: r.absorbe };
    },
    client,
  );
}

export async function rembourserBuild(
  args: { userId: string; buildId: string; simulated: boolean },
  client: typeof db = db,
) {
  return avecRegistre(
    args.userId,
    async (lignes, tx) => {
      const e = rembourser(lignes, args.buildId);
      await ecrire(tx, args.userId, e, { simulated: args.simulated });
      return e.filter((x) => x.reason === 'refund').reduce((n, x) => n + x.delta, 0);
    },
    client,
  );
}

export async function verserCreditsPeriode(
  args: {
    userId: string;
    subscriptionId: string;
    credits: number;
    debut: Date;
    fin: Date;
    moisReport: number;
    stripeEventId?: string;
  },
  client: typeof db = db,
): Promise<{ verse: boolean }> {
  return avecRegistre(
    args.userId,
    async (lignes, tx) => {
      const e = verserPeriode({
        lignes,
        // La période est identifiée par l'abonnement et son jour de début :
        // un même mois ne peut être versé qu'une fois, quelle que soit la
        // source (webhook de facture ou tâche mensuelle de l'annuel).
        cle: `${args.subscriptionId}:${args.debut.toISOString().slice(0, 10)}`,
        credits: args.credits,
        debut: args.debut,
        fin: args.fin,
        moisReport: args.moisReport,
      });
      const n = await ecrire(tx, args.userId, e, { stripeEventId: args.stripeEventId });
      return { verse: n > 0 };
    },
    client,
  );
}

export async function crediterRecharge(
  args: { userId: string; credits: number; cle: string; stripeEventId?: string },
  client: typeof db = db,
): Promise<{ verse: boolean }> {
  return avecRegistre(
    args.userId,
    async (_lignes, tx) => {
      const n = await ecrire(tx, args.userId, recharger(args.credits, args.cle), { stripeEventId: args.stripeEventId });
      return { verse: n > 0 };
    },
    client,
  );
}

export async function ajusterSolde(
  args: { userId: string; delta: number; note: string; actorId: string },
  client: typeof db = db,
) {
  return avecRegistre(
    args.userId,
    async (lignes, tx) => {
      const e = ajuster(lignes, { delta: args.delta, note: args.note, cle: `${Date.now()}:${args.actorId}` });
      await ecrire(tx, args.userId, e, { actorId: args.actorId });
      return disponible(lignes) + args.delta;
    },
    client,
  );
}

/**
 * Complément de crédits d'abonnement en cours de période (montée d'offre) :
 * un simple versement, qui expire avec la période en cours. Il ne déclenche
 * PAS la bascule en report, réservée au début d'une nouvelle période.
 */
export async function verserComplement(
  args: { userId: string; credits: number; cle: string; expiresAt: Date; stripeEventId?: string },
  client: typeof db = db,
): Promise<{ verse: boolean }> {
  if (!Number.isInteger(args.credits) || args.credits <= 0) return { verse: false };
  return avecRegistre(
    args.userId,
    async (_l, tx) => {
      const n = await ecrire(
        tx,
        args.userId,
        [{ delta: args.credits, bucket: 'subscription', reason: 'grant', expiresAt: args.expiresAt, idempotencyKey: `complement:${args.cle}` }],
        { stripeEventId: args.stripeEventId },
      );
      return { verse: n > 0 };
    },
    client,
  );
}
