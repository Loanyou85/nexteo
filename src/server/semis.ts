import { PrismaClient, type Prisma } from '@prisma/client';
import { specGenerique, specZombie } from '@/lib/gamespec/modeles';
import { lireGameSpec } from '@/lib/gamespec/schema';

/**
 * Semis des référentiels.
 *
 * Il tourne à CHAQUE déploiement. Il crée donc ce qui manque et ne modifie
 * jamais ce qui existe : un prix changé en administration ne doit pas être
 * écrasé par le redéploiement suivant. C'est aussi le seul endroit du dépôt
 * où des prix sont écrits en toutes lettres — la base fait foi ensuite.
 */

/** Client de la passe en cours : fixé par `semer`, jamais créé ici. */
let db: PrismaClient;

let creesCompteur = 0;

async function creerSiAbsent<T>(nom: string, existe: () => Promise<unknown>, creer: () => Promise<T>) {
  if (await existe()) return;
  await creer();
  creesCompteur++;
  console.log(`[semis] ${nom}`);
}

type Fonctionnalite = { label: string; available: boolean };
const f = (label: string, available = true): Fonctionnalite => ({ label, available });

const OFFRES = [
  {
    slug: 'decouverte',
    name: 'Découverte',
    tagline: 'Pour voir ce que l’agent ferait de ton idée.',
    monthlyPriceCents: 0,
    annualPriceCents: null,
    monthlyCredits: 0,
    monthlyGamePlans: 5,
    maxProjects: null,
    maxMembers: 1,
    versionHistoryDays: 30,
    queuePriority: 0,
    realBuilds: false,
    equivalent: '5 plans de map par mois, aucun build',
    features: [f('5 plans de map par mois'), f('GameSpec complet et éditable'), f('Sans carte bancaire')],
    isHighlighted: false,
    sortOrder: 0,
    maxCreditsPerBuild: 0,
  },
  {
    slug: 'createur',
    name: 'Créateur',
    tagline: 'Pour construire ses premières maps.',
    monthlyPriceCents: 3900,
    annualPriceCents: 39000,
    monthlyCredits: 25,
    monthlyGamePlans: null,
    maxProjects: 3,
    maxMembers: 1,
    versionHistoryDays: 30,
    queuePriority: 1,
    realBuilds: true,
    equivalent: '2 maps, ou 1 map + 5 mises à jour',
    features: [
      f('3 projets actifs'),
      f('Builds autonomes'),
      f('Débogage automatique'),
      f('Historique des versions sur 30 jours'),
    ],
    isHighlighted: false,
    sortOrder: 1,
    maxCreditsPerBuild: 20,
  },
  {
    slug: 'pro',
    name: 'Pro',
    tagline: 'Pour publier régulièrement.',
    monthlyPriceCents: 9900,
    annualPriceCents: 99000,
    monthlyCredits: 75,
    monthlyGamePlans: null,
    maxProjects: null,
    maxMembers: 1,
    versionHistoryDays: null,
    queuePriority: 2,
    realBuilds: true,
    equivalent: '7 maps, ou 3 maps + 15 mises à jour',
    features: [
      f('Projets illimités'),
      f('File de build prioritaire'),
      f('Tous les templates, à mesure de leur validation'),
      f('Historique des versions illimité'),
      f('Vérification de pré-publication complète'),
    ],
    isHighlighted: true,
    sortOrder: 2,
    maxCreditsPerBuild: 20,
  },
  {
    slug: 'studio',
    name: 'Studio',
    tagline: 'Pour une équipe qui produit.',
    monthlyPriceCents: 24900,
    annualPriceCents: 249000,
    monthlyCredits: 200,
    monthlyGamePlans: null,
    maxProjects: null,
    maxMembers: 5,
    versionHistoryDays: null,
    queuePriority: 3,
    realBuilds: true,
    equivalent: '20 maps, équipe jusqu’à 5 membres',
    features: [
      // Pas encore construit : affiché « bientôt », jamais vendu comme disponible.
      f('Crédits partagés dans l’équipe, jusqu’à 5 membres', false),
      f('Espaces de travail', false),
      f('Export des projets', false),
      f('File de build prioritaire maximale'),
      f('Support prioritaire'),
    ],
    isHighlighted: false,
    sortOrder: 3,
    maxCreditsPerBuild: 20,
  },
];

const CONFIG: { key: string; value: string; description: string }[] = [
  { key: 'COST_PER_CREDIT', value: '42', description: 'Coût IA de référence d’un crédit, en centimes d’euro (0,42 €).' },
  { key: 'MAX_ANNUAL_DISCOUNT', value: '20', description: 'Remise annuelle maximale, en pourcentage. Plafonnée à 20 par une contrainte en base.' },
  { key: 'ROLLOVER_MONTHS', value: '1', description: 'Nombre de mois pendant lesquels les crédits d’abonnement non utilisés sont reportés.' },
  { key: 'CREDITS_ESTIMATE_FULL', value: '10', description: 'Estimation annoncée avant un premier build complet.' },
  { key: 'CREDITS_ESTIMATE_UPDATE', value: '3', description: 'Estimation annoncée avant une mise à jour typique.' },
  { key: 'TOPUP_MARKUP_PCT', value: '10', description: 'Majoration du crédit en recharge par rapport au crédit de l’offre de l’abonné, en pourcentage.' },
  { key: 'TOPUP_MIN_CREDITS', value: '1', description: 'Quantité minimale d’une recharge.' },
  { key: 'TOPUP_MAX_CREDITS', value: '1000', description: 'Quantité maximale d’une recharge, contre les fautes de frappe.' },
  { key: 'TOPUP_SUGGESTIONS', value: '[10,20,50]', description: 'Quantités proposées en un clic sur la page de tarifs.' },
  { key: 'USD_EUR_RATE_PPM', value: '920000', description: 'Taux de conversion dollar → euro, en millionièmes (0,92). À mettre à jour : les tarifs d’IA sont en dollars.' },
  { key: 'VAT_RATE_BP', value: '2000', description: 'TVA incluse dans les prix, en points de base (20 %).' },
  { key: 'STRIPE_FEE_BP', value: '150', description: 'Frais Stripe proportionnels, en points de base (1,5 %).' },
  { key: 'STRIPE_FEE_FIXED_CENTS', value: '25', description: 'Frais Stripe fixes par paiement, en centimes.' },
  { key: 'HOSTING_COST_PER_SUB_CENTS', value: '100', description: 'Coût d’hébergement mensuel imputé à chaque abonné, en centimes.' },
  {
    key: 'BAREME',
    value: JSON.stringify([
      { operation: 'Plan de map seul', coutCents: 14, credits: 0 },
      { operation: 'Mise à jour typique (~20 étapes)', coutCents: 118, credits: 3 },
      { operation: 'Mise à jour lourde (~50 étapes)', coutCents: 282, credits: 7 },
      { operation: 'Map complète typique (~70 étapes)', coutCents: 406, credits: 10 },
      { operation: 'Map complète au plafond (150 étapes)', coutCents: 836, credits: 20 },
    ]),
    description: 'Barème de référence affiché sur la page de tarifs (coûts estimés, en centimes).',
  },
];

const ENVIRONNEMENTS: { id: string; name: string; description: string; zones: string[] }[] = [
  { id: 'hopital', name: 'Hôpital', description: 'Couloirs étroits, hall central, bloc opératoire et parking souterrain.', zones: ['hall', 'urgences', 'bloc_operatoire', 'parking', 'morgue'] },
  { id: 'ville', name: 'Ville', description: 'Rues ouvertes, toits accessibles, deux places centrales.', zones: ['place_nord', 'place_sud', 'avenue', 'toits'] },
  { id: 'prison', name: 'Prison', description: 'Cellules, cour, mirador et couloirs de sécurité.', zones: ['cour', 'cellules', 'mirador', 'infirmerie'] },
  { id: 'base_militaire', name: 'Base militaire', description: 'Hangars, piste, armurerie et poste de commandement.', zones: ['hangar', 'piste', 'armurerie', 'commandement'] },
  { id: 'ile', name: 'Île', description: 'Plage, jungle, falaise et ponton.', zones: ['plage', 'jungle', 'falaise', 'ponton'] },
  { id: 'entrepot', name: 'Entrepôt', description: 'Rayonnages hauts, quai de chargement et bureaux.', zones: ['rayonnages', 'quai', 'bureaux'] },
  { id: 'arene', name: 'Arène', description: 'Symétrique, trois niveaux, couvertures modulables.', zones: ['centre', 'est', 'ouest', 'gradins'] },
  { id: 'laboratoire', name: 'Laboratoire', description: 'Salles blanches, sas, sous-sol technique.', zones: ['sas', 'salles', 'sous_sol', 'toit'] },
  { id: 'circuit', name: 'Circuit', description: 'Boucle fermée, stands, raccourci et ligne d’arrivée.', zones: ['depart', 'stands', 'epingle', 'arrivee'] },
];

/**
 * Catalogue de devices SIMULÉ. `verifiedAt` reste nul : aucun de ces devices
 * n'a été confronté au catalogue réel du MCP. La tâche d'inspection du
 * catalogue le remplira contre le vrai éditeur (phase H).
 */
const DEVICES: { deviceType: string; displayName: string; capabilities: string[]; props: string[]; games: string[] }[] = [
  { deviceType: 'player_spawner_device', displayName: 'Apparition de joueur', capabilities: ['player_spawn'], props: ['team', 'enabled'], games: ['*'] },
  { deviceType: 'creature_spawner_device', displayName: 'Générateur de créatures', capabilities: ['enemy_spawn', 'boss_spawn'], props: ['creature_type', 'max_spawned', 'health_multiplier', 'spawn_rate'], games: ['zombie_survival', 'horror'] },
  { deviceType: 'timer_device', displayName: 'Minuteur', capabilities: ['round_timer'], props: ['duration', 'visible'], games: ['*'] },
  { deviceType: 'round_settings_device', displayName: 'Réglages de manche', capabilities: ['round_settings'], props: ['rounds', 'round_end_condition'], games: ['*'] },
  { deviceType: 'elimination_manager_device', displayName: 'Gestionnaire d’éliminations', capabilities: ['elimination_tracking'], props: ['target_type'], games: ['*'] },
  { deviceType: 'score_manager_device', displayName: 'Gestionnaire de score', capabilities: ['score'], props: ['score_per_elimination'], games: ['*'] },
  { deviceType: 'hud_message_device', displayName: 'Message HUD', capabilities: ['hud_message'], props: ['message', 'duration'], games: ['*'] },
  { deviceType: 'item_granter_device', displayName: 'Distributeur d’objets', capabilities: ['weapon_grant'], props: ['item', 'grant_on_spawn'], games: ['*'] },
  { deviceType: 'vending_machine_device', displayName: 'Distributeur automatique', capabilities: ['shop'], props: ['currency', 'items'], games: ['zombie_survival', 'tycoon', 'pvp_arena'] },
  { deviceType: 'end_game_device', displayName: 'Fin de partie', capabilities: ['end_game'], props: ['winning_team'], games: ['*'] },
  { deviceType: 'barrier_device', displayName: 'Barrière', capabilities: ['barrier'], props: ['enabled'], games: ['*'] },
  { deviceType: 'tracker_device', displayName: 'Suivi d’objectif', capabilities: ['objective_tracking'], props: ['target_value'], games: ['*'] },
];

const CORRESPONDANCES: { need: string; deviceType: string; defaults: Prisma.InputJsonValue; description: string }[] = [
  { need: 'player_spawn', deviceType: 'player_spawner_device', defaults: { team: 1 }, description: 'Point d’apparition des joueurs' },
  { need: 'enemy_spawn', deviceType: 'creature_spawner_device', defaults: { creature_type: 'zombie' }, description: 'Apparition des ennemis d’une vague' },
  { need: 'boss_spawn', deviceType: 'creature_spawner_device', defaults: { creature_type: 'brute', max_spawned: 1 }, description: 'Apparition d’un boss' },
  { need: 'round_timer', deviceType: 'timer_device', defaults: {}, description: 'Minuteur de manche' },
  { need: 'round_settings', deviceType: 'round_settings_device', defaults: {}, description: 'Nombre et fin des manches' },
  { need: 'elimination_tracking', deviceType: 'elimination_manager_device', defaults: {}, description: 'Écoute des éliminations' },
  { need: 'score', deviceType: 'score_manager_device', defaults: {}, description: 'Score' },
  { need: 'hud_message', deviceType: 'hud_message_device', defaults: {}, description: 'Messages à l’écran' },
  { need: 'weapon_grant', deviceType: 'item_granter_device', defaults: {}, description: 'Armes de départ' },
  { need: 'shop', deviceType: 'vending_machine_device', defaults: {}, description: 'Boutique' },
  { need: 'end_game', deviceType: 'end_game_device', defaults: {}, description: 'Fin de partie' },
];

const TEMPLATES: { id: string; name: string; genre: Parameters<typeof specGenerique>[0]; pitch: string; env: Parameters<typeof specGenerique>[2]; pitfalls: string[] }[] = [
  { id: 'zombie_survival', name: 'Survie zombie', genre: 'zombie_survival', pitch: 'Des manches de zombies de plus en plus nombreuses, de l’or à chaque élimination, une boutique entre deux vagues.', env: 'hopital', pitfalls: ['Un générateur de créatures sans limite d’apparitions fait chuter les performances dès la manche 6.', 'L’or doit être crédité par l’écoute des éliminations, pas par le score : les deux divergent en coopération.'] },
  { id: 'gun_game', name: 'Gun Game', genre: 'gun_game', pitch: 'Chaque élimination fait passer à l’arme suivante ; la première arme dorée gagne.', env: 'arene', pitfalls: [] },
  { id: 'tycoon', name: 'Tycoon', genre: 'tycoon', pitch: 'Construire, produire, réinvestir.', env: 'entrepot', pitfalls: [] },
  { id: 'racing', name: 'Course', genre: 'racing', pitch: 'Tours chronométrés, points de passage, classement.', env: 'circuit', pitfalls: [] },
  { id: 'horror', name: 'Horreur', genre: 'horror', pitch: 'Exploration, tension, une menace qu’on entend avant de la voir.', env: 'laboratoire', pitfalls: [] },
  { id: 'pvp_arena', name: 'Arène JcJ', genre: 'pvp_arena', pitch: 'Équipes, manches courtes, score à atteindre.', env: 'arene', pitfalls: [] },
  { id: 'deathrun', name: 'Deathrun', genre: 'deathrun', pitch: 'Un parcours piégé, des points de passage, le chrono.', env: 'entrepot', pitfalls: [] },
];

async function main() {
  for (const o of OFFRES) {
    const { maxCreditsPerBuild, features, ...plan } = o;
    await creerSiAbsent(
      `offre ${o.name}`,
      () => db.plan.findUnique({ where: { slug: o.slug } }),
      () =>
        db.plan.create({
          data: {
            ...plan,
            features: features as unknown as Prisma.InputJsonValue,
            budget: { create: { maxCreditsPerBuild } },
          },
        }),
    );
  }

  for (const c of CONFIG) {
    await creerSiAbsent(`réglage ${c.key}`, () => db.pricingConfig.findUnique({ where: { key: c.key } }), () =>
      db.pricingConfig.create({ data: c }),
    );
  }

  for (const e of ENVIRONNEMENTS) {
    await creerSiAbsent(`environnement ${e.name}`, () => db.environmentTemplate.findUnique({ where: { id: e.id } }), () =>
      db.environmentTemplate.create({
        data: {
          id: e.id,
          name: e.name,
          description: e.description,
          layout: {
            zones: e.zones,
            // Ancres en Left-Up-Forward, en centimètres, depuis l'origine de l'île.
            anchors: Object.fromEntries(e.zones.map((z, i) => [z, { left: (i % 3) * 2400 - 2400, up: 0, forward: Math.floor(i / 3) * 2400 }])),
          },
        },
      }),
    );
  }

  for (const d of DEVICES) {
    await creerSiAbsent(`device ${d.deviceType}`, () => db.deviceDefinition.findUnique({ where: { deviceType: d.deviceType } }), () =>
      db.deviceDefinition.create({
        data: {
          deviceType: d.deviceType,
          displayName: d.displayName,
          capabilities: d.capabilities,
          configurableProperties: d.props.map((name) => ({ name })),
          dependencies: [],
          knownConstraints: [],
          supportedGameTypes: d.games,
          verifiedAt: null,
          verifiedBy: null,
        },
      }),
    );
  }

  for (const m of CORRESPONDANCES) {
    await creerSiAbsent(`correspondance ${m.need}`, () => db.deviceMapping.findUnique({ where: { need: m.need } }), () =>
      db.deviceMapping.create({ data: m }),
    );
  }

  for (const [i, t] of TEMPLATES.entries()) {
    const spec =
      t.genre === 'zombie_survival'
        ? specZombie({ gameId: `modele_${t.id}` })
        : specGenerique(t.genre, t.name, t.env);
    const verif = lireGameSpec(spec);
    if (!verif.ok) throw new Error(`Modèle ${t.id} invalide : ${verif.erreurs.join(' ; ')}`);

    await creerSiAbsent(`template ${t.name}`, () => db.gameTemplate.findUnique({ where: { id: t.id } }), () =>
      db.gameTemplate.create({
        data: {
          id: t.id,
          name: t.name,
          genre: t.genre,
          pitch: t.pitch,
          baseSpec: verif.spec as unknown as Prisma.InputJsonValue,
          verseModules: verif.spec.verseModules.map((m) => m.name),
          pitfalls: t.pitfalls,
          // Seule la survie zombie est activée (section 33).
          enabled: t.genre === 'zombie_survival',
          sortOrder: i,
        },
      }),
    );
  }
}

/**
 * Crée ce qui manque, ne modifie rien. Renvoie le nombre d'éléments créés.
 * Appelé au déploiement (script) ET depuis la page de réparation de
 * l'administration : le même code, donc le même résultat.
 */
export async function semer(client: PrismaClient): Promise<number> {
  db = client;
  creesCompteur = 0;
  await main();
  return creesCompteur;
}
