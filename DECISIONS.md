# Décisions

Arbitrages pris en construisant, avec leur raison. Le plus récent en bas.

1. **Nom : Nexteo.** Il ne contient pas la marque d'Epic (règle 1.2). Une
   mention d'absence d'affiliation figure en pied de chaque page.
2. **Logo : un N original**, condensé, penché, biseauté, en dégradé. Refaire le
   logo de Fortnite avec une autre lettre a été écarté : c'est l'imitation
   d'une identité protégée, sur un produit payant qui parle de ce jeu.
3. **Polices auto-hébergées** (Fontsource) plutôt que chargées chez Google :
   aucune adresse IP de visiteur transmise à un tiers.
4. **Barre du haut plutôt que latérale** : la console a trois zones côte à côte,
   chaque pixel de largeur va aux logs.
5. **`BuildError` et non `Error`** : une table `Error` génère un type Prisma qui
   masque l'`Error` native de JavaScript.
6. **`SimulationState`** (hors section 24) : l'éditeur simulé est persisté en
   base, sinon la reprise après interruption ne serait pas testable.
7. **Curseur de la console : `AgentEvent.seq`** (BigInt auto-incrémenté), en plus
   de l'index `(sessionId, createdAt)` demandé : deux événements peuvent partager
   la même milliseconde, pas le même `seq`.
8. **Une génération active par projet, garantie en base** par un index unique
   partiel, en plus du bail applicatif.
9. **Le BuildPlan est construit sans LLM.** Transformer un GameSpec validé en
   graphe de tâches est déterministe ; payer un modèle pour ça coûterait sans
   rien apporter. Le LLM sert au plan de jeu, au Verse, à l'analyse et aux
   correctifs.
10. **Worker dédié, plus un pilotage depuis la console pour le simulé.** Vercel
    n'héberge pas de processus permanent. Pour qu'une génération simulée
    avance quand même sur Vercel, le flux SSE fait avancer la session tant
    qu'un spectateur la regarde, sous le même bail. Les générations réelles
    exigeront le worker : c'est lui qui tiendra le WebSocket de l'agent local.
11. **Modèle : `claude-opus-5-5`**, avec le repli serveur par défaut en cas de
    refus. Les appels passent par `AIProvider` ; changer de modèle est une ligne.
12. **Un seul template activé : Survie zombie.** Les six autres existent en
    données, désactivés, jusqu'à ce que le scénario de référence passe dix fois
    d'affilée (section 33).
13. **L'éditeur simulé vérifie vraiment un peu de Verse** (identifiants
    inconnus, `using` manquant, parenthèses) au lieu de rejouer des échecs
    scénarisés. Les pannes d'éditeur (gel, délai, succès sans effet) sont tirées
    d'une graine déterministe par projet.
14. **Correspondance XYZ → LUF : hypothèse à confirmer.** L'adaptateur suppose
    Left = −Y, Up = Z, Forward = X (repère Unreal : X avant, Y droite, Z haut).
    Les tests vérifient la cohérence interne (aller-retour, rotations,
    imbrication) ; la table de correspondance elle-même devra être confrontée
    au vrai MCP en phase F avant toute promesse (garde-fou n° 2).
15. **Corpus d'erreurs Verse reconstitué** à partir du format documenté
    (`fichier(l,c, l,c): Script error NNNN: …`). Il devra être remplacé par des
    erreurs réelles collectées dès les premiers builds contre le vrai MCP.
16. **Niveaux d'autorisation** : 1 lecture, 2 Verse, 3 devices et entités,
    4 tests — l'agent PROPOSE ses correctifs et attend un accord —, 5 l'agent
    applique ses correctifs seul jusqu'au palier Prêt. Niveau 4 par défaut ;
    le 5 exige une confirmation datée par projet (contrainte en base).
17. **Le cahier des offres remplace les prix du cahier principal** (39 / 99 / 249 €
    au lieu de 29 / 79 / 199 €), avec des crédits calibrés sur le coût réel.
18. **Recharge à la quantité libre, au crédit de l'offre de l'abonné majoré de
    10 %** (demande du 29 septembre) : 1,72 € en Créateur, 1,45 € en Pro,
    1,37 € en Studio. Le pack fixe de 20 crédits à 35 € est retiré : à 1,75 €
    le crédit, il était plus cher que la quantité libre pour toutes les offres,
    donc dominé. Restent des raccourcis de quantité (10, 20, 50), en base. Le
    total d'une recharge est calculé en une fois, pas prix unitaire arrondi ×
    quantité. `TopUpPack` n'existe plus ; majoration et bornes sont des
    réglages (`TOPUP_*`).
19. **Coût IA en millionièmes d'euro** (`costEurMicros`) et non en centimes : un
    appel coûte souvent moins d'un centime, et en centimes entiers la somme
    serait fausse. Tous les autres montants restent en centimes entiers.
20. **Registre de crédits en ajout seul, imposé par un déclencheur** en base.
    Seule exception : la suppression d'un compte (RGPD), déclarée dans sa
    transaction par `SET LOCAL nexteo.suppression_compte = 'on'`.
21. **Remise annuelle plafonnée à 20 % par une contrainte en base**, en plus de
    la validation d'administration qui lit `MAX_ANNUAL_DISCOUNT`.
22. **En simulation, l'offre Découverte peut construire si un administrateur
    lui a crédité un solde.** Aucun appel payant n'est fait contre le
    simulateur. Contre le vrai éditeur, seules les offres payantes construisent.
23. **Le semis crée ce qui manque et ne modifie jamais l'existant** : il tourne
    à chaque déploiement, et un prix changé en administration ne doit pas être
    écrasé.
24. **Une mise à jour ne régénère que les modules dont les données ont
    changé** (empreinte par module). Un fichier modifié à la main dans UEFN
    depuis la dernière génération est conservé tel quel.
25. **Tâches orphelines** : un exécutant qui prend le bail remet en file les
    tâches restées « en cours » (exécutant mort en plein travail). Sans risque,
    parce que chaque exécutant vérifie l'existence avant de créer.
26. **Base de test sans remise à zéro** : Prisma refuse `migrate reset` lancé
    par un agent, à juste titre. Les tests d'intégration appliquent les
    migrations (`migrate deploy`) et créent leurs propres données, isolées par
    des identifiants uniques.
27. **Anton à 18 px pour les libellés du basculeur mensuel / annuel.** La
    charte réserve Anton aux titres, à 20 px au moins. Exception assumée : à
    20 px, « Mensuel · Annuel · 2 mois offerts » passe sur deux lignes à 390 px
    de large et le curseur se décale ; à 18 px la ligne tient, et le texte
    reste en capitales grasses, donc lisible.
28. **Console : zone de logs de hauteur fixe sur ordinateur.** Elle suit la
    dernière ligne tant que l'utilisateur n'a pas remonté le fil. Sans hauteur
    fixe, la zone grandissait avec le build et les nouveaux événements
    tombaient sous la ligne de flottaison.
29. **Les liens entre connexion et inscription gardent `suite`**, pour qu'une
    personne qui a choisi une offre avant d'avoir un compte ne la perde pas en
    changeant de formulaire. La redirection refuse `//hote` et `/\hote`.
