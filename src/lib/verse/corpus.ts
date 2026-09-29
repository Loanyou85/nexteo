/**
 * Corpus de sorties du compilateur Verse.
 *
 * RECONSTITUÉ à partir de la forme documentée des diagnostics, faute d'accès à
 * un vrai UEFN pendant la construction. À REMPLACER par des sorties réelles
 * collectées dès les premiers builds contre le vrai MCP (DECISIONS n° 15) :
 * c'est sur de vraies erreurs que ce parseur doit faire ses preuves.
 */
export const CORPUS = {
  identifiantInconnu:
    'C:/Users/Joueur/Documents/Fortnite Projects/ZombieHospital/Plugins/ZombieHospital/Content/zombie_spawner.verse(26,9, 26,19): Script error 3506: Unknown identifier `SpawnZombi`.',
  cheminAntislash:
    'C:\\Users\\Joueur\\Documents\\Fortnite Projects\\ZombieHospital\\Plugins\\ZombieHospital\\Content\\modules\\hud_manager.verse(9,9, 9,14): Script error 3506: Unknown identifier `Print`.',
  typeIncompatible:
    '/ZombieHospital/currency_system.verse(18,20, 18,34): Script error 3509: This expression expected a value of type int but found a value of type float.',
  sansFin: '/ZombieHospital/round_manager.verse(4,1): Script error 3100: Expected an indented block after class definition.',
  sansPosition: 'Script error 3001: Internal compiler error while processing the project.',
  avertissement:
    '/ZombieHospital/game_manager.verse(12,5, 12,16): Script warning 2011: This expression has no effect.',
  bruitEtResume: [
    'Verse build started',
    '/ZombieHospital/zombie_spawner.verse(26,9, 26,19): Script error 3506: Unknown identifier `SpawnZombi`.',
    '/ZombieHospital/hud_manager.verse(9,9, 9,14): Script error 3506: Unknown identifier `Print`.',
    'Build failed: 2 errors, 0 warnings',
  ].join('\n'),
  nonReconnue: 'LogVerse: error: plugin mount point could not be resolved',
} as const;
