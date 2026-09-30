import { urlPublique } from '@/config/url';
import { sessionOuNull } from '@/server/auth';
import { secretAuthManquant } from '@/server/configuration';
import { db } from '@/server/db';
import { modeIa, modeUefn } from '@/server/mode';
import { prixStripe, stripe, stripeActif } from '@/server/stripe';

/**
 * État du site, lisible sans ouvrir les journaux de Vercel.
 *
 * Public : seulement « le site répond, la base répond ». Rien d'autre ne sort
 * sans être connecté en administrateur, et même alors jamais une VALEUR — un
 * secret ne s'affiche pas, on dit seulement s'il est présent. Le contrôle
 * Stripe (`?stripe=1`) interroge Stripe : il repère le piège classique d'un
 * mélange test / réel (clé réelle avec des prix de test, ou l'inverse).
 */
export const dynamic = 'force-dynamic';

const PLANS = ['createur', 'pro', 'studio'] as const;

type ControlePrix = Record<string, 'ok' | 'absent' | 'introuvable' | 'injoignable'>;

async function controlerPrix(): Promise<ControlePrix> {
  const r: ControlePrix = {};
  const plans = await db.plan.findMany({ where: { slug: { in: [...PLANS] } } });
  for (const p of plans) {
    for (const [nom, intervalle] of [['mensuel', 'month'], ['annuel', 'year']] as const) {
      const cle = `${p.slug}_${nom}`;
      const id = prixStripe(p, intervalle);
      if (!id) {
        r[cle] = 'absent';
        continue;
      }
      try {
        await stripe().prices.retrieve(id);
        r[cle] = 'ok';
      } catch (e) {
        // « No such price » : l'identifiant n'existe pas dans CE mode de Stripe.
        r[cle] = (e as { code?: string; statusCode?: number }).statusCode === 404 || (e as { code?: string }).code === 'resource_missing' ? 'introuvable' : 'injoignable';
      }
    }
  }
  return r;
}

export async function GET(req: Request) {
  let base = false;
  try {
    await db.$queryRaw`select 1`;
    base = true;
  } catch {
    base = false;
  }

  const session = await sessionOuNull();
  const admin = session?.user?.role === 'admin';
  const corps: Record<string, unknown> = { ok: base, base: base ? 'ok' : 'ko' };

  if (admin) {
    const cle = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
    const details: Record<string, unknown> = {
      environnement: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      adresse_publique: urlPublique().origin,
      auth_secret: secretAuthManquant() ? 'MANQUANT' : 'présent',
      cron_secret: process.env.CRON_SECRET?.trim() ? 'présent' : 'MANQUANT',
      ia: modeIa(),
      uefn: modeUefn(),
      stripe: {
        cle: !stripeActif() ? 'absente' : cle.startsWith('sk_live_') ? 'RÉELLE (sk_live)' : cle.startsWith('sk_test_') ? 'test (sk_test)' : 'format inconnu',
        secret_webhook: process.env.STRIPE_WEBHOOK_SECRET?.trim() ? 'présent' : 'MANQUANT',
      },
    };
    if (base) {
      const m = await db.$queryRaw<{ n: bigint }[]>`select count(*) as n from "_prisma_migrations" where finished_at is not null`.catch(() => [{ n: BigInt(-1) }]);
      details.migrations_appliquees = Number(m[0]?.n ?? -1);
    }
    if (new URL(req.url).searchParams.get('stripe') === '1' && stripeActif() && base) {
      details.prix_stripe = await controlerPrix();
    } else if (stripeActif()) {
      details.prix_stripe = 'ajoute ?stripe=1 à l’adresse pour le vérifier auprès de Stripe';
    }
    corps.details = details;
  }

  return Response.json(corps, { status: base ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
