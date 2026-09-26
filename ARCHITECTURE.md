# Nexteo — architecture

**Arrête de chercher des idées. Regarde qui paie déjà pour vendre.**

Base de données de publicités SaaS construite sur l'API officielle Meta Ad Library.
Nexteo mesure un fait observable — depuis combien de temps une entreprise paie pour
diffuser — et n'affiche jamais de montant attribué à une entreprise tierce.

## Ce qui fait la valeur

Les annonces commerciales disparaissent de l'archive Meta environ douze mois après
leur dernière impression. Une requête faite aujourd'hui ne voit que la fenêtre
d'aujourd'hui. Chaque jour sans ingestion est de la donnée perdue définitivement.
L'ingestion quotidienne, démarrée le premier jour, produit un historique qu'un
concurrent mieux financé ne peut pas reconstituer. C'est le seul avantage
défendable du produit, et il ne coûte que de la régularité.

D'où l'ordre de construction : **le pipeline avant l'interface.**

## Arborescence

```
prisma/           schéma, migrations, seed (catégories, poids du signal)
scripts/          tâches hors requête : ingestion, planificateur, déblocage de migration
fixtures/         jeux d'annonces de test, utilisés tant que l'accès Meta n'est pas obtenu
src/
  app/            routes App Router (section « Routes »)
  components/
    ui/           primitives : bouton, carte, champ, badge, tableau, squelette
    signal/       barre de signal et détail du calcul
    annonce/      cartes et fiches d'annonces
    landing/      accueil sombre
  lib/
    signal/       score.ts — fonction pure, testée
    filtres/      lecture et écriture de l'état des filtres dans l'URL
  server/
    db.ts         client Prisma, normalisation de l'URL poolée
    auth.ts       Auth.js v5, sessionOuNull
    source/       AdSource : MetaAdLibrarySource | FixtureSource
    ingestion/    pipeline, normalisation, back-off, reprise au curseur
    stockage/     copie des visuels en stockage objet
```

## Routes

| Route | Territoire | Accès |
|---|---|---|
| `/` | sombre | public |
| `/explore` | clair | public, recherche et liste libres |
| `/annonceur/[slug]` | clair | 3 fiches complètes par mois sans compte, puis floutage |
| `/annonce/[id]` | clair | même quota |
| `/opportunites` | clair | compte requis |
| `/collections` | clair | compte requis |
| `/dashboard` | clair | compte requis |
| `/tarifs` | clair | public |
| `/admin` | clair | rôle administrateur |
| `/api/ingestion` | — | déclenchement du pipeline, protégé par jeton |
| `/api/stripe/webhook` | — | seul octroi d'un accès payant |

Mobile : navigation basse à cinq entrées (Accueil, Explorer, Collections, Tarifs,
Profil), tableaux transformés en cartes empilées, chronologie en défilement
horizontal.

## Entités

`Advertiser` porte le signal et son détail. `Ad` est l'annonce dédupliquée par
`metaAdId`. `AdCreative` référence le visuel copié en stockage objet.
**`AdObservation` est la table qui porte la valeur du produit** : une ligne par
annonce et par exécution, même quand rien n'a changé. On n'écrase jamais, on
empile. Elle est partitionnée par mois et indexée sur `(adId, observedAt)`.

Autour : `Category`, `SignalWeight` (les poids vivent en base, pas dans le code),
`SimilarityEdge`, `Collection` / `SavedItem` / `SavedSearch` / `Watch`,
`IngestJob` (curseur de reprise et journal d'exécution), `RateLimitState`,
et `User` / `Subscription` / `UsageCounter`.

Aucune annonce ingérée n'est jamais supprimée, même quand Meta la retire. On
conserve la dernière version connue avec `lastSeenAt` — ces annonces disparues
sont un argument de vente, pas un déchet.

## Pipeline

`AdSource` est une interface à deux implémentations, choisies par
`AD_SOURCE=fixture|meta`. Tout le produit se développe et se teste sur
`FixtureSource` pendant que la vérification d'identité et la revue d'application
suivent leur cours chez Meta.

Une exécution quotidienne par pays configuré. `ad_reached_countries` est
obligatoire dans chaque requête : il n'existe aucune requête mondiale, l'API
officielle ne couvre hors politique que les annonces diffusées auprès
d'utilisateurs de l'Union européenne (Digital Services Act). Pour chaque pays,
itération sur les termes suivis avec pagination par curseur persistée dans
`IngestJob`, donc reprise exacte après interruption. Chaque annonce est
normalisée, dédupliquée, une `AdObservation` est écrite, les visuels non encore
stockés sont copiés avec somme de contrôle, les annonceurs inconnus sont créés et
marqués pour revue, puis le signal des annonceurs touchés est recalculé.

Back-off exponentiel sur l'erreur 613. Deux échecs consécutifs déclenchent une
alerte : deux jours d'ingestion perdus sont deux jours perdus à jamais.

## Signal Nexteo

Fonction pure dans `src/lib/signal/score.ts`, poids lus en base, testée avec
Vitest. Score de 0 à 100, jamais monétaire, jamais vert.

| Composante | Poids | Mesure |
|---|---|---|
| Persistance | 35 | durée de diffusion de la plus ancienne annonce encore active |
| Continuité | 20 | part des jours sans interruption sur la période observée |
| Volume actif | 15 | nombre d'annonces actives simultanément |
| Rythme de test | 15 | créations distinctes produites sur douze mois |
| Étendue | 10 | pays et plateformes touchés |
| Fraîcheur | 5 | récence de la dernière nouvelle création |

Bandes de lecture : 0-29 test, 30-59 en cours de validation, 60-84 modèle
installé, 85-100 modèle éprouvé. Ces libellés décrivent une activité
publicitaire, jamais une santé financière.

Chaque fiche affiche le détail du calcul. Un score opaque serait indéfendable
puisque c'est le cœur du produit : l'utilisateur doit comprendre en dix secondes
pourquoi un annonceur est à 82 et un autre à 31.

## Interdit, partout

Aucun chiffre d'affaires, MRR, revenu estimé ni montant attribué à une entreprise
tierce — ni calculé, ni estimé, ni déduit, ni en fourchette, ni sous une
formulation détournée type « potentiel de revenu ». Aucune donnée inventée
(`isDemo: true` et identification visuelle). Chaque annonce affichée renvoie vers
son `ad_snapshot_url` officiel. Aucune donnée personnelle d'annonceur : on traite
des pages, pas des personnes.
