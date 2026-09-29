import type { GameSpec } from '@/lib/gamespec/schema';

/**
 * Vérification de pré-publication (section 22). Pure : elle juge des faits
 * relus, elle ne les suppose pas.
 *
 * Le produit NE PUBLIE PAS. Il prépare, et il dit ce qui reste à faire dans le
 * Creator Portal — image de vignette, tests privés, publication. Ces rappels
 * sont listés à part : ils ne bloquent pas « Prêt », mais on ne les cache pas.
 */

export type Controle = { cle: string; libelle: string; ok: boolean; detail: string; lien: string };

export type FaitsPrepublication = {
  spec: GameSpec;
  compilationReussie: boolean;
  erreursExecution: number;
  devicesPresents: string[];
  apparitionsJoueur: number;
  testsBloquants: { total: number; reussis: number; echoues: string[] };
  testVictoireReussi: boolean;
  testDefaiteReussi: boolean;
  metadonnees: { titre: string; description: string; motsCles: string[]; promptVignette: string };
};

export const RAPPELS_CREATOR_PORTAL = [
  'Déposer l’image de vignette (le prompt est fourni, l’image se crée et se dépose dans le Creator Portal).',
  'Lancer un test privé avec de vrais joueurs.',
  'Publier depuis le Creator Portal : Nexteo ne publie jamais à ta place.',
];

export function verifierPrepublication(f: FaitsPrepublication): { pret: boolean; controles: Controle[] } {
  const attendus = f.spec.devices.map((d) => d.stableId);
  const manquants = attendus.filter((id) => !f.devicesPresents.includes(id));

  const controles: Controle[] = [
    { cle: 'compilation', libelle: 'Le Verse compile', ok: f.compilationReussie, detail: f.compilationReussie ? 'Dernière compilation sans erreur.' : 'La dernière compilation a échoué.', lien: 'verse' },
    { cle: 'execution', libelle: 'Aucune erreur d’exécution connue', ok: f.erreursExecution === 0, detail: f.erreursExecution === 0 ? 'Aucune ligne d’erreur dans les logs du dernier playtest.' : `${f.erreursExecution} erreur(s) dans les logs du dernier playtest.`, lien: 'erreurs' },
    { cle: 'devices', libelle: 'Les devices requis existent', ok: manquants.length === 0, detail: manquants.length === 0 ? `${attendus.length} devices présents dans le projet.` : `Manquants : ${manquants.join(', ')}.`, lien: 'devices' },
    { cle: 'apparitions', libelle: 'Les points d’apparition existent', ok: f.apparitionsJoueur >= f.spec.playerCount, detail: `${f.apparitionsJoueur} point(s) d’apparition pour ${f.spec.playerCount} joueur(s).`, lien: 'devices' },
    { cle: 'victoire', libelle: 'Une condition de victoire existe et se déclenche', ok: f.spec.winConditions.length > 0 && f.testVictoireReussi, detail: f.testVictoireReussi ? 'Observée dans le playtest.' : 'Non observée dans le playtest.', lien: 'tests' },
    { cle: 'defaite', libelle: 'Une condition de défaite existe et se déclenche', ok: f.spec.loseConditions.length > 0 && f.testDefaiteReussi, detail: f.testDefaiteReussi ? 'Observée dans le playtest.' : 'Non observée dans le playtest.', lien: 'tests' },
    { cle: 'boucle', libelle: 'La boucle de jeu est complète', ok: f.testsBloquants.total > 0 && f.testsBloquants.reussis === f.testsBloquants.total, detail: f.testsBloquants.echoues.length ? `Tests bloquants en échec : ${f.testsBloquants.echoues.join(', ')}.` : `${f.testsBloquants.reussis}/${f.testsBloquants.total} tests bloquants réussis.`, lien: 'tests' },
    { cle: 'performance', libelle: 'Contrôles de performance accessibles', ok: attendus.length <= f.spec.performanceRequirements.maxDevices, detail: `${attendus.length} devices pour un maximum de ${f.spec.performanceRequirements.maxDevices}. La mémoire réelle se mesure dans UEFN.`, lien: 'devices' },
    { cle: 'metadonnees', libelle: 'Titre, description et mots-clés complets', ok: f.metadonnees.titre.length >= 2 && f.metadonnees.description.length >= 40 && f.metadonnees.motsCles.length >= 3, detail: `${f.metadonnees.motsCles.length} mots-clés, description de ${f.metadonnees.description.length} caractères.`, lien: 'pre-publication' },
    { cle: 'vignette', libelle: 'Prompt de vignette et description générés', ok: f.metadonnees.promptVignette.length > 0, detail: 'L’image elle-même se dépose dans le Creator Portal.', lien: 'pre-publication' },
  ];

  return { pret: controles.every((c) => c.ok), controles };
}

/** Métadonnées de publication, générées depuis le plan (section 22). */
export function genererMetadonnees(spec: GameSpec) {
  const motsCles = ['survie', 'zombies', 'coop', `${spec.playerCount} joueurs`, spec.environment.replace('_', ' ')];
  return {
    titre: spec.title,
    description: spec.description.length >= 40 ? spec.description : `${spec.description} ${spec.objectives.join('. ')}.`.trim(),
    motsCles,
    promptVignette: `Illustration verticale, style jeu vidéo coloré : ${spec.playerCount} survivants dos à dos dans un ${spec.environment.replace('_', ' ')} envahi de zombies, lumière d’urgence, titre « ${spec.title} » en lettres épaisses.`,
    textePromo: `${spec.title} — ${spec.objectives[0] ?? 'Survis'}. ${spec.rounds.count} manches, ${spec.playerCount} joueurs, une seule règle : tenir.`,
  };
}
