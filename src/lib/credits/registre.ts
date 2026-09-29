/**
 * Algèbre du registre de crédits (section 2 de l'offre).
 *
 * Ces fonctions ne touchent pas la base : elles lisent les lignes existantes
 * et rendent les lignes à AJOUTER. Le registre étant en ajout seul, toute
 * opération — réserver, débiter, rembourser, faire expirer — s'exprime en
 * nouvelles lignes, jamais en modification. Le solde est une somme.
 *
 * Trois compartiments, consommés dans cet ordre : les crédits d'abonnement
 * du mois, puis les crédits reportés, puis les recharges.
 */

export type Compartiment = 'subscription' | 'rollover' | 'topup';
export type Raison = 'grant' | 'reserve' | 'release' | 'debit' | 'refund' | 'expire' | 'adjust';

export const ORDRE_CONSOMMATION: readonly Compartiment[] = ['subscription', 'rollover', 'topup'];

export type Ligne = {
  delta: number;
  bucket: Compartiment;
  reason: Raison;
  buildId?: string | null;
  expiresAt?: Date | null;
  idempotencyKey?: string | null;
  createdAt: Date;
};

export type Ecriture = {
  delta: number;
  bucket: Compartiment;
  reason: Raison;
  buildId?: string;
  expiresAt?: Date;
  idempotencyKey: string;
  note?: string;
};

export class SoldeInsuffisant extends Error {
  constructor(
    readonly demande: number,
    readonly disponible: number,
  ) {
    super(`Solde insuffisant : ${demande} crédits demandés, ${disponible} disponibles.`);
    this.name = 'SoldeInsuffisant';
  }
}

export function soldes(lignes: Ligne[]): Record<Compartiment, number> {
  const s: Record<Compartiment, number> = { subscription: 0, rollover: 0, topup: 0 };
  for (const l of lignes) s[l.bucket] += l.delta;
  return s;
}

export function disponible(lignes: Ligne[]): number {
  const s = soldes(lignes);
  return s.subscription + s.rollover + s.topup;
}

/** Répartit un montant sur les compartiments, dans l'ordre de consommation. */
function repartir(s: Record<Compartiment, number>, montant: number): { bucket: Compartiment; part: number }[] {
  const parts: { bucket: Compartiment; part: number }[] = [];
  let reste = montant;
  for (const b of ORDRE_CONSOMMATION) {
    if (reste <= 0) break;
    const pris = Math.min(Math.max(s[b], 0), reste);
    if (pris > 0) {
      parts.push({ bucket: b, part: pris });
      reste -= pris;
    }
  }
  return parts;
}

/** Réservation encore ouverte d'un build, par compartiment (valeurs positives). */
export function reservationOuverte(lignes: Ligne[], buildId: string): Record<Compartiment, number> {
  const r: Record<Compartiment, number> = { subscription: 0, rollover: 0, topup: 0 };
  for (const l of lignes) {
    if (l.buildId !== buildId) continue;
    if (l.reason === 'reserve' || l.reason === 'release') r[l.bucket] -= l.delta;
  }
  return r;
}

/** Nombre de réservations déjà posées pour ce build : sert à numéroter la suivante. */
function reservationsPosees(lignes: Ligne[], buildId: string): number {
  const cles = new Set(
    lignes
      .filter((l) => l.buildId === buildId && l.reason === 'reserve' && l.idempotencyKey)
      .map((l) => l.idempotencyKey!.split(':').slice(0, 3).join(':')),
  );
  return cles.size;
}

/**
 * Réserve des crédits pour un build. Une réservation n'est pas un débit :
 * elle retire du solde disponible sans rien consommer. Jamais à découvert.
 */
export function reserver(lignes: Ligne[], buildId: string, montant: number): Ecriture[] {
  if (!Number.isInteger(montant) || montant <= 0) throw new Error('Montant de réservation invalide.');
  const dispo = disponible(lignes);
  if (montant > dispo) throw new SoldeInsuffisant(montant, dispo);

  const n = reservationsPosees(lignes, buildId) + 1;
  return repartir(soldes(lignes), montant).map(({ bucket, part }) => ({
    delta: -part,
    bucket,
    reason: 'reserve' as const,
    buildId,
    idempotencyKey: `reserve:${buildId}:${n}:${bucket}`,
  }));
}

/**
 * Clôture un build : libère toute la réservation, puis débite le réel dans
 * l'ordre de consommation. Le net vaut exactement −réel.
 *
 * Le débit ne peut pas dépasser ce qui est disponible après libération : si
 * le réel arrondi excède ce solde (cas limite d'un arrondi au crédit
 * supérieur), l'excédent est absorbé par la plateforme et rapporté — jamais
 * de solde négatif.
 */
export function cloturer(
  lignes: Ligne[],
  buildId: string,
  creditsReels: number,
): { ecritures: Ecriture[]; debite: number; absorbe: number } {
  if (!Number.isInteger(creditsReels) || creditsReels < 0) throw new Error('Débit invalide.');
  if (lignes.some((l) => l.buildId === buildId && l.reason === 'debit')) {
    // Déjà clôturé : rejouer la clôture ne débite pas deux fois.
    return { ecritures: [], debite: 0, absorbe: 0 };
  }

  const ouverte = reservationOuverte(lignes, buildId);
  const liberations: Ecriture[] = ORDRE_CONSOMMATION.filter((b) => ouverte[b] > 0).map((b) => ({
    delta: ouverte[b],
    bucket: b,
    reason: 'release' as const,
    buildId,
    idempotencyKey: `close:${buildId}:release:${b}`,
  }));

  const apres = soldes(lignes);
  for (const e of liberations) apres[e.bucket] += e.delta;
  const total = apres.subscription + apres.rollover + apres.topup;
  const debite = Math.min(creditsReels, Math.max(total, 0));

  const debits: Ecriture[] = repartir(apres, debite).map(({ bucket, part }) => ({
    delta: -part,
    bucket,
    reason: 'debit' as const,
    buildId,
    idempotencyKey: `close:${buildId}:debit:${bucket}`,
  }));

  return { ecritures: [...liberations, ...debits], debite, absorbe: creditsReels - debite };
}

/**
 * Rembourse un build dont l'échec vient de la plateforme : restitue
 * exactement ce qui a été débité, compartiment par compartiment, et libère
 * une réservation restée ouverte. Rejouable sans effet.
 */
export function rembourser(lignes: Ligne[], buildId: string): Ecriture[] {
  const netDebite: Record<Compartiment, number> = { subscription: 0, rollover: 0, topup: 0 };
  for (const l of lignes) {
    if (l.buildId !== buildId) continue;
    if (l.reason === 'debit' || l.reason === 'refund') netDebite[l.bucket] -= l.delta;
  }
  const ouverte = reservationOuverte(lignes, buildId);

  const sortie: Ecriture[] = [];
  for (const b of ORDRE_CONSOMMATION) {
    if (ouverte[b] > 0) {
      sortie.push({ delta: ouverte[b], bucket: b, reason: 'release', buildId, idempotencyKey: `refund:${buildId}:release:${b}` });
    }
    if (netDebite[b] > 0) {
      sortie.push({ delta: netDebite[b], bucket: b, reason: 'refund', buildId, idempotencyKey: `refund:${buildId}:${b}` });
    }
  }
  return sortie;
}

/**
 * Versement des crédits d'une période d'abonnement.
 *
 * Les crédits non utilisés de la période précédente sont reportés UN mois :
 * le report précédent expire, le reste d'abonnement devient le nouveau report.
 * `cle` identifie la période (abonnement + date de début) : relancer le
 * versement pour la même période ne produit rien.
 */
export function verserPeriode(args: {
  lignes: Ligne[];
  cle: string;
  credits: number;
  debut: Date;
  fin: Date;
  moisReport: number;
}): Ecriture[] {
  const { lignes, cle, credits, fin, moisReport } = args;
  if (lignes.some((l) => l.idempotencyKey === `grant:${cle}`)) return [];

  const s = soldes(lignes);
  const ecritures: Ecriture[] = [];

  if (s.rollover > 0) {
    ecritures.push({ delta: -s.rollover, bucket: 'rollover', reason: 'expire', idempotencyKey: `expire-rollover:${cle}` });
  }
  if (s.subscription > 0) {
    ecritures.push({ delta: -s.subscription, bucket: 'subscription', reason: 'expire', idempotencyKey: `rollover-out:${cle}` });
    if (moisReport > 0) {
      ecritures.push({
        delta: s.subscription,
        bucket: 'rollover',
        reason: 'grant',
        expiresAt: ajouterMois(fin, moisReport - 1),
        idempotencyKey: `rollover-in:${cle}`,
      });
    }
  }
  if (credits > 0) {
    ecritures.push({ delta: credits, bucket: 'subscription', reason: 'grant', expiresAt: fin, idempotencyKey: `grant:${cle}` });
  }
  return ecritures;
}

/**
 * Expirations dues à `maintenant`, sans nouveau versement : fin d'un report,
 * ou fin de période d'un abonnement qui ne s'est pas renouvelé. Les recharges
 * n'expirent jamais.
 */
export function expirer(lignes: Ligne[], maintenant: Date): Ecriture[] {
  const s = soldes(lignes);
  const sortie: Ecriture[] = [];

  for (const bucket of ['subscription', 'rollover'] as const) {
    if (s[bucket] <= 0) continue;
    const dernierVersement = [...lignes]
      .filter((l) => l.bucket === bucket && l.reason === 'grant' && l.expiresAt)
      .sort((a, b) => +b.createdAt - +a.createdAt)[0];
    if (!dernierVersement?.expiresAt || dernierVersement.expiresAt > maintenant) continue;

    sortie.push({
      delta: -s[bucket],
      bucket,
      reason: 'expire',
      idempotencyKey: `expire:${bucket}:${dernierVersement.idempotencyKey ?? +dernierVersement.expiresAt}`,
    });
  }
  return sortie;
}

/** Recharge : n'expire jamais. */
export function recharger(credits: number, cle: string): Ecriture[] {
  if (!Number.isInteger(credits) || credits <= 0) throw new Error('Recharge invalide.');
  return [{ delta: credits, bucket: 'topup', reason: 'grant', idempotencyKey: `topup:${cle}` }];
}

/**
 * Ajustement manuel d'administration. Motif obligatoire (contrainte en base
 * aussi). Un retrait se répartit dans l'ordre de consommation et ne peut pas
 * rendre le solde négatif.
 */
export function ajuster(lignes: Ligne[], args: { delta: number; note: string; cle: string }): Ecriture[] {
  const note = args.note.trim();
  if (!note) throw new Error('Un ajustement demande un motif.');
  if (!Number.isInteger(args.delta) || args.delta === 0) throw new Error('Ajustement invalide.');

  if (args.delta > 0) {
    return [{ delta: args.delta, bucket: 'topup', reason: 'adjust', note, idempotencyKey: `adjust:${args.cle}` }];
  }
  const dispo = disponible(lignes);
  if (-args.delta > dispo) throw new SoldeInsuffisant(-args.delta, dispo);
  return repartir(soldes(lignes), -args.delta).map(({ bucket, part }) => ({
    delta: -part,
    bucket,
    reason: 'adjust' as const,
    note,
    idempotencyKey: `adjust:${args.cle}:${bucket}`,
  }));
}

/** Coût réel d'un build converti en crédits, arrondi au crédit supérieur. */
export function creditsPourCout(coutEurMicros: number, coutParCreditCents: number): number {
  if (coutEurMicros <= 0) return 0;
  const microsParCredit = coutParCreditCents * 10_000;
  return Math.ceil(coutEurMicros / microsParCredit);
}

export function ajouterMois(date: Date, mois: number): Date {
  const d = new Date(date);
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + mois);
  // 31 janvier + 1 mois = 28 ou 29 février, pas 3 mars.
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernier));
  return d;
}

/** Ajoute des écritures à une liste de lignes, comme le ferait la base. Pour les tests et les aperçus. */
export function ajouter(lignes: Ligne[], ecritures: Ecriture[], quand: Date = new Date()): Ligne[] {
  return [
    ...lignes,
    ...ecritures.map((e) => ({
      delta: e.delta,
      bucket: e.bucket,
      reason: e.reason,
      buildId: e.buildId ?? null,
      expiresAt: e.expiresAt ?? null,
      idempotencyKey: e.idempotencyKey,
      createdAt: quand,
    })),
  ];
}
