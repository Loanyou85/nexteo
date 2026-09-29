import { expect, test } from '@playwright/test';

/**
 * Parcours déconnecté (section 5.5) : choisir une offre en annuel, créer son
 * compte, et reprendre le paiement avec la même offre et la même période.
 */

const stripeConfigure = !!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');

test('déconnecté : inscription puis reprise avec la même offre et la même période', async ({ page }) => {
  await page.goto('/tarifs?periode=annuel');
  const carte = page.locator('h3:visible', { hasText: 'Pro' }).locator('..');
  await carte.getByRole('link', { name: /Choisir Pro/ }).click();

  await expect(page).toHaveURL(/\/inscription\?suite=/);
  const suite = new URL(page.url()).searchParams.get('suite') ?? '';
  expect(suite).toContain('plan=pro');
  expect(suite).toContain('periode=annuel');

  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.test`;
  await page.getByLabel('Prénom').fill('Test');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('une phrase assez longue');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  if (stripeConfigure) {
    // Avec une clé de test, la reprise mène droit au Checkout Stripe.
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    return;
  }
  await expect(page).toHaveURL(/\/tarifs\/paiement\?plan=pro&periode=annuel/);
  // Sans Stripe, la page le dit clairement et ne prétend rien facturer.
  await expect(page.getByText(/Rien ne t’a été facturé/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Revenir aux tarifs' })).toHaveAttribute('href', '/tarifs?periode=annuel');
});

test('le lien de connexion garde l’offre choisie', async ({ page }) => {
  await page.goto('/inscription?suite=' + encodeURIComponent('/tarifs/paiement?plan=pro&periode=annuel'));
  await page.getByRole('link', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/connexion\?suite=/);
  expect(new URL(page.url()).searchParams.get('suite')).toBe('/tarifs/paiement?plan=pro&periode=annuel');
});

test.describe('paiement Stripe de bout en bout', () => {
  test.skip(!stripeConfigure, 'Aucune clé Stripe de test (sk_test_…) : paiement non testable ici.');

  test('abonnement et recharge par carte de test', async () => {
    // Nécessite `stripe listen --forward-to localhost:3100/api/webhooks/stripe`
    // pour que le webhook crédite le compte. Laissé à la recette avec clés.
    test.fixme(true, 'À dérouler avec la CLI Stripe et une carte 4242 4242 4242 4242.');
  });
});
