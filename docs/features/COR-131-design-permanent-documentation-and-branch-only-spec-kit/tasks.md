# Tasks: Permanent documentation and branch-only Spec Kit delivery

**Input**: Design documents in `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `migration-map.md`, `work-proposals.md`, `quickstart.md`

**Delivery rule**: Complete phases sequentially. After each phase, review the full phase diff for correctness, run the smallest applicable checks and a read-only Ponytail review, resolve accepted findings, update these checkboxes, and commit before starting the next phase.

## Phase 1: Adopt the implementation baseline

**Goal**: Turn the approved design into one executable task sequence without changing product behavior.

- [x] T001 Reconcile implementation scope and design-only wording in `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/spec.md` and `plan.md`
- [x] T002 Record this phased task sequence in `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/tasks.md`
- [x] T003 Run Spec Kit analysis and resolve blocking findings across `spec.md`, `plan.md`, and `tasks.md`
- [x] T004 Run formatting, local-link, Spec Kit integrity and repository checks for `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/`
- [x] T005 Run a read-only Ponytail review of Phase 1 files under `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/` and resolve accepted findings
- [x] T006 Commit the reviewed Phase 1 files under `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/`

**Checkpoint**: The implementation scope, task order and evidence boundaries are internally consistent.

---

## Phase 2: Central shared contracts and navigation (User Story 1, P1)

**Goal**: Give shared behavior one permanent central owner and make every documentation owner discoverable.

**Independent Test**: Starting at `docs/README.md`, find one authoritative explanation for every shared Resource, Budget, accounting, command, replay and inspection rule without consulting `docs/features/`.

- [x] T007 [US1] Create shared accounting reference in `docs/reference/accounting.md` from current source, accepted contracts and shared tests
- [x] T008 [US1] Create shared command reference in `docs/reference/commands.md` from canonical operations, validation and replay behavior
- [x] T009 [US1] Reduce duplicated normative behavior in `docs/product.md` and `docs/architecture.md` to product and architecture ownership with links to the new references
- [x] T010 [US1] Update owner navigation and implementation status in `docs/README.md` and `README.md`
- [x] T011 [US1] Document internal source/test ownership in `packages/database/README.md` and create `packages/testkit/README.md`
- [x] T012 [US1] Verify shared-reference coverage against `packages/database/contract.json`, exports and SQLite/PostgreSQL scenarios
- [x] T013 [US1] Run relevant formatting, links, examples and repository checks for `docs/reference/`
- [x] T014 [US1] Run a read-only Ponytail review of Phase 2 files under `docs/`, `README.md`, `packages/database/README.md`, and `packages/testkit/README.md`
- [x] T015 [US1] Commit the reviewed Phase 2 files under `docs/`, `README.md`, `packages/database/`, and `packages/testkit/`

**Checkpoint**: Shared behavior has one permanent central owner; package docs can link to it.

---

## Phase 3: SDK, Local and Policy package documentation (User Story 1, P1)

**Goal**: Colocate public TypeScript, Local runtime and Policy toolkit contracts with their packages.

**Independent Test**: A clean consumer can discover every current export, lifecycle rule, limit and runnable provider-free example from the owning package without following a feature document.

- [x] T016 [US1] Create SDK API and adapter-binding references in `packages/sdk/docs/api.md` and `packages/sdk/docs/runtime-bindings.md`
- [x] T017 [US1] Reduce `packages/sdk/README.md` to an entrypoint and runnable example linked to package-local and shared owners
- [x] T018 [US1] Reconcile Local lifecycle and shared-accounting links in `packages/node-sqlite/README.md`
- [x] T019 [P] [US1] Create Policy parameter, toolkit and testing references in `packages/policy/docs/parameters.md`, `toolkit.md`, and `testing.md`
- [x] T020 [US1] Reduce `packages/policy/README.md` to an entrypoint and current package-status guide
- [x] T021 [US1] Include shipped package-local docs in `packages/sdk/package.json` and `packages/policy/package.json` where archive links require them
- [x] T022 [US1] Run Local, Policy, type, package-content, formatting and link checks for `packages/sdk/`, `packages/node-sqlite/`, and `packages/policy/`
- [x] T023 [US1] Run a read-only Ponytail review of Phase 3 files under `packages/sdk/`, `packages/node-sqlite/`, and `packages/policy/`
- [x] T024 [US1] Commit the reviewed Phase 3 files under `packages/sdk/`, `packages/node-sqlite/`, and `packages/policy/`

**Checkpoint**: SDK, Local and Policy behavior is documented beside its implementation with no current feature-doc dependency.

---

## Phase 4: PostgreSQL and CLI package documentation (User Story 1, P1)

**Goal**: Colocate PostgreSQL runtime, installation and CLI behavior with their packages.

**Independent Test**: An adopter can distinguish owned Hosted access, borrowed Embedded access, installation compatibility and CLI behavior from the package entrypoints alone.

- [x] T025 [US1] Create PostgreSQL runtime and installation references in `packages/postgres/docs/runtime.md` and `packages/postgres/docs/installation.md`
- [x] T026 [US1] Reduce `packages/postgres/README.md` to setup navigation and runnable owned/borrowed examples
- [x] T027 [US1] Complete CLI command, configuration, output, redaction and installation links in `apps/cli/README.md`
- [x] T028 [US1] Include shipped PostgreSQL package docs in `packages/postgres/package.json`
- [x] T029 [US1] Verify generation compatibility from `packages/database/contract.json` and remove stale duplicated values
- [x] T030 [US1] Run PostgreSQL/CLI source, archive-content, formatting and link checks for `packages/postgres/` and `apps/cli/`
- [x] T031 [US1] Run a read-only Ponytail review of Phase 4 files under `packages/postgres/` and `apps/cli/`
- [x] T032 [US1] Commit the reviewed Phase 4 files under `packages/postgres/` and `apps/cli/`

**Checkpoint**: PostgreSQL and CLI behavior has package-local owners and no current feature-doc dependency.

---

## Phase 5: Testing and release evidence (User Story 1, P1)

**Goal**: Give verification lanes, qualification meaning and durable release evidence permanent owners.

**Independent Test**: A contributor can select the right current command and state exactly what its evidence proves without consulting `docs/features/`.

- [x] T033 [US1] Create the verification-lane reference in `docs/testing.md`
- [x] T034 [US1] Create release procedure and evidence-retention guidance in `docs/releases/README.md`
- [x] T035 [US1] Replace active feature-guide links in `README.md`, `docs/`, `packages/`, and `apps/` with testing/release/package owners
- [x] T036 [US1] Extend documentation formatting coverage in `package.json` to package and application docs
- [x] T037 [US1] Preserve fail-closed CI classification in `scripts/classify-sqlite-postgres-changes.ts` and add only focused regression coverage required by any classifier change
- [x] T038 [US1] Run documented provider-free checks for `docs/testing.md` and verify every documented command exists; mark native/archive lanes NOT RUN unless executed
- [x] T039 [US1] Run a read-only Ponytail review of Phase 5 files under `docs/`, `package.json`, and `scripts/`
- [x] T040 [US1] Commit the reviewed Phase 5 files under `docs/`, `package.json`, and `scripts/`

**Checkpoint**: Current testing and release claims have durable owners and explicit evidence limits.

---

## Phase 6: Branch-only delivery workflow and pilot (User Story 2, P1)

**Goal**: Adopt the local repository workflow that preserves reviewed Spec Kit history while keeping the latest checkout clean.

**Independent Test**: The disposable positive and negative Git pilot proves merge-commit retention, squash/rebase incompatibility and shallow-clone recovery without touching the real repository.

- [x] T041 [US2] Add the superseding retention decision in the next available file under `docs/adr/` and add supersession notices to ADR-0009/0010
- [x] T042 [US2] Update `docs/workflow.md`, `AGENTS.md`, `docs/README.md` and `.github/PULL_REQUEST_TEMPLATE.md` with a GitHub-native lifecycle, ordered closeout, immutable links and revision distinctions
- [x] T043 [US2] Implement the disposable standard-library Git pilot under `scripts/` with one focused repository test
- [x] T044 [US2] Run positive merge, squash/rebase negative, shallow-clone recovery and permanent-link failure cases through the pilot under `scripts/`
- [x] T045 [US2] Run workflow, repository, formatting and link checks; verify permanent docs contain only public repository context; record the exact local pilot evidence in `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/acceptance.md`
- [x] T046 [US2] Run a read-only Ponytail review of Phase 6 files under `docs/`, `scripts/`, `AGENTS.md`, and `.github/PULL_REQUEST_TEMPLATE.md`
- [x] T047 [US2] Commit the reviewed Phase 6 files under `docs/`, `scripts/`, `AGENTS.md`, and `.github/PULL_REQUEST_TEMPLATE.md`

**Checkpoint**: Local workflow and tests enforce retained ancestry without changing hosted settings.

---

## Phase 7: Migrate and remove historical feature directories (User Story 3, P2)

**Goal**: Remove migrated delivery artifacts from the latest checkout while retaining exact history and permanent behavior/rationale owners.

**Independent Test**: No active source, test or permanent document links to a removed directory; every mapped topic is reachable from permanent docs; each directory remains retrievable at its retained commit.

- [x] T048 [US3] Expand the 36-row inventory in `migration-map.md` into verified section-level dispositions where required for removal
- [x] T049 [US3] Repair links under `README.md`, `docs/`, `packages/`, `apps/`, `.github/`, and `AGENTS.md` that would break when feature directories leave HEAD
- [x] T050 [US3] Verify every retained behavior, rationale, example and essential evidence item in `docs/features/key-*/` has a permanent owner or explicit retirement reason
- [x] T051 [US3] Remove the approved historical `docs/features/key-*` directories from the latest checkout
- [x] T052 [US3] Run full formatting, link, repository and provider-free checks over the post-removal repository `.`
- [x] T053 [US3] Verify historical bytes for removed `docs/features/key-*/` remain reachable from the pre-removal commit
- [x] T054 [US3] Run a read-only Ponytail review of the Phase 7 repository diff for `docs/features/key-*/` and repaired permanent links
- [x] T055 [US3] Commit the reviewed Phase 7 removal of `docs/features/key-*/` and repaired permanent links

**Checkpoint**: The latest checkout contains permanent documentation and no migrated historical feature directories.

---

## Phase 8: Final evidence and publication-ready handoff

**Goal**: Produce a complete, reviewable candidate while preserving the current feature plan at a pinned commit before its eventual deletion.

- [ ] T056 Update final acceptance evidence and completed task state in `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/`
- [ ] T057 Run final qualification for the complete repository `.` diff and record every NOT RUN lane in `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/acceptance.md`
- [ ] T058 Run final correctness and read-only Ponytail reviews over repository `.` and resolve accepted findings
- [ ] T059 Commit final planning/evidence revision E for `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/`
- [ ] T060 Prepare immutable artifact links and exact deletion commit D for `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/` without pushing, changing GitHub settings or merging

**Checkpoint**: The branch is ready for explicit publication/settings/merge authorization. Hosted settings inspection, configuration, push, PR, merge and branch deletion are not claimed until executed.

## Dependencies and execution order

- Phase 1 blocks all implementation.
- Phase 2 blocks package phases because it establishes shared owners.
- Phases 3 and 4 touch distinct packages but run sequentially for review and commit discipline.
- Phase 5 depends on package documentation so it can link to settled owners.
- Phase 6 depends on permanent owner/navigation decisions.
- Phase 7 depends on Phases 2–6 and the complete migration gate.
- Phase 8 depends on every local implementation phase.

## Notes

- Tasks marked `[P]` touch disjoint files but still remain inside their phase.
- Historical and current behavior must never be conflated during extraction.
- Documentation-only checks do not qualify runtime or release behavior.
- Each phase uses a delegated implementation task, parent correctness review, read-only Ponytail review, and phase commit.
