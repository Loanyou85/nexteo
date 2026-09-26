import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Génère le jeu d'annonces de test (section 8.3).
 *
 * Trois règles.
 *
 * Les annonceurs sont FICTIFS. Fabriquer des annonces et les attribuer à des
 * entreprises réelles produirait du contenu inventé au nom de tiers — ce que
 * le garde-fou n° 2 interdit, et qui serait indéfendable.
 *
 * Les dates sont stockées en décalage de jours, pas en dates absolues. Un
 * fichier de fixtures figé vieillit et finit par ne décrire que des campagnes
 * arrêtées depuis longtemps, ce qui ne teste plus rien.
 *
 * La génération est déterministe : même graine, même fichier, diff lisible.
 */

/** Générateur pseudo-aléatoire à graine, pour un fichier reproductible. */
function tirage(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const alea = tirage(20260926);
const entre = (min: number, max: number) => min + Math.floor(alea() * (max - min + 1));
const parmi = <T>(xs: readonly T[]): T => xs[Math.floor(alea() * xs.length)];
const echantillon = <T>(xs: readonly T[], n: number): T[] =>
  [...xs].sort(() => alea() - 0.5).slice(0, Math.max(1, n));

const PLATEFORMES = ['facebook', 'instagram', 'messenger', 'audience_network'] as const;
const PAYS_UE = ['FR', 'BE', 'ES', 'IT', 'DE', 'NL', 'PT', 'IE', 'AT', 'PL'] as const;

type Profil = {
  page: string;
  nom: string;
  domaine: string;
  /** Depuis combien de jours l'annonceur diffuse. */
  anciennete: number;
  /** Nombre d'annonces produites sur la période. */
  annonces: number;
  /** Part des annonces déjà arrêtées. */
  partArretees: number;
  pays: number;
  plateformes: number;
  accroches: string[];
  titres: string[];
};

/**
 * Douze profils couvrant le spectre que le signal doit savoir distinguer : du
 * modèle éprouvé qui diffuse depuis plus d'un an au test démarré la semaine
 * dernière, en passant par celui qui a tout arrêté.
 */
const PROFILS: Profil[] = [
  { page: '100000000000001', nom: 'Facturio', domaine: 'facturio.fr',
    anciennete: 430, annonces: 34, partArretees: 0.35, pays: 6, plateformes: 4,
    accroches: [
      'Vos devis signés en ligne, vos factures envoyées toutes seules.',
      'Arrêtez de relancer vos clients à la main.',
      'La facturation se termine pendant que vous êtes sur le chantier.',
      'Relances automatiques, paiement en un clic.',
    ],
    titres: ['Essai 14 jours', 'Devis et factures', 'Sans engagement'] },

  { page: '100000000000002', nom: 'Boutik Studio', domaine: 'boutikstudio.com',
    anciennete: 465, annonces: 41, partArretees: 0.4, pays: 8, plateformes: 4,
    accroches: [
      'Ouvrez votre boutique ce week-end.',
      'Vendez vos créations sans savoir coder.',
      'Une boutique en ligne prête en 20 minutes.',
    ],
    titres: ['Créer ma boutique', 'Gratuit 30 jours', 'Sans commission'] },

  { page: '100000000000003', nom: 'Caissea', domaine: 'caissea.fr',
    anciennete: 395, annonces: 28, partArretees: 0.3, pays: 3, plateformes: 3,
    accroches: [
      'La caisse qui tient sur une tablette.',
      'Encaissez, suivez vos stocks, fermez la journée en deux minutes.',
      'Conforme, simple, sans abonnement matériel.',
    ],
    titres: ['Voir la démo', 'Tester gratuitement'] },

  { page: '100000000000004', nom: 'Mailwave', domaine: 'mailwave.io',
    anciennete: 360, annonces: 47, partArretees: 0.45, pays: 10, plateformes: 4,
    accroches: [
      'Vos e-mails partent au bon moment, tout seuls.',
      "L'emailing sans usine à gaz.",
      'Écrivez une fois, envoyez toute l’année.',
    ],
    titres: ['Essayer', 'Voir les modèles', 'Plan gratuit'] },

  { page: '100000000000005', nom: 'Supportly', domaine: 'supportly.eu',
    anciennete: 330, annonces: 22, partArretees: 0.25, pays: 5, plateformes: 3,
    accroches: [
      'Toutes vos conversations clients au même endroit.',
      'Répondez en 2 minutes, pas en 2 jours.',
    ],
    titres: ['Démarrer', 'Voir les tarifs'] },

  { page: '100000000000006', nom: 'Planifly', domaine: 'planifly.fr',
    anciennete: 275, annonces: 19, partArretees: 0.5, pays: 4, plateformes: 3,
    accroches: [
      'Le planning de votre équipe, fini en dix minutes.',
      'Plus personne ne rate son service.',
      'Les remplacements se règlent entre eux.',
    ],
    titres: ['Essai gratuit', 'Voir un exemple'] },

  { page: '100000000000007', nom: 'Stockpilot', domaine: 'stockpilot.io',
    anciennete: 240, annonces: 16, partArretees: 1, pays: 4, plateformes: 2,
    accroches: ['Ne tombez plus jamais en rupture.', 'Vos stocks à jour sans inventaire.'],
    titres: ['Découvrir', 'Réserver une démo'] },

  { page: '100000000000008', nom: 'Kinelio', domaine: 'kinelio.fr',
    anciennete: 190, annonces: 14, partArretees: 0.3, pays: 2, plateformes: 3,
    accroches: [
      'Vos patients prennent rendez-vous sans vous appeler.',
      'Agenda plein, téléphone silencieux.',
    ],
    titres: ['Essayer 1 mois', 'Voir la démo'] },

  { page: '100000000000009', nom: 'Devisio', domaine: 'devisio.fr',
    anciennete: 130, annonces: 11, partArretees: 0.2, pays: 2, plateformes: 2,
    accroches: ['Le devis part avant que vous soyez rentré.', 'Chiffrez sur place, signez sur place.'],
    titres: ['Tester', 'En savoir plus'] },

  { page: '100000000000010', nom: 'Notaria', domaine: 'notaria.legal',
    anciennete: 95, annonces: 8, partArretees: 0.25, pays: 3, plateformes: 2,
    accroches: ['Vos contrats relus par une IA, validés par un juriste.', 'Signez sans imprimer.'],
    titres: ['Commencer', 'Voir un contrat type'] },

  { page: '100000000000011', nom: 'Recrutio', domaine: 'recrutio.com',
    anciennete: 58, annonces: 7, partArretees: 0.15, pays: 3, plateformes: 3,
    accroches: ['Publiez une offre, recevez des candidats triés.', 'Le recrutement sans tableur.'],
    titres: ['Publier une offre', 'Essai gratuit'] },

  { page: '100000000000012', nom: 'Dataclair', domaine: 'dataclair.eu',
    anciennete: 21, annonces: 4, partArretees: 0, pays: 2, plateformes: 2,
    accroches: ['Vos chiffres, enfin lisibles.', 'Un tableau de bord monté en une soirée.'],
    titres: ['Connecter mes données', 'Voir la démo'] },
];

type AnnonceFixture = {
  id: string;
  page_id: string;
  page_name: string;
  ad_creative_bodies: string[];
  ad_creative_link_titles: string[];
  ad_creative_link_descriptions: string[];
  ad_creative_link_captions: string[];
  ad_snapshot_url: string;
  publisher_platforms: string[];
  languages: string[];
  ad_reached_countries: string[];
  /** Décalage en jours par rapport à aujourd'hui. Matérialisé à la lecture. */
  _joursDebut: number;
  /** `null` = annonce encore active. */
  _joursFin: number | null;
};

const annonces: AnnonceFixture[] = [];
let compteur = 0;

for (const p of PROFILS) {
  const pays = echantillon(PAYS_UE, p.pays);
  const plateformes = echantillon(PLATEFORMES, p.plateformes);

  for (let i = 0; i < p.annonces; i++) {
    // Les annonces se répartissent sur toute l'ancienneté de l'annonceur.
    const debut = Math.round(p.anciennete * (1 - i / Math.max(1, p.annonces)));
    const arretee = alea() < p.partArretees;
    const duree = entre(14, 150);
    const fin = arretee ? Math.max(0, debut - duree) : null;

    compteur += 1;
    const ref = `fx-${String(compteur).padStart(5, '0')}`;
    annonces.push({
      id: ref,
      page_id: p.page,
      page_name: p.nom,
      ad_creative_bodies: [parmi(p.accroches)],
      ad_creative_link_titles: [parmi(p.titres)],
      ad_creative_link_descriptions: [`${p.nom} — ${parmi(p.accroches)}`],
      ad_creative_link_captions: [p.domaine],
      // L'instantané porte un identifiant de test : le lien ne résout pas, et
      // c'est voulu — aucune fixture ne doit passer pour une annonce réelle.
      ad_snapshot_url: `https://www.facebook.com/ads/library/?id=${ref}`,
      publisher_platforms: echantillon(plateformes, entre(1, plateformes.length)),
      languages: ['fr'],
      ad_reached_countries: echantillon(pays, entre(1, pays.length)),
      _joursDebut: debut,
      _joursFin: fin,
    });
  }
}

const fichier = {
  avertissement:
    'JEU DE DÉMONSTRATION. Annonceurs et annonces entièrement fictifs, produits ' +
    'pour développer et tester le pipeline tant que l’accès à l’API Meta Ad ' +
    'Library n’est pas ouvert. Tout ce qui est ingéré depuis cette source est ' +
    'marqué isDemo et signalé visuellement. Aucune de ces annonces n’existe.',
  genereLe: new Date().toISOString().slice(0, 10),
  annonceurs: PROFILS.length,
  annonces,
};

mkdirSync(join(process.cwd(), 'fixtures'), { recursive: true });
writeFileSync(
  join(process.cwd(), 'fixtures', 'annonces.json'),
  JSON.stringify(fichier, null, 2) + '\n',
  'utf8',
);
console.log(`Fixtures : ${PROFILS.length} annonceurs, ${annonces.length} annonces.`);
