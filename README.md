# Nexteo

Tu décris ta map, l'agent la construit dans UEFN : il écrit le Verse, place
les devices, compile, lance le playtest, lit les erreurs et les corrige, en
passant par le MCP officiel d'UEFN (en bêta chez Epic).

**État actuel : simulation.** Aucun UEFN réel n'est branché. Les builds
tournent contre un éditeur simulé, et sans clé Anthropic les plans viennent
d'une IA simulée. Chaque écran l'affiche. Les phases A à D (fondations,
GameSpec, orchestrateur, bout en bout simulé) sont faites ; l'agent Windows et
le vrai MCP viennent ensuite.

Nexteo n'est ni affilié à Epic Games, ni approuvé ou sponsorisé par Epic Games.

## Démarrer

```bash
cp .env.example .env        # puis renseigner les valeurs (voir les commentaires)
npm install
npm run db:preparer         # migrations + référentiels ; refuse une base d'un ancien produit
npm run dev
```

Pour les builds en arrière-plan (facultatif en simulation) : `npm run worker`.

Pour essayer l'agent local sans UEFN : `npx tsx scripts/faux-mcp.ts` (faux éditeur),
puis, depuis la page Connexion UEFN, générer un code et lancer
`npm run agent -- pair CODE --site http://localhost:3000` puis `npm run agent -- run`.

## Vérifier

```bash
npm run typecheck
npm run lint
npm test                    # unitaires + intégration (TEST_DATABASE_URL requis pour l'intégration)
npm run build && npm run test:e2e
```

Les tests de bout en bout tournent contre `next start` et la base de `.env`.
Le paiement Stripe n'y est testé qu'avec une clé `sk_test_…`.

## Documents

- `ARCHITECTURE.md` : comment les pièces s'assemblent.
- `DECISIONS.md` : les choix faits et pourquoi.

## Anciennes versions

L'historique Git garde tout : la base de publicités (commit `2b1455d`) et la
première version (branche `v1`).
