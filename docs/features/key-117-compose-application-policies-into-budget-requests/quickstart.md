# Validation guide: application policy toolkit

All behavioral and package commands below are planned and NOT RUN for KEY-117. New `@keynes/policy` commands become runnable only after their implementation tasks. This guide does not authorize implementation, providers or publication.

## Prerequisites

Use the exact feature branch and a clean implementation revision. Node.js >=24, pnpm 11.21.0 and a frozen dependency installation are required. Native tests additionally need Docker and OpenSSL. Use repository-owned disposable PostgreSQL fixtures; no production connections or provider credentials.

```sh
pnpm install --frozen-lockfile
```

The feature directory is `docs/features/key-117-compose-application-policies-into-budget-requests`. Before implementing, run the stock prerequisite check with that directory explicitly selected and read the full task list.

## Provider-free consumer and composition

After the package move and implementation:

```sh
pnpm --filter @keynes/policy typecheck
pnpm --filter @keynes/policy test
```

The first consumer uses synthetic order facts and parameters. It selects a snapshot, previews a decision without a Budget, retains the complete snapshot and sufficient fixture facts in memory, round-trips their canonical JSON, restores against the expected declaration and reevaluates. This small example belongs to KEY-117; a general fixture runner remains KEY-118.

Expected evidence covers:

- Prepared, rejected, review-required, declared error, thrown error and invalid output, with zero submission calls for non-prepared outcomes.
- Exactly one snapshot restoration and one policy call for a valid evaluation, no policy call on malformed configuration or invalid captured input, and no automatic invocation during retry.
- Nonnegative safe integers, empty-map rules, unknown/reserved names, own versus inherited fields, `toString`, accessors, zero/omission, all-zero proposals, duplicate/order-independent minimum ceilings, exact default and explicit reduction.
- Trusted-declaration mismatch and tampered snapshots rejected before customer execution; unchanged KEY-116 parameter/Zod behavior and identities.
- Canonical record stability, defensive capture, redaction, absence of raw errors/implicit input or parameter values, and no false fixture-reproducibility claim for partial records.
- Exact proposal-key types, extra keys from variables rejected, post-reduction quantities widened to number, and distinct Local/Remote allocation result inference.

## Real allocation boundaries

```sh
pnpm exec vitest run packages/policy/test/local-integration.test.ts --config packages/sdk/vitest.config.ts --maxWorkers=1 --passWithNoTests=false
pnpm test:local
pnpm test:ci:postgresql
```

The explicit Vitest command runs the new toolkit Local integration file after T019 wires source resolution. `pnpm test:local` runs the existing Local regression selection; it does not discover the toolkit file. Keep both results in acceptance evidence. The explicit command fails if no tests are selected. Add native integration coverage to the existing PostgreSQL runner.

Prepared requests can be approved or denied independently of evaluation. Native tests exercise exact operation-key replay, changed request/evidence conflict, denial replay after availability returns, a deliberate fresh key using the same retained evaluation, and caller-owned rollback. Retain policy-call counters to prove no reevaluation. Local proves ordinary submission and capability limits, not durable recovery or public keyed replay.

Full shared behavior qualification remains:

```sh
pnpm test:sqlite-postgres -- --output .artifacts/key-117-shared-acceptance
```

The output directory must not already exist; use a fresh explicitly named attempt directory for every rerun. Retain both engine reports, exit status, cleanup and the manifest. Existing native permission, concurrency, TLS and recovery lanes remain intact. A source pass does not qualify installed archives or managed Hosted operation.

## Toolkit archive qualification

Planned new package script:

```sh
pnpm --filter @keynes/policy build
pnpm --filter @keynes/policy test:package -- --output .artifacts/key-117-policy-archive
```

Implement `test:package` to build and pack the toolkit and SDK once, then install those exact archives in fresh external consumers. Its output option resolves from the repository root and must be a new path. Reuse existing testkit package isolation and cleanup helpers.

The core-only consumer checks runtime imports and emitted types without Zod, database drivers or model providers, and runs the snapshot/evaluation roundtrip. A second consumer installs pinned Zod and checks `/zod`, including equivalent accepted/rejected data and restoration of its snapshots through core without Zod. Check root and subpath `.js`/`.d.ts` targets, private import rejection, declared dependency resolution and absence of workspace fallback. Save source revision, Node/pnpm/dependency versions, both archive hashes, commands, process status and cleanup outcome. A failed child or cleanup is not a passing attempt.

Preserve the existing four-archive runtime lane:

```sh
pnpm test:package:split -- --output .artifacts/key-117-runtime-archives
```

This does not qualify the new toolkit by itself. KEY-88 may consume both retained exact-archive records for release qualification; registry publication is a separate action.

## Final feature checks

```sh
pnpm test:pr
pnpm format:docs
```

The final acceptance record must identify the implementation revision and separately list source, Local/native, toolkit archive and existing runtime archive outcomes. All new tasks begin with observed red behavioral checks before green implementation. Do not substitute passing assertion counts for successful processes, and do not relabel older acceptance records as current proof.

## Documentation-only checks

During this planning task, only managed-file integrity, stock prerequisite checks, Markdown formatting, artifact links, task structure and spec/plan/task analysis apply. Behavioral checks, archive qualification and publication remain NOT RUN.
