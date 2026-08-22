# Implementation Plan: Repository and Code Architecture

**Feature ID**: `FEAT-0001` | **Branch**: `feat/0001-repository-and-code-architecture` | **Date**: 2026-08-21 | **Spec**: [spec.md](spec.md) **Input**: Feature specification from `/docs/features/0001-repository-and-code-architecture/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Establish the lean, nonfunctional database-native repository, ownership map, and local/CI quality baseline required by the seven included roadmap deliverables. The accepted topology retains one PostgreSQL SQL/PL/pgSQL authority core, one TypeScript SDK with private local PGlite, and one private TypeScript Cloud service. TypeScript is the sole SDK and Cloud service language. pnpm is the contributor entry point, and Turborepo owns the two-workspace task graph with task-output caching disabled throughout FEAT-0001. This feature implements no Keynes product behavior.

## Technical Context

**Language/Version**: Contributors may use Node.js 24 through 26. Node.js 24.19.0 remains the repository default and primary CI version, and pnpm 11.21.0 remains exact-pinned. PostgreSQL and PGlite versions are deferred to their implementation and qualification stages. The pinned repository tools are Turbo 2.10.11, TypeScript 7.0.2, Oxlint 1.79.0, Oxfmt 0.64.0, and Vitest 4.1.11. **Primary Dependencies**: Turborepo owns the task graph and source-boundary validation, `tsc --noEmit` type-checks, Oxlint lints, Oxfmt formats, and Vitest runs meaningful workspace tests. Only `packages/sdk/` and `packages/cloud/` are pnpm workspaces. Their manifests declare package access; pnpm enforces the toolchain declarations and rejects dependency cycles. FEAT-0001 implements no root-owned script because its current rules are expressed by pnpm and Turborepo. Contract generation, generated-output drift checks, dedicated security scanning, and dependency-license policy are deferred to the roadmap features that have real inputs or release artifacts. The repository is licensed under Apache-2.0. **Storage**: FEAT-0001 stores repository sources and ordinary native verification reports only. It creates no tracked evidence-promotion hierarchy, attempt envelope, semantic digest, or current-attempt pointer. PostgreSQL and PGlite are not selected or installed; no database is started and no authority state is stored in this feature. **Testing**: Vitest tests are colocated with the workspace code they exercise. FEAT-0001 runs only meaningful workspace tests; future migration, conformance, fault-injection, compatibility, packaging, and performance lanes remain outside this feature and `NOT RUN`. Advisory lookup and a repository-wide SBOM are out of scope. **Target Platform**: Contributor development on macOS and provider-free GitHub Actions continuous integration on one fixed Linux x64 runner. macOS and Windows CI are explicitly unqualified by this feature; later runtime support matrices are documented but not qualified here. **Project Type**: Lean TypeScript monorepo with future contract and database ownership areas, one SDK workspace, one Cloud workspace, root-owned scripts, and documentation. **Root Infrastructure**: Root manifests and tool configuration, `.gitignore`, Apache-2.0 `LICENSE`, `.github/CODEOWNERS` assigning `* @shubsharan`, and `.github/workflows/` support the six ownership areas without becoming additional product boundaries. The private workspace names are `@keynes/sdk` and `@keynes/cloud`, and CI uses `ubuntu-24.04`. **Performance Goals**: Deterministic clean-checkout verification with actionable failures and a 15-minute CI safety timeout, without making a speed claim. **Constraints**: No Keynes functional behavior; no credentials or provider access in the default workflow; exact dev/CI pins; committed locks; Turborepo task-output caching disabled locally and in CI for all FEAT-0001 tasks; third-party actions use full commit SHAs and least privilege; CI caches only dependency downloads from trusted refs. **Scale/Scope**: Seven traceable roadmap phases, six ownership areas, two TypeScript workspaces, colocated tests, and one provider-free root verification workflow within one Spec Kit feature.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Singular authority — PASS**: `packages/database/` is the only boundary permitted to own the hand-authored migration graph, SQL/PL/pgSQL sources, and future Budget semantics. Contracts remain logical interface sources. Future generators cannot become a second semantic source. This feature changes no conservation, atomicity, replay, settlement, or unresolved-state behavior because it implements no transitions.
- **Effect boundary — N/A**: FEAT-0001 executes repository engineering commands only. It introduces no application work, provider call, effect retry, usage observation, business outcome, or fallback behavior.
- **Policy and security — PASS**: Policy execution, tenant data, and durable authority are out of scope. The credential-free workflow and placeholders introduce no secret input. Dedicated scanning and runtime Policy qualification remain deferred.
- **One cross-host contract — PASS**: No public procedure, domain schema, SDK behavior, or functional migration is introduced. The plan establishes one authority-owned graph boundary for later shared PGlite, customer PostgreSQL, and Cloud work without claiming conformance.
- **Evidence-first delivery — PASS**: The work is structural and mechanical, so focused validation applies instead of red-before-green tests. Third-party workspace tools retain their native diagnostics rather than receiving duplicate repository-owned tests. Networked, paid, managed-provider, externally mutating, migration, conformance, fault, compatibility, packaging, and benchmark work remains outside FEAT-0001 and `NOT RUN`.

The pre-research Constitution Check passes with no exception. The post-design check also passes: `data-model.md` keeps authority semantics out of repository engineering entities; root-owned scripts remain deferred; colocated tests exercise only meaningful workspace behavior; and future generation and runtime qualification remain explicitly `NOT RUN`. The design introduces no alternate authority, application effect, Policy behavior, public SDK behavior, or unsupported host claim. The check must run once more before implementation.

## Project Structure

### Documentation (this feature)

```text
docs/features/0001-repository-and-code-architecture/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/
├── contracts/
├── database/
├── sdk/
└── cloud/
scripts/
docs/
└── adr/
```

**Structure Decision**: `packages/contracts/` reserves ownership of future logical interface inputs; `packages/database/` reserves ownership of the future hand-authored PostgreSQL migration graph and SQL/PL/pgSQL sources; `packages/sdk/` is the sole future public TypeScript release unit and reserves its private local PGlite adapter; `packages/cloud/` owns the private nonfunctional TypeScript service shell; `scripts/` reserves root-owned automation for later stages; and `docs/` owns architecture records and contributor guidance. `packages/` is only a namespace for all product code, and only its `sdk/` and `cloud/` children are pnpm workspaces. Scripts run from the root package and are neither a workspace nor a publishable package. Tests are colocated with the TypeScript source they exercise; the repository creates no empty test tree or future-lane placeholders. FEAT-0001 package manifests remain private and non-publishable, use repository-scoped provisional identifiers, and make no public registry, module-format, or browser-support promise. Contract generation begins in the executable authority stage. This feature creates no generated-output system, tracked evidence-promotion directories, or distribution placeholder.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitutional violations are accepted or currently required.
