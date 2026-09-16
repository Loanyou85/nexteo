/**
 * Le diagnostic (section 8.1).
 *
 * Une question par écran, jamais de formulaire long, sauvegarde à chaque
 * réponse. Public : aucune inscription n'est demandée avant les idées.
 *
 * L'ordre n'est pas décoratif. Les secteurs connus de l'intérieur arrivent
 * tôt parce que c'est la dimension la plus discriminante, et les contraintes
 * arrivent tard parce qu'elles n'engagent à rien.
 */

export type QuestionKind = 'choice' | 'multi' | 'skills' | 'text' | 'slider';

export interface ChoiceOption {
  value: string;
  label: string;
  hint?: string;
}

export interface Question {
  key: string;
  kind: QuestionKind;
  /** Titre de l'écran. Une question, pas un intitulé de champ. */
  title: string;
  help?: string;
  /** Référentiel à charger depuis la base pour les questions à choix multiples. */
  source?: 'domains' | 'interests' | 'skills';
  options?: ChoiceOption[];
  placeholder?: string;
  /** Une question facultative peut être passée. */
  optional?: boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  defaultValue?: number;
  /** Nombre maximum de réponses pour une question à choix multiples. */
  maxChoices?: number;
}

export const QUESTIONS: Question[] = [
  {
    key: 'age',
    kind: 'choice',
    title: 'Quel âge as-tu ?',
    help: 'On te le demande une fois, pour savoir ce qu’on a le droit de te proposer.',
    options: [
      { value: '15', label: 'Moins de 16 ans' },
      { value: '17', label: '16 ou 17 ans' },
      { value: '21', label: '18 à 24 ans' },
      { value: '29', label: '25 à 34 ans' },
      { value: '39', label: '35 à 44 ans' },
      { value: '50', label: '45 ans ou plus' },
    ],
  },
  {
    key: 'status',
    kind: 'choice',
    title: 'Tu fais quoi en ce moment ?',
    options: [
      { value: 'student', label: 'Je suis étudiant' },
      { value: 'employed', label: 'Je suis salarié' },
      { value: 'unemployed', label: 'Je cherche du travail' },
      { value: 'freelance', label: 'Je suis indépendant' },
      { value: 'entrepreneur', label: 'J’ai déjà une activité' },
      { value: 'other', label: 'Autre chose' },
    ],
  },
  {
    key: 'domains',
    kind: 'multi',
    source: 'domains',
    maxChoices: 3,
    title: 'Quels milieux tu connais de l’intérieur ?',
    help:
      'C’est la question la plus importante. Pas ce qui t’intéresse : ce que tu as vu fonctionner de près. Un serveur connaît les problèmes de la restauration. Choisis-en un à trois.',
  },
  {
    key: 'domainKnowledge',
    kind: 'choice',
    title: 'Tu connais ce milieu comment ?',
    options: [
      { value: 'metier-4', label: 'J’y ai travaillé plusieurs années' },
      { value: 'metier-1', label: 'J’y ai travaillé un peu' },
      { value: 'etudes-2', label: 'Je l’étudie, ou je l’ai étudié' },
      { value: 'entourage-2', label: 'Des proches y travaillent' },
      { value: 'passion-1', label: 'Je le suis de l’extérieur' },
    ],
  },
  {
    key: 'skills',
    kind: 'skills',
    source: 'skills',
    title: 'Tu sais faire quoi ?',
    help: 'Touche une fois pour « je sais faire », deux fois pour « je suis vraiment bon ».',
  },
  {
    key: 'interests',
    kind: 'multi',
    source: 'interests',
    maxChoices: 4,
    title: 'Qu’est-ce qui t’intéresse vraiment ?',
    help: 'Pas ce que tu devrais aimer. Ce sur quoi tu lis des choses sans qu’on te le demande.',
  },
  {
    key: 'friction-repetitive',
    kind: 'text',
    title: 'Quelle corvée as-tu vue faire à la main ?',
    help:
      'Dans ton travail, tes études, ou chez des proches. Quelque chose que quelqu’un refait chaque semaine et que tout le monde trouve normal.',
    placeholder: 'Par exemple : recopier les commandes du cahier dans un tableur, tous les lundis.',
  },
  {
    key: 'friction-plaintes',
    kind: 'text',
    optional: true,
    title: 'De quoi les gens de ce milieu se plaignent-ils ?',
    help: 'Ce que tu entends revenir, à la pause ou en fin de journée.',
    placeholder: 'Par exemple : « on ne sait jamais qui devait venir ce matin ».',
  },
  {
    key: 'reachableCount',
    kind: 'slider',
    min: 0,
    max: 20,
    step: 1,
    defaultValue: 5,
    unit: 'personnes',
    title: 'Combien de personnes de ce milieu peux-tu appeler demain ?',
    help:
      'Des personnes réelles, dont tu as le numéro ou que tu peux joindre par quelqu’un. C’est ton avantage sur quelqu’un de mieux financé que toi.',
  },
  {
    key: 'hoursPerWeek',
    kind: 'choice',
    title: 'Combien d’heures par semaine peux-tu y consacrer ?',
    options: [
      { value: '3', label: 'Moins de 5 heures' },
      { value: '7', label: '5 à 10 heures' },
      { value: '13', label: '10 à 15 heures' },
      { value: '20', label: '15 à 25 heures' },
      { value: '35', label: 'Plus de 25 heures' },
    ],
  },
  {
    key: 'budget',
    kind: 'choice',
    title: 'Combien peux-tu mettre par mois, sans que ça te gêne ?',
    help: 'Le parcours est fait pour marcher à zéro. La question sert juste à écarter ce qui coûte trop cher.',
    options: [
      { value: '0', label: 'Rien du tout' },
      { value: '30', label: 'Jusqu’à 30 €' },
      { value: '100', label: 'Jusqu’à 100 €' },
      { value: '300', label: 'Jusqu’à 300 €' },
      { value: '500', label: 'Plus de 300 €' },
    ],
  },
  {
    key: 'technicalLevel',
    kind: 'choice',
    title: 'Tu te débrouilles comment avec un ordinateur ?',
    help: 'Réponds honnêtement : c’est ce qui décide du chemin qu’on te propose, et les deux mènent au même endroit.',
    options: [
      { value: '0', label: 'Je fais le strict nécessaire' },
      { value: '1', label: 'Je me débrouille dans les applications' },
      { value: '2', label: 'Je bidouille des tableurs et des outils en ligne' },
      { value: '4', label: 'J’ai déjà touché à du code' },
    ],
  },
  {
    key: 'goalRevenue',
    kind: 'slider',
    min: 0,
    max: 20000,
    // Un pas de 250 € sur vingt mille : assez fin pour viser juste, assez
    // large pour se contrôler au pouce sur un écran de 390 px.
    step: 250,
    defaultValue: 1000,
    unit: '€ par mois',
    title: 'Tu vises combien par mois ?',
    help: 'Personne ne te garantit ce chiffre. Il sert à écarter les idées dont le prix ne permettrait jamais d’y arriver.',
  },
  {
    key: 'timeHorizon',
    kind: 'choice',
    title: 'Dans combien de temps veux-tu ton premier client payant ?',
    options: [
      { value: '2', label: 'Dans deux mois' },
      { value: '4', label: 'Dans trois à six mois' },
      { value: '9', label: 'Dans l’année' },
      { value: '18', label: 'Je ne suis pas pressé' },
    ],
  },
  {
    key: 'showsFace',
    kind: 'choice',
    title: 'Tu es prêt à apparaître en vidéo ?',
    help: 'Si tu réponds non, aucun script ne te demandera de te filmer.',
    options: [
      { value: 'oui', label: 'Oui, ça ne me dérange pas' },
      { value: 'non', label: 'Non, je préfère rester derrière l’écran' },
    ],
  },
  {
    key: 'prefersSolo',
    kind: 'choice',
    title: 'Aller chercher tes premiers clients un par un, ça te va ?',
    help: 'Appeler, écrire, relancer. Les premiers clients arrivent toujours comme ça.',
    options: [
      { value: 'non', label: 'Oui, je peux le faire' },
      { value: 'oui', label: 'Je préfère éviter' },
    ],
  },
];

export const QUESTION_KEYS = QUESTIONS.map((q) => q.key);

export function questionAt(index: number): Question | null {
  return QUESTIONS[index] ?? null;
}

export function indexOfQuestion(key: string): number {
  return QUESTIONS.findIndex((q) => q.key === key);
}

/** Clés des questions ouvertes, normalisées ensuite vers le vocabulaire fermé. */
export const FRICTION_QUESTION_KEYS = QUESTIONS.filter((q) => q.kind === 'text').map((q) => q.key);
