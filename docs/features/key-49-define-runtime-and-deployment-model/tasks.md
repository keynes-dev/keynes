# Tasks: Define runtime and deployment model

**Input**: Design documents from `/docs/features/key-49-define-runtime-and-deployment-model/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/document-contract.md`, `quickstart.md`

**Tests**: This feature changes governance, documentation, templates, package metadata, verification ownership, and the public constructor call shape. The default gate checks generated-contract drift and behavior, while the explicit Local Preview lane checks package construction, packed license text, external installation, and measurements.

## Phase 1: Setup

**Purpose**: Reserve one canonical feature and establish its decision-complete artifacts.

- [x] T001 Reserve KEY-49 on `feat/0007-runtime-and-deployment-model` through the Spec Kit feature hook and update `.specify/feature.json`
- [x] T002 [P] Write user outcomes, requirements, evidence boundaries, and assumptions in `docs/features/key-49-define-runtime-and-deployment-model/spec.md`
- [x] T003 [P] Validate specification quality in `docs/features/key-49-define-runtime-and-deployment-model/checklists/requirements.md`
- [x] T004 [P] Record runtime, deployment, Policy, testing, and licensing decisions in `docs/features/key-49-define-runtime-and-deployment-model/research.md`
- [x] T005 [P] Define conceptual placement, Policy, and evidence records in `docs/features/key-49-define-runtime-and-deployment-model/data-model.md`
- [x] T006 [P] Define governing-source ownership and agreement in `docs/features/key-49-define-runtime-and-deployment-model/contracts/document-contract.md`
- [x] T007 Write the design and validation sequence in `docs/features/key-49-define-runtime-and-deployment-model/plan.md`, write executable checks in `docs/features/key-49-define-runtime-and-deployment-model/quickstart.md`, and point `AGENTS.md` at the active plan

**Checkpoint**: Feature identity and lifecycle artifacts agree and contain no unresolved clarification.

---

## Phase 2: Governance foundation

**Purpose**: Amend the non-negotiable principles and historical decisions before changing explanatory documents.

- [x] T008 Update `.specify/memory/constitution.md` from 3.0.0 to 4.0.0 with one source of truth per Budget, consistent behavior across deployments, PostgreSQL-only durability, restricted Policy queries, application-owned effects, and exact-revision evidence
- [x] T009 [P] Update `.specify/templates/spec-template.md`, `.specify/templates/plan-template.md`, and `.specify/templates/tasks-template.md` to ask about deployment, Budget behavior, shared tests, deployment-specific tests, Policy context and query support, and untested claims
- [x] T010 [P] Add the narrow supersession note to `docs/adr/0001-repository-boundaries.md` without changing its historical reasoning
- [x] T011 [P] Record the local SQLite and PostgreSQL decision, two-implementation cost, black-box comparison tests, retained service basis, and rejected generic adapter in `docs/adr/0003-sqlite-and-postgresql.md`
- [x] T012 [P] Record the Apache-2.0 open-core decision and commercial boundary without prices or future package promises in `docs/adr/0004-apache-2-open-core.md`

**Checkpoint**: Constitution, templates, and ADRs establish the approved vocabulary and decision boundaries.

---

## Phase 3: User Story 1 - Choose a deployment (Priority: P1)

**Goal**: Let a buyer distinguish local, embedded PostgreSQL, self-hosted, and managed Cloud choices from current implementation evidence.

**Independent test**: A new reader can identify where a Budget is stored, how long it lives, who operates it, and which capabilities remain unproved.

- [x] T013 [US1] Rewrite `docs/product.md` around one product across local and PostgreSQL deployments, preserving Budget, Resource, settlement, replay, and application-effect rules
- [x] T014 [US1] Rewrite the status, topology, deployment profiles, current KEY-47 boundary, and explicit no-copy/no-fallback rule in `docs/architecture.md`

**Checkpoint**: Product and architecture explain every deployment option in buyer and implementation terms without claiming future work exists.

---

## Phase 4: User Story 2 - Implement the same Budget behavior twice (Priority: P2)

**Goal**: Define the command boundary, local SQLite runtime semantics, PostgreSQL responsibilities, and comparison evidence for two implementations.

**Independent test**: An engineer can trace one SDK command to each executor and list both shared and deployment-specific tests.

- [x] T015 [US2] Define `CommandExecutor`, `SqliteCommandExecutor`, `PostgresProcedureClient`, and `RemoteClient`, plus local SQLite transactions, replay, serialization, isolation, and close behavior in `docs/architecture.md`
- [x] T016 [US2] Define durable procedure ownership, embedded transactions, service responsibilities, comparison tests, and deployment-specific evidence limits in `docs/architecture.md`

**Checkpoint**: The architecture describes two concrete implementations without adding a generic storage interface.

---

## Phase 5: User Story 3 - Author a portable Policy (Priority: P3)

**Goal**: Define one restricted query format and a clear application-context boundary without selecting the final builder API.

**Independent test**: A reader can identify both authoring paths, all visible Policy inputs, prohibited access, both evaluators, and replay behavior.

- [x] T017 [US3] Rewrite the Policy section in `docs/product.md` with the typed builder, supported raw SQL subset, fixed context, application-table boundary, embedded transaction fact gathering, and recorded replay context
- [x] T018 [US3] Define the public query subset, private parser representation, local evaluator, PostgreSQL validator and evaluator, and Policy comparison coverage in `docs/architecture.md`

**Checkpoint**: Policy language is direct, deployment-neutral, fail-closed, and free of invented method names or connection options.

---

## Phase 6: User Story 4 - Plan and commercialize the open core (Priority: P4)

**Goal**: Sequence future implementation, preserve past evidence, and align license metadata and package evidence.

**Independent test**: The roadmap has one `Next` item, exact completed evidence remains, and all package metadata and packed license checks agree on Apache-2.0.

- [x] T019 [US4] Reorder future candidates and add in-memory, PostgreSQL transaction, and Policy acceptance boundaries in `docs/roadmap.md` while preserving KEY-44 through KEY-47 rows and evidence
- [x] T020 [P] [US4] Add Apache-2.0 metadata to `package.json`, `packages/sdk/package.json`, and `packages/cloud/package.json`
- [x] T021 [P] [US4] Update Apache-2.0 metadata and retain one packed-license assertion in `scripts/qualify-local-preview.ts` and `scripts/qualify-local-preview.test.ts`
- [x] T022 [US4] Replace stale source-of-truth wording in `docs/workflow.md` only where the new two-implementation model makes it inaccurate

**Checkpoint**: Roadmap, workflow, licensing, and package evidence agree with the governing decisions.

---

## Phase 7: Acceptance

**Purpose**: Prove repository agreement and preserve the limits of that proof.

- [x] T023 Run `pnpm check:feature-identity` and `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`; require KEY-49 and complete checklists
- [x] T024 Run the required oxfmt check over governing documents, ADRs, constitution, templates, and package manifests; format only the files in scope if needed
- [x] T025 Run the complete repository and runtime checks, then run `pnpm test:qualification` and confirm the packed archive requires Apache-2.0 text
- [x] T026 Search current governing documents for stale two-runtime, permanent-PGlite, managed-Cloud-only, unrestricted-SQL, and next-public-Cloud claims; review every remaining match in context
- [x] T027 Run `git diff --check`, confirm `docs/features/key-44-define-repository-and-code-architecture/` through `docs/features/key-47-build-cloud-runtime-and-service/` and retained evidence are unchanged, and inspect the complete diff for scope and naming
- [x] T028 Mark `docs/features/key-49-define-runtime-and-deployment-model/spec.md`, `docs/features/key-49-define-runtime-and-deployment-model/tasks.md`, and the KEY-49 roadmap row complete only after T023-T027 pass; keep future runtime and deployment lanes `NOT RUN`

---

## Phase 8: Verification panel simplification

**Purpose**: Remove duplicated checks and keep each verification lane focused on the evidence it owns.

- [x] T029 Audit the default, package, measurement, and native test panels and record which checks protect distinct behavior
- [x] T030 Delete `packages/sdk/src/package-qualification.test.ts`, move its repeated-build check into `scripts/qualify-local-preview.test.ts`, and run qualification tests from `.github/workflows/local-preview.yml`
- [x] T031 Remove the duplicated Resource rollback matrix, private-export blacklist, repeated second-loss cases, and third clean generator run
- [x] T032 Add generated-output and generator tests to the complete pull request checks, and exclude package measurement workers from the default SDK test command
- [x] T033 Update KEY-49 validation instructions and run focused qualification, generator, SDK, and repository verification
- [x] T034 Add `pnpm check:repo` for repository agreement, `pnpm test:unit` for tests that do not start PGlite, and `pnpm test:pr` for the complete pull request and feature-acceptance checks
- [x] T035 Document when to run the focused test, `pnpm check:repo`, `pnpm test:unit`, and `pnpm test:pr` in `docs/workflow.md` and the KEY-49 validation artifacts
- [x] T036 Run `pnpm check:repo`, `pnpm test:unit`, `pnpm test:pr`, the focused documentation format check, and `git diff --check`

**Checkpoint**: The default gate proves generated contracts and provider-free behavior. The Local Preview lane owns archive, install, license, and measurement evidence.

---

## Phase 9: Runtime and access amendment

**Purpose**: Name the actual runtimes, remove the public local mode flag, and keep embedded transaction ownership in application database code.

- [x] T037 Replace the planned hand-written local ledger with a private in-memory `node:sqlite` runtime across the governing documents, ADR-0003, and KEY-49 artifacts
- [x] T038 Add constructor coverage for `Keynes.create()` and runtime rejection of `undefined`, empty objects, API-key objects, and the removed local mode option
- [x] T039 Implement the zero-argument current facade, remove `KeynesCreateOptions`, and update package consumers without adding the future API-key overload
- [x] T040 Document future API-key remote discovery and caller-owned embedded SQL transactions without adding an embedded facade mode or SDK-owned transaction surface
- [x] T041 Run focused SDK tests, `pnpm check:repo`, `pnpm test:unit`, `pnpm test:pr`, `pnpm test:qualification`, the documentation format check, and `git diff --check`

**Checkpoint**: Runtime, access path, deployment profile, and transaction ownership are distinct concepts, and the executable facade matches the current local call shape.

---

## Dependencies and execution order

- Phase 1 establishes the feature identity and inputs.
- Phase 2 supplies the governing language used by every later document.
- Phases 3 through 5 update overlapping product and architecture files in order.
- Phase 6 depends on the final product and architecture boundaries.
- Phase 7 is sequential and completes the original feature acceptance.
- Phase 8 follows the repository-wide test audit and rechecks acceptance after changing verification ownership.
- Phase 9 amends the accepted model and rechecks the complete feature after the constructor and runtime decisions changed.

## Parallel opportunities

- T002-T006 own separate feature artifacts after T001.
- T009-T012 own separate templates or ADR files after T008 establishes vocabulary.
- T020 and T021 own different files and can proceed together.

## Scope controls

- Do not remove PGlite, migrations, native tests, the Cloud package, or KEY-47 code.
- Do not add a local SQLite runtime, PostgreSQL installer, public service, Policy evaluator, self-hosted package, managed Cloud behavior, or another database adapter.
- Do not modify completed feature documents or retained evidence.
- Do not claim that provider-free documentation and repository checks prove future runtime, security, recovery, managed, benchmark, or production behavior.
