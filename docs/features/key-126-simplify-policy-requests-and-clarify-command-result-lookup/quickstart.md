# Validation Quickstart

Run from a clean checkout of the KEY-126 candidate revision with Node.js 24, pnpm and Docker available.

## Focused feedback

```sh
pnpm --filter @keynes/database test
pnpm --filter @keynes/sdk test
pnpm --filter @keynes/postgres test
pnpm test:remote
```

Expected: package-root consumers accept `getOperationResult` and `OperationResult`, reject the removed names, and Policy request tests preserve direct and integrated behavior. Native Remote tests cover five lookup outcomes, contention, isolation, authorization, replay and conflict.

## Generated and repository contracts

```sh
pnpm generate:check
pnpm format:docs
pnpm test:pr
pnpm test:sqlite-postgres
```

Expected: generated output matches `schema.json` and `contract.json`; old/new compatibility mismatch tests fail closed; Local and native behavior pass at the candidate revision.

## Package boundaries

```sh
pnpm test:package:split
```

Run any optional Policy package qualification named by the implementation tasks. Record optional, managed and hosted lanes as `NOT RUN` unless executed; historical evidence does not qualify this revision.
