# Quickstart: Validate the runtime and deployment model feature

Run the focused commands during implementation. Run the full sequence from the repository root before feature acceptance.

## 1. Confirm the active feature

```sh
pnpm check:feature-identity
.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
```

Both commands must select `KEY-49` at `docs/features/key-49-runtime-and-deployment-model/`.

## 2. Check formatting

```sh
pnpm exec oxfmt --check docs/product.md docs/architecture.md docs/roadmap.md docs/adr .specify/memory/constitution.md .specify/templates package.json packages/sdk/package.json packages/cloud/package.json
```

## 3. Check repository agreement

```sh
pnpm check:repo
```

This command checks feature identity, generated contracts, formatting, lint, types, and package boundaries.

## 4. Run unit tests

```sh
pnpm test:unit
```

This command runs the Cloud and SDK tests that do not start PGlite.

## 5. Run pull request checks

```sh
pnpm test:pr
git diff --check
```

`pnpm test:pr` runs feature-identity and generator tests, repository checks, and all provider-free Cloud and SDK tests. The SDK tests include the current PGlite local runtime. Pull request CI runs the same command. It does not build or inspect a package archive.

## 6. Check package qualification

```sh
pnpm test:qualification
```

This lane builds the SDK twice and inspects the packed archive and Apache-2.0 license bytes. It installs the archive outside the workspace and runs the clean consumer. It also validates the measurement controller and worker protocol.

The manual Local Preview workflow owns the supported operating-system and Node.js matrix plus reference measurements.

## 7. Search for stale governing claims

```sh
rg -n "One model, two runtimes|exactly two runtimes|permanent PGlite|only supported durable|Public Cloud access|complete, read-only PostgreSQL" docs/product.md docs/architecture.md docs/roadmap.md .specify/memory/constitution.md .specify/templates docs/adr
```

Review every match in context. Historical statements in completed feature documents are out of scope and must remain unchanged.

## Evidence boundary

These checks prove the zero-argument facade against the current PGlite engine and packed consumers, plus agreement among the repository, governing documents, templates, package metadata, and provider-free test suite. The future SQLite engine, PostgreSQL installation, Policy, public remote access, self-hosted packaging, managed Cloud, recovery, security, compatibility qualification, new performance measurements, and production support remain `NOT RUN`.
