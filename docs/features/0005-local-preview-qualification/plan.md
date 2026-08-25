# Implementation plan: Local preview qualification

**Feature ID**: `FEAT-0005` | **Branch**: `feat/0005-local-preview-qualification` | **Date**: August 24, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `docs/features/0005-local-preview-qualification/spec.md`

## Summary

Emit the FEAT-0004 ESM facade from `packages/sdk/src/index.ts`. Preserve the existing `packages/` layout in `packages/sdk/dist/`, and copy the canonical database files into that layout with `node:fs.cp`. A clean temporary consumer installs the exact archive and exercises the public Budget loop without repository path access.

Keep package construction and the Linux clean-consumer check in `pnpm verify`. Add one explicit `workflow_dispatch` qualification workflow that builds the archive once, verifies its digest on Node.js 24 and 26 across Linux x64, macOS arm64, and Windows x64, and runs the benchmark on the fixed Linux x64 reference job. The workflow retains its machine-readable measurements as run artifacts and writes the accepted run link and evidence boundary to the roadmap. It does not publish the archive.

## Technical context

**Language/Version**: TypeScript 7.0.2; Node.js 24 and 26 ESM consumers
**Primary Dependencies**: Existing `@electric-sql/pglite@0.5.5`; TypeScript compiler; pnpm 11.21.0; Vitest 4.1.11; npm-compatible package archive format
**Storage**: Private in-memory PGlite state only; byte-identical database files in the package build directory; temporary archives, consumers, and workflow artifacts for qualification
**Testing**: Existing source lifecycle and replay suites; one installed consumer; exact package-content checks; a hosted support matrix; fresh-process benchmark samples
**Target Platform**: Linux x64, macOS arm64, and Windows x64 on Node.js 24 and 26; Linux x64 with Node.js 24 is the performance reference
**Project Type**: Private TypeScript SDK workspace producing an unpublished installable ESM archive
**Performance Goals**: Archive at most 512 KiB compressed; production install at most 35 MiB; ready-runtime RSS delta at most 192 MiB; cold create p95 at most 3 seconds; first request p95 at most 250 milliseconds; steady request p95 at most 100 milliseconds
**Constraints**: No registry publication, new production dependency, browser or CommonJS claim, platform-native Keynes binary, repository-path dependency, alternate Budget semantics, database handle, new host mode, or claim beyond the executed matrix
**Scale/Scope**: One package root, one copied database directory, one clean consumer, six host and Node.js combinations, four measurement groups, and one explicit qualification workflow

## Constitution check

*Gate result before research: PASS. Re-checked after design: PASS.*

- **Singular authority - PASS**: `packages/database/migrations/` remains the only hand-authored database semantic source. Package construction copies those files without changing their layout or bytes. The installed procedures still own validation, conservation, replay, settlement, and history.
- **Effect boundary - PASS**: Package construction, local Budget calls, process spawning, and measurement have no application or provider effects. Test fixtures stand in for application work. Keynes still does not execute, retry, observe, or score application work.
- **Policy and security - N/A**: Policy remains absent. Local qualification checks that no public database or identity controls appear, but it makes no hostile-process, tenant-isolation, or sandbox claim. Temporary consumers contain no secrets.
- **One cross-host contract - PASS**: The database contract and FEAT-0004 facade remain unchanged. One emitted ESM archive runs on the declared Node.js and operating-system matrix. The matrix does not imply PostgreSQL, Cloud, browser, bundler, CommonJS, or other-language support.
- **Evidence-first delivery - PASS**: Package-layout, clean-consumer, process-exit, and threshold tests fail before packaging implementation. The accepted FEAT-0004 lifecycle and replay suites run unchanged. `pnpm verify` remains deterministic and provider-free after bootstrap. The hosted matrix and benchmark run only through an explicit workflow and retain exact archive, environment, sample, and result metadata.

No constitutional exception is required.

## Design

### Preserve the package layout

Compile the SDK with `packages/` as the build root. TypeScript emits `packages/sdk/src/` under `packages/sdk/dist/sdk/src/`. `scripts/build-sdk-package.ts` copies `packages/database/` to `packages/sdk/dist/database/` with `node:fs.cp`.

This layout preserves the existing `../../../database/` relationship from `packages/sdk/src/private/migrations.ts`. The installer keeps its current byte, migration, and contract checks. Package validation compares every copied database file with the canonical source before archive creation. No generated SQL module, base64 encoding, path fallback, or second migration graph is needed.

### Emit one ESM package graph

Add `packages/sdk/tsconfig.build.json` with `packages/sdk/src/index.ts` as its only root, `packages/` as `rootDir`, and `packages/sdk/dist/` as `outDir`. TypeScript follows production imports and omits tests, native qualification code, and fixture-only modules that the package root cannot reach.

Update `packages/sdk/package.json` with one ESM `exports` entry into `dist/sdk/src/`, a declaration path, the Node.js range, an explicit `files` allowlist, and build scripts. Keep `private: true`; `pnpm pack` may create a local archive, but no task removes the publication guard. The archive contains `dist/`, `README.md`, and required license metadata only. PGlite stays a pinned production dependency and supplies its own WebAssembly assets through its package.

### Qualify the exact archive

Add a root-owned package qualification runner in `scripts/qualify-local-preview.ts`. It receives an archive path and never packs implicitly. It verifies the archive SHA-256, the pack file list, the copied database bytes, the compressed size, the installed production size, and the absence of forbidden paths. It then creates a temporary project outside the repository, installs the archive from its explicit file path, and compiles and runs `packages/sdk/qualification/consumer.mts`.

The runner resolves no source-workspace import and changes its working directory to the temporary consumer. The consumer imports only `@keynes/sdk`. One file proves both the public types and runtime behavior.

Run `packages/sdk/src/local-lifecycle.test.ts` and `packages/sdk/src/local-replay.test.ts` unchanged before packing. The build emits the same production imports that those suites exercise. The package-content check binds those emitted files to the archive, and the clean consumer proves package-root loading, isolation, closure, and process-local state loss. Do not add emitted duplicates, refactor replay controls, or ship a qualification entry point.

### Measure fixed operations

`scripts/measure-local-preview.ts` runs as a separate process controller. It records the archive digest, commit, contract digest, package and PGlite versions, runner identity, operating system, architecture, Node.js version, commands, warm-up, and raw unchanged samples.

- **Size**: compressed archive bytes and the clean consumer's production dependency tree after install.
- **Memory**: `process.memoryUsage.rss()` before import and after `Keynes.create()` is ready. Report the delta and the absolute value. Post-close memory is diagnostic only.
- **Cold start and first request**: at least 30 fresh child processes. Each process reports runtime creation and the first funded child request with `performance.now()`.
- **Steady request**: one ready runtime, ten warm-up requests, then at least 100 funded requests across roots that cannot exhaust the fixture. Report the nearest-rank p95 from all measured samples.

The command fails on an invalid record or an exceeded ceiling. It writes one JSON record for workflow retention and prints the same summary for local inspection. It does not delete outliers, compare unrelated machines, or claim other-host performance.

### Separate default and qualification lanes

Add the package build, copied-file comparison, archive-content validation, accepted source suites, and one clean Linux consumer to `pnpm verify`. These checks use only the repository toolchain and installed dependencies after bootstrap.

Add `.github/workflows/local-preview.yml` as a manual workflow. One Linux x64 Node.js 24 job builds the archive and publishes it as a workflow artifact. Six consumer jobs download and digest-check that same archive on `ubuntu-24.04`, `macos-15`, and `windows-2025` with Node.js 24 and 26. The Linux x64 Node.js 24 measurement job uses the same archive. Pin all actions, use read-only permissions, apply timeouts, and retain the archive plus measurement JSON under the workflow run.

The roadmap changes to `Complete` only after `pnpm verify` and the full manual workflow pass for the same commit. The dated note records the commit, archive digest, workflow run link, thresholds, and every excluded lane as `NOT RUN`.

## Project structure

### Documentation for this feature

```text
docs/features/0005-local-preview-qualification/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── qualification.md
└── tasks.md
```

### Source code

```text
.github/workflows/
└── local-preview.yml
packages/sdk/
├── package.json
├── tsconfig.build.json
├── qualification/
│   ├── consumer.mts
│   └── tsconfig.json
└── src/
    └── package-qualification.test.ts
scripts/
├── build-sdk-package.ts
├── measure-local-preview.ts
└── qualify-local-preview.ts
```

**Structure decision**: Keep package behavior in `packages/sdk/`, canonical database inputs in `packages/database/`, and cross-package orchestration in `scripts/`. Do not add a package workspace, benchmark framework, archive library, or evidence database.

## Verification

| Command | Claim |
| --- | --- |
| `pnpm generate:check` | Existing generated contracts match their canonical inputs |
| `pnpm --filter @keynes/sdk build` | The package root emits one type-safe ESM production graph |
| `pnpm test:package` | The exact archive has the allowed contents and runs in a clean Linux consumer |
| `pnpm verify` | Provider-free repository, generated-output, source, emitted-package, and clean-consumer checks pass |
| `pnpm qualify:local -- --archive <path>` | The exact archive meets the declared reference-host size, memory, startup, and latency ceilings |
| Manual Local Preview workflow | One archive digest passes all six declared consumer environments and the reference benchmark |
| `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` | Feature identity and required artifacts agree |
| `git diff --check` | Edited files contain no whitespace errors |

The matrix, benchmark, and any hosted run remain `NOT RUN` until their exact workflow attempt finishes. Customer PostgreSQL, Cloud, browser, bundler, CommonJS, security, recovery, upgrade, paid-provider, and adopter evidence remain `NOT RUN` after this feature.
