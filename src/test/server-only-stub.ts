/**
 * `server-only` lève à l'import hors composant serveur, ce qui empêche de
 * tester unitairement un module côté serveur. En test, on le neutralise :
 * la garde reste bien en place dans le build de l'application.
 */
export {};
