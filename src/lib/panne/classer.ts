/**
 * Classement des pannes serveur.
 *
 * Next masque le message d'une erreur en production et ne laisse qu'un
 * identifiant, qui ne se lit que dans les journaux de l'hébergeur. Quelqu'un
 * qui n'a pas accès à ces journaux se retrouve devant un mur.
 *
 * On classe donc l'erreur nous-mêmes, en un code court et sans danger, qui
 * voyage jusqu'à l'écran et se traduit en une phrase compréhensible.
 */
export type CodePanne = string;

export function classer(error: unknown): CodePanne {
  if (typeof error === 'object' && error !== null) {
    const objet = error as { code?: unknown; name?: unknown };
    if (typeof objet.code === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,19}$/.test(objet.code)) {
      return objet.code.toUpperCase();
    }
    if (typeof objet.name === 'string' && objet.name.length > 0) {
      return objet.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase();
    }
  }
  return 'INCONNU';
}

/** Ce que le code veut dire, dit à quelqu'un qui ne code pas. */
export const EXPLICATIONS: Record<string, { quoi: string; suite: string }> = {
  P1001: {
    quoi: 'Le site n’arrive pas à joindre sa base de données.',
    suite: 'La variable DATABASE_URL est absente ou pointe au mauvais endroit dans les réglages de l’hébergeur.',
  },
  P1002: {
    quoi: 'La base de données a mis trop de temps à répondre.',
    suite: 'Souvent passager. Si ça dure, la base est en veille ou surchargée.',
  },
  P1017: {
    quoi: 'La base a fermé la connexion en cours de route.',
    suite: 'Typique d’une adresse « poolée » utilisée sans le réglage qui va avec.',
  },
  P2021: {
    quoi: 'Une table manque dans la base.',
    suite: 'La migration ne s’est pas appliquée. Relance un déploiement et regarde le journal de build.',
  },
  P2022: {
    quoi: 'Une colonne manque dans la base.',
    suite: 'La migration ne s’est pas appliquée entièrement.',
  },
  P2002: {
    quoi: 'Une donnée qui doit être unique existe déjà.',
    suite: 'Deux enregistrements se sont marchés dessus.',
  },
  P2003: {
    quoi: 'Une donnée liée est introuvable.',
    suite: 'Le contenu du site n’a probablement pas été semé.',
  },
  COOKIE: {
    quoi: 'Le site n’a pas pu déposer le cookie qui garde tes réponses.',
    suite: 'Le navigateur les refuse, ou le site n’est pas servi en HTTPS.',
  },
  PRISMACLIENTINITIALIZATIONERROR: {
    quoi: 'Le site n’arrive pas à ouvrir sa base de données.',
    suite: 'Adresse de connexion absente, mal formée, ou base injoignable depuis le serveur.',
  },
  PRISMACLIENTKNOWNREQUESTERROR: {
    quoi: 'La base a refusé l’enregistrement.',
    suite: 'Le détail est dans le code affiché au-dessus.',
  },
  PRISMACLIENTVALIDATIONERROR: {
    quoi: 'Le code a envoyé à la base quelque chose qu’elle n’attendait pas.',
    suite: 'Le programme et la base ne sont pas de la même version.',
  },
  INCONNU: {
    quoi: 'Une erreur qu’on n’a pas su classer.',
    suite: 'Le détail est dans le rapport ci-dessous.',
  },
};

export function expliquer(code: string): { quoi: string; suite: string } {
  return EXPLICATIONS[code] ?? EXPLICATIONS.INCONNU!;
}
