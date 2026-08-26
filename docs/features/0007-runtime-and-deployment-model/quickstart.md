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

## 3. Check repository behavior

```sh
pnpm verify
git diff --check
```

The repository gate checks generated-contract drift, generator behavior, types, package boundaries, and provider-free runtime behavior. It does not build or inspect a package archive.

## 4. Check package qualification

```sh
pnpm test:qualification
```

This lane builds the SDK twice and inspects the packed archive and Apache-2.0 license bytes. It installs the archive outside the workspace and runs the clean consumer. It also validates the measurement controller and worker protocol.

The manual Local Preview workflow owns the supported operating-system and Node.js matrix plus reference measurements.

## 5. Search for stale governing claims

```sh
rg -n "One model, two runtimes|exactly two runtimes|permanent PGlite|only supported durable|Public Cloud access|complete, read-only PostgreSQL" docs/product.md docs/architecture.md docs/roadmap.md .specify/memory/constitution.md .specify/templates docs/adr
```

Review every match in context. Historical statements in completed feature documents are out of scope and must remain unchanged.

## Evidence boundary

These checks prove only that the repository, governing documents, templates, package metadata, and current provider-free test suite agree. The in-memory ledger, PostgreSQL installation, Policy, public remote access, self-hosted packaging, managed Cloud, recovery, security, compatibility qualification, new performance measurements, and production support remain `NOT RUN`.
