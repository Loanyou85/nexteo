import 'server-only';
import { db } from '@/server/db';

/**
 * Réglages chiffrés, lus en base (règle : aucun prix, quota ou remise en dur).
 * Une clé absente est une erreur explicite, pas une valeur par défaut
 * silencieuse : un taux inventé fausserait toutes les marges.
 */

export type CleConfig =
  | 'COST_PER_CREDIT'
  | 'MAX_ANNUAL_DISCOUNT'
  | 'ROLLOVER_MONTHS'
  | 'CREDITS_ESTIMATE_FULL'
  | 'CREDITS_ESTIMATE_UPDATE'
  | 'USD_EUR_RATE_PPM'
  | 'VAT_RATE_BP'
  | 'STRIPE_FEE_BP'
  | 'STRIPE_FEE_FIXED_CENTS'
  | 'HOSTING_COST_PER_SUB_CENTS'
  | 'BAREME';

export async function configEntier(cle: CleConfig, client: Pick<typeof db, 'pricingConfig'> = db): Promise<number> {
  const ligne = await client.pricingConfig.findUnique({ where: { key: cle } });
  if (!ligne) throw new Error(`Réglage ${cle} absent : la base n’a pas été semée.`);
  const n = Number(ligne.value);
  if (!Number.isInteger(n)) throw new Error(`Réglage ${cle} invalide : « ${ligne.value} » n’est pas un entier.`);
  return n;
}

export async function configJson<T>(cle: CleConfig): Promise<T> {
  const ligne = await db.pricingConfig.findUnique({ where: { key: cle } });
  if (!ligne) throw new Error(`Réglage ${cle} absent : la base n’a pas été semée.`);
  return JSON.parse(ligne.value) as T;
}

export type LigneBareme = { operation: string; coutCents: number; credits: number };
