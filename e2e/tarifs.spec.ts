import { expect, test, type Page } from '@playwright/test';

/**
 * Page de tarifs (section 9 de l'offre). Les montants attendus sont lus sur
 * la page elle-même, jamais recopiés ici : l'administration peut les changer.
 */

const basculeur = (page: Page) => page.getByRole('switch', { name: 'Facturation annuelle' });

/** Le premier prix affiché de chaque carte visible, dans l'ordre. */
async function prixAffiches(page: Page): Promise<string[]> {
  const cartes = page.locator('h3:visible').locator('..');
  const n = await cartes.count();
  const prix: string[] = [];
  for (let i = 0; i < n; i++) {
    prix.push((await cartes.nth(i).locator('p').nth(1).innerText()).replace(/\s+/g, ' ').trim());
  }
  return prix;
}

test('le basculeur change les prix et l’adresse', async ({ page }) => {
  await page.goto('/tarifs');
  await expect(basculeur(page)).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('/ mois').filter({ visible: true }).first()).toBeVisible();
  const mensuels = await prixAffiches(page);

  await basculeur(page).click();
  await expect(basculeur(page)).toHaveAttribute('aria-checked', 'true');
  await expect(page).toHaveURL(/[?&]periode=annuel/);
  await expect(page.getByText('/ an').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(/mois offerts/)).toBeVisible();
  await expect.poll(() => prixAffiches(page)).not.toEqual(mensuels);

  await basculeur(page).click();
  await expect(basculeur(page)).toHaveAttribute('aria-checked', 'false');
  await expect(page).not.toHaveURL(/periode=/);
  await expect.poll(() => prixAffiches(page)).toEqual(mensuels);
});

test('le basculeur se commande au clavier', async ({ page }) => {
  await page.goto('/tarifs');
  await basculeur(page).focus();

  await page.keyboard.press('ArrowRight');
  await expect(basculeur(page)).toHaveAttribute('aria-checked', 'true');
  await expect(page).toHaveURL(/periode=annuel/);

  await page.keyboard.press('ArrowLeft');
  await expect(basculeur(page)).toHaveAttribute('aria-checked', 'false');

  await page.keyboard.press('Space');
  await expect(basculeur(page)).toHaveAttribute('aria-checked', 'true');

  await page.keyboard.press('Enter');
  await expect(basculeur(page)).toHaveAttribute('aria-checked', 'false');
});

test('/tarifs?periode=annuel ouvre directement sur l’annuel', async ({ page }) => {
  await page.goto('/tarifs?periode=annuel');
  await expect(basculeur(page)).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('/ an').filter({ visible: true }).first()).toBeVisible();
  // Le mensuel équivalent et le prix barré accompagnent chaque prix annuel.
  await expect(page.getByText(/soit .* \/ mois/).filter({ visible: true }).first()).toBeVisible();
});

test('aucun défilement horizontal', async ({ page }) => {
  await page.goto('/tarifs');
  const debordement = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debordement).toBeLessThanOrEqual(0);
});
