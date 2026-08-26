# Implementation plan: Runtime and deployment model

**Feature ID**: `FEAT-0007` | **Branch**: `feat/0007-runtime-and-deployment-model` | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/docs/features/0007-runtime-and-deployment-model/spec.md`

## Summary

Replace the governing assumption that one PostgreSQL implementation serves both PGlite and Cloud with a product model that has two implementations of shared Budget behavior: a planned in-memory TypeScript ledger for local mode and the existing PostgreSQL procedures for every durable deployment. Record embedded, self-hosted, and managed PostgreSQL operating models; define a portable restricted-query Policy model; sequence the next implementation work; and align Apache-2.0 metadata. Do not replace PGlite or add PostgreSQL installation behavior in this feature.

## Technical context

**Language/Version**: Markdown, JSON package manifests, and one TypeScript package-qualification assertion; Node.js 24 and 26 remain the declared SDK qualification targets
**Primary Dependencies**: Existing Spec Kit scripts, oxfmt, pnpm, Vitest, and repository verification commands; no new runtime dependency
**Storage**: No storage behavior changes. Current local mode still uses in-memory PGlite; current durable behavior uses PostgreSQL
**Testing**: Spec Kit identity and prerequisite checks, oxfmt, package qualification through `pnpm verify`, stale-claim searches, and `git diff --check`
**Target Platform**: Repository documentation and npm package metadata; existing TypeScript workspace
**Project Type**: Documentation and governance feature in a TypeScript monorepo
**Performance Goals**: N/A. This feature runs no benchmark and makes no new performance claim
**Constraints**: Preserve FEAT-0001 through FEAT-0006 artifacts and evidence; keep PGlite installed and working; do not select final Policy builder methods or connection options; make no unproved deployment claim
**Scale/Scope**: Three governing documents, one constitution, three ADR files, three Spec Kit templates, three package manifests, one package test, workflow wording, and FEAT-0007 artifacts

## Constitution check

_Gate result before research: PASS. Rechecked after design: PASS._

- **One source of truth per Budget**: The documentation assigns each local Budget to one `InMemoryLedger` and each durable Budget to one PostgreSQL database. No adapter may dual-write, copy, infer, or fall back. This feature changes no state transition.
- **Application-owned effects**: Applications still own external work, retries, observation, outcomes, fallback behavior, and the business facts supplied as Policy context. No external effect moves into Keynes.
- **Policy and security**: The public Policy format is one restricted PostgreSQL-style query over the request, the parent Budget, and fixed application context. Keynes cannot read application tables. Public transport security and managed operations remain `NOT RUN`.
- **Consistent behavior across deployments**: The target design requires the same commands, results, errors, replay behavior, accounting rules, and evidence format from the in-memory ledger and PostgreSQL, with black-box comparison tests. Deployment-specific suites remain separate.
- **Evidence-first delivery**: This feature has no runtime behavior to drive with a failing test. Focused validation covers document consistency, metadata, packaged license text, repository checks, and whitespace. All future runtime, Policy, deployment, recovery, security, and production lanes remain `NOT RUN`.

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
│   ├── 0003-local-ledger-and-postgresql.md
│   └── 0004-apache-2-open-core.md
├── architecture.md
├── product.md
├── roadmap.md
└── workflow.md

packages/
├── cloud/package.json
└── sdk/
    ├── package.json
    └── src/package-qualification.test.ts

scripts/
├── qualify-local-preview.test.ts
└── qualify-local-preview.ts

AGENTS.md
package.json
```

**Structure decision**: Keep all durable lifecycle artifacts under FEAT-0007, update only the current governing sources and templates, and make the smallest TypeScript test change needed to align packed-package license evidence. Completed feature directories and retained evidence are read-only.

## Design and verification sequence

1. Amend the constitution and synchronize the three lifecycle templates.
2. Add ADR-0003 and ADR-0004, then annotate ADR-0001 without changing its historical decision.
3. Rewrite the product and architecture sources around the approved deployment model and Policy boundary.
4. Reorder the roadmap while preserving completed rows and exact evidence.
5. Align package metadata and the packed SDK license assertion with Apache-2.0.
6. Run the required checks and stale-claim searches, then mark the feature artifacts complete only if every check passes.

## Complexity tracking

No constitutional violation is accepted. Maintaining two Budget implementations is an intentional product cost recorded by ADR-0003 and controlled by black-box comparison tests. A generic storage adapter is rejected because it would expose an extension promise that Keynes does not need.
