import { expect, test } from '@playwright/test';
import { adresseDeTest, db, nettoyerComptesDeTest, supprimerCompteDeTest } from './fixtures';

const MOBILE = { width: 390, height: 844 };

test.afterAll(async () => {
  await nettoyerComptesDeTest();
  await db.$disconnect();
});

test.describe('la page d’accueil', () => {
  test.use({ viewport: MOBILE });

  test('annonce ce que fait le produit et porte la mention obligatoire', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Crée ton SaaS de A à Z, étape par étape.',
    );

    // Section 6.2 : cette mention n'est pas optionnelle et doit être visible
    // sans scroll supplémentaire.
    const mention = page.getByText('Résultats du fondateur. Aucun résultat n’est garanti.');
    await expect(mention).toBeVisible();

    // Section 2.2 : une barre d'action collée en bas, toujours visible.
    const barre = page.getByRole('link', { name: /Trouver mon idée/ }).last();
    await expect(barre).toBeVisible();
  });

  test('ne fabrique aucun chiffre et n’invente aucun témoignage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Personne n’a encore partagé la sienne.')).toBeVisible();

    const texte = (await page.locator('body').innerText()).toLowerCase();
    for (const interdit of ['revenus passifs', 'deviens riche', 'argent facile', 'garanti de gagner']) {
      expect(texte, `la landing contient « ${interdit} »`).not.toContain(interdit);
    }
  });

  test('ne déborde jamais horizontalement et garde des cibles de 48 px', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(debordement, 'débordement horizontal en pixels').toBeLessThanOrEqual(1);

    const tropPetites = await page.evaluate(() => {
      const cibles = document.querySelectorAll('a, button, summary, [role="button"]');
      const fautives: string[] = [];
      for (const cible of cibles) {
        const rect = cible.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.height < 48) fautives.push(`${cible.tagName} « ${cible.textContent?.trim().slice(0, 30)} »`);
      }
      return fautives;
    });
    expect(tropPetites).toEqual([]);
  });
});

test.describe('le diagnostic', () => {
  test.use({ viewport: MOBILE });

  test('se traverse en entier et rend trois idées justifiées', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/diagnostic');

    // 0 — âge
    await page.getByRole('button', { name: '18 à 24 ans' }).click();
    await page.waitForURL(/q=1/);

    // 1 — situation
    await page.getByRole('button', { name: 'Je suis étudiant' }).click();
    await page.waitForURL(/q=2/);

    // 2 — secteurs connus de l'intérieur
    await page.getByText('Restauration', { exact: true }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.waitForURL(/q=3/);

    // 3 — comment il connaît ce milieu
    await page.getByRole('button', { name: 'J’y ai travaillé plusieurs années' }).click();
    await page.waitForURL(/q=4/);

    // 4 — compétences
    await page.getByRole('button', { name: 'M’organiser et organiser les autres' }).click();
    await page.getByRole('button', { name: 'M’occuper des clients' }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.waitForURL(/q=5/);

    // 5 — centres d'intérêt
    await page.getByText('La cuisine', { exact: true }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.waitForURL(/q=6/);

    // 6 et 7 — les réponses libres
    await page
      .getByRole('textbox')
      .fill('Le planning de la semaine se fait sur un tableur que personne ne comprend.');
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.waitForURL(/q=7/);

    await page.getByRole('textbox').fill('On ne sait jamais qui devait venir ce matin.');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForURL(/q=8/);

    // 8 — curseur : personnes joignables
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.waitForURL(/q=9/);

    // 9 à 15
    await page.getByRole('button', { name: '10 à 15 heures' }).click();
    await page.waitForURL(/q=10/);
    await page.getByRole('button', { name: 'Jusqu’à 100 €' }).click();
    await page.waitForURL(/q=11/);
    await page.getByRole('button', { name: 'Je bidouille des tableurs et des outils en ligne' }).click();
    await page.waitForURL(/q=12/);
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.waitForURL(/q=13/);
    await page.getByRole('button', { name: 'Dans trois à six mois' }).click();
    await page.waitForURL(/q=14/);
    await page.getByRole('button', { name: 'Oui, ça ne me dérange pas' }).click();
    await page.waitForURL(/q=15/);
    await page.getByRole('button', { name: 'Oui, je peux le faire' }).click();

    // L'écran d'analyse s'envoie tout seul.
    await page.waitForURL('**/mes-idees', { timeout: 60_000 });

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Trois idées');
    await expect(page.getByText('Celle qui te ressemble le plus')).toBeVisible();

    // Section 8.3 : chaque idée cite les éléments du profil qui l'ont produite.
    await expect(page.getByRole('heading', { name: 'Pourquoi elle sort pour toi' }).first()).toBeVisible();
    await expect(page.getByText(/Secteur « restauration » : tu y as travaillé/i).first()).toBeVisible();

    // Le profil du serveur doit sortir une idée de restauration en tête.
    const principale = page.getByRole('heading', { level: 2 }).first();
    await expect(principale).toContainText(/restaurant/i);

    // Le verdict n'est pas un cul-de-sac : on peut revenir, tout refaire, ou
    // rejoindre un compte existant.
    await expect(page.getByRole('link', { name: '← Revenir aux questions' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Modifier mes réponses' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Connecte-toi' })).toBeVisible();

    await page.getByRole('button', { name: 'Recommencer le diagnostic' }).click();
    await page.waitForURL(/\/diagnostic(\?|$)/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Quel âge as-tu');
  });

  test('on peut revenir en arrière et se connecter depuis n’importe quelle question', async ({ page }) => {
    await page.goto('/diagnostic');
    // Première question : rien derrière, mais une porte d'entrée pour qui revient.
    await expect(page.getByRole('link', { name: 'J’ai déjà un compte' })).toBeVisible();
    await expect(page.getByRole('button', { name: '← Question précédente' })).toHaveCount(0);

    await page.getByRole('button', { name: '18 à 24 ans' }).click();
    await page.waitForURL(/q=1/);

    await page.getByRole('button', { name: '← Question précédente' }).click();
    await page.waitForURL(/q=0/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Quel âge as-tu');
  });

  test('un mineur de moins de seize ans est arrêté avant le compte', async ({ page }) => {
    await page.goto('/diagnostic');
    await page.getByRole('button', { name: 'Moins de 16 ans' }).click();
    await page.waitForURL('**/trop-jeune');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'On ne peut pas te créer de compte',
    );
  });
});

test.describe('sans JavaScript', () => {
  test.use({ viewport: MOBILE, javaScriptEnabled: false });

  /**
   * Régression : une version contrôlée des cases ne dessinait la coche
   * qu'après l'hydratation, et un clic avant celle-ci était annulé.
   */
  test('les cases se cochent et le formulaire part quand même', async ({ page }) => {
    await page.goto('/diagnostic?q=2');

    const label = page.getByText('Restauration', { exact: true });
    await label.click();

    const coche = page.locator('input[type="checkbox"][value="restauration"]');
    await expect(coche).toBeChecked();

    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.waitForURL(/q=3/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu connais ce milieu comment');
  });

  test('un choix unique avance tout seul, sans bouton à chercher', async ({ page }) => {
    await page.goto('/diagnostic?q=1');
    await page.getByRole('button', { name: 'Je suis salarié' }).click();
    await page.waitForURL(/q=2/);
  });
});

test.describe('le compte et le parcours', () => {
  test.use({ viewport: MOBILE });

  test('de l’idée choisie au premier critère validé', async ({ page }) => {
    test.setTimeout(180_000);
    const email = adresseDeTest();

    // Un profil complet, posé directement : le diagnostic est déjà couvert.
    await page.goto('/diagnostic');
    await page.getByRole('button', { name: '25 à 34 ans' }).click();
    await page.waitForURL(/q=1/);
    await page.getByRole('button', { name: 'Je suis salarié' }).click();
    await page.waitForURL(/q=2/);
    await page.getByText('Transport et livraison', { exact: true }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.waitForURL(/q=3/);
    await page.getByRole('button', { name: 'J’y ai travaillé plusieurs années' }).click();
    await page.waitForURL(/q=4/);

    // Le reste du diagnostic, en sautant ce qui est facultatif.
    for (const cible of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
      await page.goto(`/diagnostic?q=${cible}`);
      const suivant = page.getByRole('button', { name: /Suivant|Continuer/ });
      if (await suivant.count()) {
        const zone = page.getByRole('textbox');
        if (await zone.count()) await zone.fill('Les preuves de livraison sont des photos perdues.');
        await suivant.first().click();
      } else {
        await page.getByRole('button', { name: /.+/ }).nth(1).click();
      }
      await page.waitForLoadState('networkidle');
    }

    await page.goto('/diagnostic/analyse');
    await page.waitForURL('**/mes-idees', { timeout: 60_000 });

    await page.getByRole('button', { name: 'Je construis celle-là' }).click();
    await page.waitForURL(/\/inscription/);

    await page.getByLabel('Ton prénom').fill('Camille');
    await page.getByLabel('Ton adresse e-mail').fill(email);
    await page.getByLabel('Ton mot de passe').fill('un-mot-de-passe-assez-long');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    // Le point de bascule : les offres, juste après la restitution.
    await page.waitForURL('**/offres', { timeout: 30_000 });
    await expect(page.getByText('7,99 €')).toBeVisible();
    await expect(page.getByText('18,99 €')).toBeVisible();
    await expect(page.getByText('35,99 €')).toBeVisible();

    // L'offre gratuite existe, mais n'est pas une quatrième carte.
    await page.getByRole('link', { name: 'Continuer sans payer' }).click();
    await page.waitForURL('**/app');

    await expect(page.getByText('Maintenant')).toBeVisible();
    await page.getByRole('link', { name: 'Ouvrir l’étape' }).click();
    await page.waitForURL(/\/app\/etape\//);

    // Le bouton de validation reste fermé tant que tout n'est pas coché.
    const valider = page.getByRole('button', { name: /Encore \d+ case/ });
    await expect(valider).toBeDisabled();

    // Un critère qui demande une preuve refuse d'être coché tant qu'elle
    // manque, et le dit.
    const premiere = page.locator('button[aria-pressed]').first();
    await premiere.click();
    await expect(page.getByText('Colle d’abord ce qui est demandé juste au-dessus.')).toBeVisible();
    await expect(premiere).toHaveAttribute('aria-pressed', 'false');

    // Avec la preuve, la case se coche et le reste après rechargement.
    await page.getByRole('textbox').first().fill('Un suivi de livraisons pour transporteurs.');
    await premiere.click();
    await expect(premiere).toHaveAttribute('aria-pressed', 'true');
    // La coche s'affiche avant la réponse du serveur : on attend que
    // l'enregistrement ait abouti avant de recharger, sinon on teste une course.
    await page.waitForLoadState('networkidle');
    await page.reload();
    await expect(page.locator('button[aria-pressed="true"]').first()).toBeVisible();

    // Le parcours payant reste fermé sans paiement.
    await page.goto('/app/chemin');
    await expect(page.getByRole('link', { name: 'Ouvrir la suite du parcours' }).first()).toBeVisible();

    const abonnement = await db.subscription.findFirst({ where: { user: { email } } });
    expect(abonnement?.plan, 'aucun accès payant ne doit être ouvert sans paiement').toBe('free');
    expect(abonnement?.intendedPlan).toBeNull();

    await page.goto('about:blank');
    await supprimerCompteDeTest(email);
  });
});

test.describe('quand quelque chose casse', () => {
  test.use({ viewport: MOBILE });

  test('l’état du site est lisible en une adresse', async ({ request }) => {
    const reponse = await request.get('/api/sante');
    expect(reponse.status(), 'la base doit répondre et le contenu être en place').toBe(200);

    const sante = await reponse.json();
    expect(sante.etat).toBe('ok');

    // Les quatre opérations dont dépend la première question du diagnostic.
    const noms = sante.etapes.map((e: { nom: string }) => e.nom);
    expect(noms).toEqual(['Lire la base', 'Écrire dans la base', 'Lire les cookies', 'Poser un cookie']);
    for (const etape of sante.etapes) expect(etape.ok, etape.nom).toBe(true);

    expect(sante.contenu.complet).toBe(true);
    expect(sante.contenu.phases).toBe(13);
    expect(sante.contenu.archetypes).toBeGreaterThan(0);

    // Rien de sensible ne doit fuir : des booléens et des comptes, pas de valeurs.
    const brut = JSON.stringify(sante);
    expect(brut).not.toMatch(/postgres|sk_|whsec_|password/i);
  });

  test('une adresse inconnue donne un écran soigné, pas une erreur brute', async ({ page }) => {
    const reponse = await page.goto('/cette-page-nexiste-pas');
    expect(reponse?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Cette page n’existe pas');
    await expect(page.getByRole('link', { name: 'Revenir à l’accueil' })).toBeVisible();

    const texte = await page.locator('body').innerText();
    // Aucun détail technique visible.
    expect(texte).not.toMatch(/stack|webpack|\.tsx|at Object\./i);
  });
});

test.describe('créer un compte sans passer par les questions', () => {
  test.use({ viewport: MOBILE });

  test('la connexion mène à l’inscription, et l’inscription ne boucle pas', async ({ page }) => {
    test.setTimeout(120_000);
    const email = adresseDeTest('direct');

    // Depuis n'importe quel écran public, le bouton de l'en-tête ramène au compte.
    await page.goto('/');
    await page.getByRole('link', { name: 'Se connecter' }).click();
    await page.waitForURL('**/connexion');

    await page.getByRole('link', { name: 'Créer un compte' }).click();
    await page.waitForURL('**/inscription');

    await page.getByLabel('Ton prénom').fill('Alex');
    await page.getByLabel('Ton adresse e-mail').fill(email);
    await page.getByLabel('Ton mot de passe').fill('un-mot-de-passe-assez-long');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    // Sans idée choisie, on arrive chez soi — pas dans une boucle de
    // redirections vers le diagnostic.
    await page.waitForURL('**/app', { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Bienvenue');
    await expect(page.getByRole('link', { name: 'Trouver mon idée' })).toBeVisible();

    // Les autres écrans de l'application tiennent aussi sans idée.
    await page.goto('/mes-idees');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('après le diagnostic');

    await page.goto('/app/compte');
    await expect(page.getByText(email)).toBeVisible();

    await page.goto('about:blank');
    await supprimerCompteDeTest(email);
  });
});

test.describe('l’écran de panne', () => {
  test.use({ viewport: MOBILE });

  test('explique la cause en français au lieu d’un identifiant illisible', async ({ page }) => {
    await page.goto('/diagnostic/probleme?code=P1001&question=age');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('voici pourquoi');
    await expect(page.getByText('Le site n’arrive pas à joindre sa base de données.')).toBeVisible();
    await expect(page.getByText('Quel âge as-tu ?', { exact: false })).toBeVisible();

    // Le rapport refait le test : ici la base répond, donc tout est vert.
    await expect(page.getByText('Lire la base')).toBeVisible();
    await expect(page.getByText('Écrire dans la base')).toBeVisible();

    await expect(page.getByRole('link', { name: 'Réessayer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copier le rapport' })).toBeVisible();

    // Rien de sensible à l'écran.
    const texte = await page.locator('body').innerText();
    expect(texte).not.toMatch(/postgres(ql)?:\/\/|sk_|whsec_/);
  });
});

test.describe('une session qui désigne un compte disparu', () => {
  test.use({ viewport: MOBILE });

  /**
   * Régression exacte de la panne vécue en production. Les sessions sont sans
   * état : le jeton signé survit dans le navigateur à la suppression du
   * compte — et à une base remise à zéro par une migration. Il se décode
   * parfaitement et désigne un compte qui n'existe plus.
   *
   * Avant correction, la première question du diagnostic tentait de créer un
   * profil rattaché à ce compte fantôme et mourait sur une clé étrangère
   * (P2003), très loin de la cause.
   */
  test('ne bloque ni le diagnostic ni l’application', async ({ page }) => {
    test.setTimeout(120_000);
    const email = adresseDeTest('fantome');

    await page.goto('/inscription');
    await page.getByLabel('Ton prénom').fill('Sam');
    await page.getByLabel('Ton adresse e-mail').fill(email);
    await page.getByLabel('Ton mot de passe').fill('un-mot-de-passe-assez-long');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await page.waitForURL('**/app', { timeout: 30_000 });

    // Le compte disparaît, le jeton reste dans le navigateur.
    await supprimerCompteDeTest(email);

    // Le diagnostic public doit continuer de fonctionner, en anonyme.
    await page.goto('/diagnostic');
    await page.getByRole('button', { name: '18 à 24 ans' }).click();
    await page.waitForURL(/q=1/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu fais quoi en ce moment');

    // Et l'application renvoie proprement vers la connexion.
    await page.goto('/app');
    await page.waitForURL('**/connexion');

    await page.goto('about:blank');
  });
});
