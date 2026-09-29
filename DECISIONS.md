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
