# Architecture — Nexteo

Nexteo transforme une idée de map en projet UEFN construit, compilé et testé.
Règle unique : **le LLM propose, les outils exécutent, les vérifications
confirment.** Jamais « générer puis supposer ».

## Chaîne d'exécution

```
Navigateur ──► Next.js (pages, Server Actions, SSE) ──► PostgreSQL
                                   │
                         Orchestrateur (worker)       ← toutes les décisions
                                   │  UEFNProvider
                 ┌─────────────────┴─────────────────┐
         MockUEFNProvider                     UEFNMCPProvider (phase F)
     (simulateur déterministe)          WebSocket ► agent local Windows
                                                     ► MCP UEFN 127.0.0.1:8000/mcp
```

## Arborescence

```
prisma/            schéma, migrations, semis (offres, budgets, templates, devices)
scripts/           preparer-base (avant build, ne fait jamais échouer), worker
src/config/        brand.ts — le nom du produit, en un seul endroit
src/lib/           logique pure et testée
  uefn/            provider.ts (interface), coordinates.ts (seule conversion XYZ↔LUF), mock/
  gamespec/        schema.ts (Zod versionné), templates
  palier/          calcul du palier de rareté depuis les faits
  verse/           parseur d'erreurs de compilation + corpus
  tests/           génération des TestSpec depuis le GameSpec, évaluation sur les logs
  ai/              AIProvider, AnthropicProvider, IA simulée, tarifs
src/server/        accès base, auth, orchestrateur (plan, boucle, exécuteurs), actions
src/app/           routes
src/components/    interface
```

## Routes

| Route | Rôle |
|---|---|
| `/` | accueil public, prérequis techniques en haut |
| `/tarifs` | offres lues en base |
| `/connexion`, `/inscription` | comptes |
| `/dashboard` | projets, palier de chacun |
| `/creer` | idée → plan de map éditable → lancement |
| `/projet/[id]` | aperçu, GameSpec, Verse, devices, entités, tests, erreurs, versions, pré-publication |
| `/projet/[id]/build/[sessionId]` | console temps réel |
| `/connexion-uefn` | les prérequis, chacun avec son état et sa correction |
| `/admin` | coût IA moyen par build, taux d'intervention humaine |
| `/api/builds/[sessionId]/events` | flux SSE de la console (reprise par `Last-Event-ID`) |

## Entités

L'**intention** (`Project`, `GameSpec` versionné, `BuildPlan`, `BuildTask`), l'**état
observé** (`VerseFile`, `DeviceInstance`, `SceneEntity` — un reflet de la dernière
inspection, jamais la vérité) et la **trace** (`AgentEvent`, `UsageEvent`,
`BuildError`, `TestRun`/`TestResult`, `PrePublishCheck`). Les référentiels
(`GameTemplate`, `EnvironmentTemplate`, `DeviceDefinition`, `DeviceMapping`,
`PlanOffer`, `BuildBudget`) sont des données éditables : aucun déploiement pour
ajouter un template ou changer un prix.

## Orchestrateur

1. Le GameSpec validé devient un `BuildPlan` : des tâches atomiques à clé stable,
   avec leurs dépendances. Construction **déterministe**, sans LLM.
2. Une `AgentSession` est prise par un seul exécutant grâce à un bail sur le
   projet (et un index unique partiel en base : une génération active par projet).
3. Chaque pas : relire l'état réel → choisir la prochaine tâche dont les
   dépendances sont faites → exécuter → **relire pour vérifier** → sur échec,
   analyser, corriger, recompiler, retester. Les tâches de correction sont
   insérées dans le graphe.
4. Avant chaque pas : budgets (pas, reprises, minutes, jetons, coût). À la
   limite : arrêt propre, état conservé, rapport.
5. Les commandes humaines (Pause, Stop, Continuer, Réessayer) s'appliquent
   **entre** deux tâches, jamais au milieu d'une écriture.
6. Chaque événement devient un `AgentEvent`, lu par la console en SSE.

## Coordonnées

Le MCP parle XYZ, UEFN raisonne en Left-Up-Forward. `src/lib/uefn/coordinates.ts`
est **le seul fichier autorisé à convertir**. Les types `XYZVector` et
`LUFVector` sont marqués : TypeScript refuse de passer l'un pour l'autre. Le
reste du code ne manipule que du LUF.


## Protocole de l'agent local (phase E)

Remplace le WebSocket d'abord prévu : le site tourne sans serveur et ne peut pas en tenir un (DECISIONS n° 34).

```
Navigateur ──► Site (Vercel) ◄──── long-poll HTTPS ──── Agent (PC de l'utilisateur) ──► MCP d'UEFN (127.0.0.1)
                  │                                          ▲
              AgentCommand (file en base)              relais de 3 opérations
```

- `src/server/agent/canal.ts` : appairage, authentification, file d'ordres
  (`envoyerOrdre` attend le résultat, `prendreOrdres` est le long-poll,
  `enregistrerResultat` rend la réponse). Les pannes de la plateforme
  (agent muet, éditeur fermé, outil trop lent) sortent en `PanneEditeur`,
  comme pour le simulateur : l'orchestrateur les rejoue et rembourse.
- `src/app/api/agent/{pair,heartbeat,poll,result}` : les quatre routes. Seule
  `pair` est ouverte sans jeton.
- `src/agent/` : l'agent. `mcp.ts` (client MCP Streamable HTTP, JSON et SSE,
  pagination, session perdue), `agent.ts` (boucle, liste blanche de trois
  opérations), `cli.ts` (`pair`, `run`, `test`, `unpair`), `config.ts`.
- `scripts/faux-mcp.ts` : faux serveur MCP pour développer sans UEFN. Ses
  noms d'outils sont inventés.
- Tests : `src/agent/agent.test.ts` (24 tests, vraie base, vraies routes,
  faux MCP), dont les garde-fous vérifiés par mutation.
