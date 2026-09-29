import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

/**
 * Crée les produits et les prix Stripe EN MODE TEST à partir des offres en
 * base, et affiche les identifiants à copier dans .env (section 7.1).
 *
 *   npx tsx scripts/stripe-setup.ts            # affiche seulement
 *   npx tsx scripts/stripe-setup.ts --enregistrer   # les écrit aussi en base
 *
 * Refuse une clé de production : ce script sert à préparer un environnement
 * de test, pas à créer des prix réels par erreur.
 */

const cle = process.env.STRIPE_SECRET_KEY?.trim();
if (!cle) {
  console.error('STRIPE_SECRET_KEY absente.');
  process.exit(1);
}
if (!cle.startsWith('sk_test_')) {
  console.error('Clé de production détectée : ce script ne travaille qu’en mode test (sk_test_…).');
  process.exit(1);
}

const stripe = new Stripe(cle);
const db = new PrismaClient();
const enregistrer = process.argv.includes('--enregistrer');
const VARIABLES: Record<string, [string, string]> = {
  createur: ['STRIPE_CREATOR_MONTHLY', 'STRIPE_CREATOR_ANNUAL'],
  pro: ['STRIPE_PRO_MONTHLY', 'STRIPE_PRO_ANNUAL'],
  studio: ['STRIPE_STUDIO_MONTHLY', 'STRIPE_STUDIO_ANNUAL'],
};

async function main() {
  const plans = await db.plan.findMany({ where: { isActive: true, monthlyPriceCents: { gt: 0 } }, orderBy: { sortOrder: 'asc' } });
  const lignes: string[] = [];

  for (const p of plans) {
    const produit = await stripe.products.create({ name: `Nexteo ${p.name}`, metadata: { plan: p.slug } });
    const mensuel = await stripe.prices.create({
      product: produit.id,
      currency: 'eur',
      unit_amount: p.monthlyPriceCents,
      tax_behavior: 'inclusive',
      recurring: { interval: 'month' },
      metadata: { plan: p.slug, periode: 'mensuel' },
    });
    const annuel = p.annualPriceCents
      ? await stripe.prices.create({
          product: produit.id,
          currency: 'eur',
          unit_amount: p.annualPriceCents,
          tax_behavior: 'inclusive',
          recurring: { interval: 'year' },
          metadata: { plan: p.slug, periode: 'annuel' },
        })
      : null;

    const [vm, va] = VARIABLES[p.slug] ?? [`STRIPE_${p.slug.toUpperCase()}_MONTHLY`, `STRIPE_${p.slug.toUpperCase()}_ANNUAL`];
    lignes.push(`${vm}="${mensuel.id}"`);
    if (annuel) lignes.push(`${va}="${annuel.id}"`);
    if (enregistrer) {
      await db.plan.update({ where: { id: p.id }, data: { stripeMonthlyPriceId: mensuel.id, stripeAnnualPriceId: annuel?.id ?? null } });
    }
  }

  console.log('\nÀ copier dans .env :\n');
  console.log(lignes.join('\n'));
  console.log('\nLes recharges n’ont pas de prix fixe : leur montant est calculé à chaque achat (quantité libre).');
  if (enregistrer) console.log('\nIdentifiants aussi enregistrés en base.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
