# Décisions

Arbitrages pris en construisant, avec leur raison. Le plus récent en bas.

1. **Nom : Nexteo.** Il ne contient pas la marque d'Epic (règle 1.2). Une
   mention d'absence d'affiliation figure en pied de chaque page.
2. **Logo : un N original**, condensé, penché, biseauté, en dégradé. Refaire le
   logo de Fortnite avec une autre lettre a été écarté : c'est l'imitation
   d'une identité protégée, sur un produit payant qui parle de ce jeu vidéo.
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
   rien apporter. Le LLM sert au plan de map, au Verse, à l'analyse et aux
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
30. **« Map » remplace « jeu » dans tout le texte affiché.** C'est le mot que
    les créateurs UEFN emploient, et « jeu » prêtait à confusion avec Fortnite
    lui-même. Les identifiants du code (`GameSpec`, `gameId`, `monthlyGamePlans`)
    ne changent pas : les renommer aurait exigé une migration sans rien
    apporter à l'utilisateur. Le seed ne réécrit jamais une base existante ;
    une base déjà semée garde l'ancien vocabulaire dans les offres et le
    barème jusqu'à mise à jour manuelle (une base neuve n'est pas concernée).
31. **Répétition de mise en production faite en local, sur une base vierge**
    (build réel, `next start` en NODE_ENV=production). Elle a révélé trois
    manques, corrigés : (a) aucun en-tête de sécurité — ajoutés dans
    `next.config.ts`, sans CSP stricte (Next injecte des scripts en ligne) ;
    (b) sans `AUTH_SECRET`, l'inscription créait un compte puis échouait en
    silence à la connexion — elle refuse maintenant avant de créer quoi que
    ce soit ; (c) rien dans le journal de build ne signalait une variable
    manquante — `preparer-base.ts` les liste, sans jamais faire échouer le
    build. L'hôte de `AUTH_URL` est ajouté aux origines des Server Actions.
32. **Flux SSE limité à 60 s (`maxDuration`), refermé à 50 s.** Une valeur
    supérieure à la limite du plan Vercel fait refuser le DÉPLOIEMENT, et ne
    se voit pas en local. La reconnexion automatique (`retry` + `Last-Event-ID`)
    rend la coupure invisible : aucune ligne perdue ni rejouée.
33. **Agent local : un programme Node, pas Tauri (écart assumé avec la phase E).**
    Un agent Tauri demande la chaîne Rust et un Windows pour être testé ; le
    programme Node se teste ici, sur Linux, contre un faux serveur MCP, et
    parle exactement le même protocole. Il se lance aujourd'hui par
    `npm run agent` (Node requis). Un exécutable Windows autonome, et
    l'interface de détection d'UEFN, viendront une fois le fournisseur réel
    validé — l'écart est sur l'enveloppe, pas sur le protocole.
34. **Le site et l'agent communiquent par long-poll initié par l'agent, pas
    par WebSocket.** Le site tourne sur des fonctions sans serveur, qui ne
    gardent aucune connexion ouverte ; un PC domestique n'accepte aucune
    connexion entrante. L'agent demande ses ordres (25 s d'attente au plus,
    sous la limite de 60 s de Vercel) et poste les résultats. Appairage par
    code à usage unique (8 caractères, 10 min), jeton propre à la machine ;
    seules les empreintes SHA-256 sont stockées. Limite connue : pas de
    limitation de débit sur `/api/agent/pair` — le code fait ~40 bits et
    expire en 10 minutes, ce qui rend l'énumération irréaliste, mais une
    limite par adresse IP reste à ajouter avant l'ouverture publique.
35. **L'agent est un tuyau, le site porte toute la connaissance des outils.**
    L'agent ne relaie que trois opérations (`mcp.ping`, `mcp.listTools`,
    `mcp.callTool`), et ne parle qu'à une adresse locale (127.0.0.1,
    localhost, ::1, http). Aucun nom d'outil n'y est écrit : quand le MCP
    d'UEFN change — il est en bêta — on modifie le site, pas le PC de chaque
    utilisateur. Le MCP officiel écoute sur `http://127.0.0.1:8000/mcp` et
    expose 384 outils derrière une passerelle de 3 outils (source : résumé
    de recherche, la documentation d'Epic est bloquée depuis
    l'environnement de développement — À VÉRIFIER). Les noms de ces trois
    outils sont inconnus : le fournisseur MCP réel (phase F) n'est donc PAS
    écrit. La découverte (`tools/list`, conservée dans `LocalAgent.catalogue`
    et affichée dans /connexion-uefn) est là pour les relever sur un vrai
    UEFN au lieu de les deviner. `modeUefn()` reste `mock` : un agent
    connecté ne rend pas un build réel, et l'écran le dit.
36. **Le diagnostic n'affiche que ce que l'agent a mesuré.** UEFN installé,
    Fortnite, Python Editor Scripting, MCP Toolsets, projet : l'agent ne les
    mesure pas encore, la page affiche « non vérifié par l'agent » et jamais
    « absent ». Seul l'état du MCP (joignable ou non, adresse, nombre
    d'outils) est mesuré. Une croix rouge pour une chose non mesurée
    enverrait l'utilisateur corriger un réglage qui n'est peut-être pas cassé.
37. **Site public : aperçu de partage, robots, sitemap, 404 et erreurs.**
    `AUTH_URL` mal saisie faisait tomber TOUTES les pages (`new URL()` au
    chargement du layout) : `urlPublique()` essaie chaque candidat et retombe
    sur le domaine de la marque. `robots.txt` exclut tout ce qui demande un
    compte ; le sitemap ne liste que les pages publiques. Les pages 404 et
    d'erreur n'appellent ni la base ni la session, pour rester affichables
    quand elles sont en panne ; l'erreur n'expose qu'une référence (`digest`).
    L'image d'aperçu utilise les polices système, sans requête vers un tiers.
38. **Déploiement insensible aux réglages hérités, et diagnostic sans journaux.**
    Le projet Vercel existait pour un ancien produit : un réglage de
    tableau de bord (commande de build, dossier de sortie, version de Node,
    variables réservées à la production) pouvait faire échouer un déploiement
    sans que le code y soit pour rien. `vercel.json` fixe donc le framework,
    l'installation (`--include=dev`), le build et le dossier de sortie, et
    `engines` fixe Node 22 : ces valeurs l'emportent sur le tableau de bord.
    Un build propre (copie du dépôt sans `.env` ni `node_modules`, base
    vierge, variables Stripe de production factices) passe : le code n'est
    pas en cause quand un déploiement rougit. `/api/sante` dit en clair, sans
    ouvrir les journaux, si la base répond ; connecté en administrateur, il
    dit aussi quelles variables sont présentes (jamais leur valeur) et, avec
    `?stripe=1`, si les prix existent dans le mode courant de Stripe — le
    mélange test / réel est la panne de paiement la plus fréquente.
39. **Une erreur de paiement s'affiche, elle ne fait jamais tomber la page.**
    Constaté en production : après l'inscription avec une offre choisie, et à
    chaque clic sur « Choisir », tout échec de Stripe (prix inexistant dans le
    mode courant, clé refusée, TVA non configurée, Stripe injoignable) levait
    une exception et la page affichait « Quelque chose s'est mal passé ».
    Les trois actions (`choisirOffre`, `recharger`, `ouvrirPortail`) rendent
    maintenant un message ; seules les redirections traversent la protection.
    Le visiteur lit un texte neutre ; l'administrateur lit la cause probable
    et le lien `/api/sante?stripe=1`. Même protection sur la modification d'un
    prix en administration : si Stripe refuse, rien n'est enregistré, pour que
    les prix du site ne diffèrent jamais de ceux que Stripe facture.
    Garde-fou ajouté : aucun paiement ne démarre sans `STRIPE_WEBHOOK_SECRET`.
    Sans lui Stripe encaisse, mais le site ne reçoit jamais l'événement qui
    verse les crédits — le client paierait sans rien recevoir.
