# Quickstart: Validate the runtime and deployment model feature

Run these commands from the repository root after every task is complete.

## 1. Confirm the active feature

```sh
pnpm check:feature-identity
.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
```

Both commands must select `FEAT-0007` at `docs/features/0007-runtime-and-deployment-model/`.

## 2. Check formatting

```sh
pnpm exec oxfmt --check docs/product.md docs/architecture.md docs/roadmap.md docs/adr .specify/memory/constitution.md .specify/templates package.json packages/sdk/package.json packages/cloud/package.json
```

## 3. Check repository behavior and packed license evidence

```sh
pnpm verify
git diff --check
```

The repository gate must include the updated SDK package-qualification assertion for Apache-2.0. It does not prove a future runtime or deployment.

## 4. Search for stale governing claims

```sh
rg -n "One model, two runtimes|exactly two runtimes|permanent PGlite|only supported durable|Public Cloud access|complete, read-only PostgreSQL" docs/product.md docs/architecture.md docs/roadmap.md .specify/memory/constitution.md .specify/templates docs/adr
```

Review every match in context. Historical statements in completed feature documents are out of scope and must remain unchanged.

## Evidence boundary

These checks prove only that the repository, governing documents, templates, package metadata, and current provider-free test suite agree. The in-memory ledger, PostgreSQL installation, Policy, public remote access, self-hosted packaging, managed Cloud, recovery, security, compatibility qualification, new performance measurements, and production support remain `NOT RUN`.
