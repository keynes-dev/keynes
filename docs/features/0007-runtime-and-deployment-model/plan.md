# Implementation plan: Runtime and deployment model

**Feature ID**: `FEAT-0007` | **Branch**: `feat/0007-runtime-and-deployment-model` | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/docs/features/0007-runtime-and-deployment-model/spec.md`

## Summary

Replace the governing assumption that one PostgreSQL implementation serves both PGlite and Cloud with a product model that has two implementations of shared Budget behavior: a planned `node:sqlite` in-memory runtime for local use and the existing PostgreSQL procedures for every durable deployment. Make `Keynes.create()` the current local call shape, reserve an API-key overload for remote discovery, and keep embedded PostgreSQL in caller-owned database transactions. Do not replace PGlite, implement remote discovery, or add PostgreSQL installation behavior in this feature.

## Technical context

**Language/Version**: Markdown, JSON package manifests, TypeScript tests, and one GitHub Actions workflow; Node.js 24 and 26 remain the declared SDK qualification targets
**Primary Dependencies**: Existing Spec Kit scripts, oxfmt, pnpm, Vitest, and repository verification commands; no new runtime dependency
**Storage**: No storage behavior changes. Current local mode still uses in-memory PGlite; current durable behavior uses PostgreSQL
**Testing**: Spec Kit identity and prerequisite checks, repository checks through `pnpm check:repo`, non-PGlite Cloud and SDK unit tests through `pnpm test:unit`, the complete pull request suite through `pnpm test:pr`, package qualification through `pnpm test:qualification` and the Local Preview workflow, stale-claim searches, and `git diff --check`
**Target Platform**: Repository documentation and npm package metadata; existing TypeScript workspace
**Project Type**: Documentation, governance, and narrow public SDK cleanup in a TypeScript monorepo
**Performance Goals**: N/A. This feature runs no benchmark and makes no new performance claim
**Constraints**: Preserve FEAT-0001 through FEAT-0006 artifacts and evidence; keep PGlite installed and working; reject every supplied current constructor argument; do not implement the future API-key overload; make no unproved deployment claim
**Scale/Scope**: Three governing documents, one constitution, three ADR files, three Spec Kit templates, three package manifests, the verification panel, package qualification, workflow wording, and FEAT-0007 artifacts

## Constitution check

_Gate result before research: PASS. Rechecked after design: PASS._

- **One source of truth per Budget**: The documentation assigns each local Budget to one `SqliteCommandExecutor` and each durable Budget to one PostgreSQL database. No adapter may dual-write, copy, or fall back. Constructor shape selects local versus remote access. This feature changes no state transition.
- **Application-owned effects**: Applications still own external work, retries, observation, outcomes, fallback behavior, and the business facts supplied as Policy context. No external effect moves into Keynes.
- **Policy and security**: The public Policy format is one restricted PostgreSQL-style query over the request, the parent Budget, and fixed application context. Keynes cannot read application tables. Public transport security and managed operations remain `NOT RUN`.
- **Consistent behavior across deployments**: The target design requires the same commands, results, errors, replay behavior, accounting rules, and evidence format from the in-memory SQLite runtime and PostgreSQL, with black-box comparison tests. Deployment-specific suites remain separate.
- **Evidence-first delivery**: Constructor tests prove zero-argument local creation and rejection of supplied arguments. Focused validation also covers document consistency, metadata, packaged license text, repository checks, and whitespace. All future runtime, Policy, deployment, recovery, security, and production lanes remain `NOT RUN`.

## Project structure

### Documentation for this feature

```text
docs/features/0007-runtime-and-deployment-model/
├── checklists/requirements.md
├── contracts/document-contract.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
└── tasks.md
```

### Changed repository files

```text
.specify/
├── feature.json
├── memory/constitution.md
└── templates/
    ├── plan-template.md
    ├── spec-template.md
    └── tasks-template.md

docs/
├── adr/
│   ├── 0001-repository-boundaries.md
│   ├── 0003-sqlite-and-postgresql.md
│   └── 0004-apache-2-open-core.md
├── architecture.md
├── product.md
├── roadmap.md
└── workflow.md

packages/
├── cloud/package.json
└── sdk/
    ├── package.json
    ├── qualification/measure-worker.test.mjs
    └── src/
        ├── budget-lifecycle.test.ts
        ├── local-replay.test.ts
        └── public-exports.test.ts

scripts/
├── generate-contracts.test.ts
├── qualify-local-preview.test.ts
└── qualify-local-preview.ts

.github/workflows/local-preview.yml
AGENTS.md
package.json
```

**Structure decision**: Keep all durable lifecycle artifacts under FEAT-0007, update the current governing sources and verification panel, and keep packed-package evidence in the explicit Local Preview lane. Completed FEAT-0001 through FEAT-0006 directories and retained evidence are read-only.

## Design and verification sequence

1. Amend the constitution and synchronize the three lifecycle templates.
2. Add ADR-0003 and ADR-0004, then annotate ADR-0001 without changing its historical decision.
3. Rewrite the product and architecture sources around the approved deployment model and Policy boundary.
4. Reorder the roadmap while preserving completed rows and exact evidence.
5. Align package metadata and the packed SDK license assertion with Apache-2.0.
6. Remove duplicated tests, separate repository checks from unit tests and the complete pull request suite, and move archive and measurement qualification to the explicit Local Preview lane.
7. Replace the local mode option with a zero-argument facade, update package consumers, and reject every supplied argument until remote discovery exists.
8. Run the required checks and stale-claim searches, then mark the feature artifacts complete only if every check passes.

## Complexity tracking

No constitutional violation is accepted. Maintaining two Budget implementations is an intentional product cost recorded by ADR-0003 and controlled by black-box comparison tests. A generic storage adapter is rejected because it would expose an extension promise that Keynes does not need.
