import { expect, test } from '@playwright/test';

/** Ce qu'un visiteur, un moteur de recherche ou une messagerie voient du site public. */

test('robots.txt : pages publiques indexables, pages privées jamais, sitemap déclaré', async ({ request }) => {
  const r = await request.get('/robots.txt');
  expect(r.status()).toBe(200);
  const t = await r.text();
  expect(t).toMatch(/Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/);
  for (const chemin of ['/api/', '/admin', '/compte', '/dashboard', '/projet/', '/creer']) expect(t).toContain(`Disallow: ${chemin}`);
});

test('sitemap.xml liste les pages publiques, et aucune page privée', async ({ request }) => {
  const t = await (await request.get('/sitemap.xml')).text();
  expect(t).toContain('/tarifs');
  expect(t).toContain('/legal/mentions');
  for (const prive of ['/admin', '/dashboard', '/compte', '/projet', '/connexion-uefn']) expect(t).not.toContain(prive);
});

test('l’accueil déclare un aperçu de partage, et l’image existe', async ({ page, request }) => {
  await page.goto('/');
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toBeTruthy();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Nexteo/);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'fr_FR');
  // Le site tourne sur le port de test, l'image est déclarée sur l'adresse publique : on la relit ici.
  const rep = await request.get(new URL(image!).pathname);
  expect(rep.status()).toBe(200);
  expect(rep.headers()['content-type']).toContain('image/png');
});

test('une adresse inconnue affiche une vraie page 404 en français, avec le bon code', async ({ page }) => {
  const rep = await page.goto('/cette-page-nexiste-pas');
  expect(rep?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Cette page n’existe pas.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retour à l’accueil' })).toBeVisible();
});

test('les en-têtes de sécurité sont envoyés, et X-Powered-By ne l’est pas', async ({ request }) => {
  const h = (await request.get('/')).headers();
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['strict-transport-security']).toContain('max-age=');
  expect(h['x-powered-by']).toBeUndefined();
});

test('les pages privées renvoient vers la connexion sans rien révéler', async ({ page }) => {
  for (const chemin of ['/dashboard', '/admin', '/compte', '/creer', '/connexion-uefn']) {
    await page.goto(chemin);
    await expect(page).toHaveURL(/\/connexion/);
  }
});
