# Tasks: Application-owned policies and the Keynes request boundary

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [documentation contract](contracts/documentation.md).

**Implementation state**: Documentation implementation authorized through speckit-implement. Runtime changes remain excluded. Checkboxes record completed documentation work, not runtime qualification.

**Validation**: Documentation-only change. No executable behavior changes, so no failing runtime test or runtime suite applies. Use focused formatting, link/contradiction review and scenario acceptance. Keep runtime and qualification lanes NOT RUN.

## Phase 1: Setup

- [x] T001 Refresh KEY-113 and base revision, confirm the exact branch/directory, and update the scope inventory in docs/features/key-113-document-application-owned-policies-and-the-keynes-request/research.md without importing previous KEY-113 acceptance. Preserve unrelated work. FR-014, FR-018.
- [x] T002 Confirm the next ADR filename in docs/adr/ and the current constitutional conflict in .specify/memory/constitution.md; record the final supersession scope and planned amendment version in docs/features/key-113-document-application-owned-policies-and-the-keynes-request/plan.md. FR-006.

## Phase 2: Foundational governance amendment

**Gate resolved**: The authorized explicit amendment to constitution 12.0.0 and ADR-0013 resolves the planning conflict. The post-amendment check in plan.md passed before the user-story phases.

- [x] T003 Author docs/adr/0013-application-owned-policies.md, or the next confirmed number, adopting customer-owned evaluation and separate SQLite/PostgreSQL engines; identify superseded ADR-0012 and managed Policy clauses, alternatives, migration owners and current-versus-target limits. Preserve applicable direct SQL, permissions, borrowed-connection and accounting guarantees. FR-001, FR-004, FR-005, FR-006, FR-010, FR-013, FR-015.
- [x] T004 Run speckit-constitution for the explicit major amendment of .specify/memory/constitution.md, including its Sync Impact Report and migration rationale; reconcile affected governing guidance in docs/product.md and docs/architecture.md in the same governance phase. Remove managed Policy/PGlite MUSTs, preserve exact accounting, permissions, replay, caller transactions and fixed funding, and identify later KEY-122/123/124 ownership without designing its protocol. Leave generated scripts/templates unchanged. FR-001 through FR-006, FR-008 through FR-013, FR-015 through FR-018.
- [x] T005 Add minimal supersession notices to docs/adr/0003-sqlite-and-postgresql.md, docs/adr/0006-idiomatic-monorepo.md, docs/adr/0007-direct-postgresql-remote-access.md and docs/adr/0012-postgresql-and-pglite.md, preserving original bodies and obsolete API history. Rerun the constitution check and speckit-analyze; record resolution of the adoption conflict in docs/features/key-113-document-application-owned-policies-and-the-keynes-request/plan.md before proceeding. FR-006, FR-014, FR-018.

## Phase 3: User story 1 - Ownership and enforcement (P1)

**Goal**: Governing documents consistently explain who evaluates and who enforces.

**Independent validation**: Walk US1's four scenarios through product, architecture, constitution and ADR; require agreement on denial, evidence, replay and current behavior.

- [ ] T006 [P] [US1] Complete the product-facing ownership, target/current, customer-failure and valid-request-denial explanation in docs/product.md after T004, avoiding a mandatory policy interface. FR-001 through FR-005.
- [ ] T007 [P] [US1] Complete command, evidence, permissions, transaction and replay descriptions in docs/architecture.md after T004; remove managed Policy registration/compiler/evaluator as target responsibilities while distinguishing implemented behavior. Cover stale availability, input conflicts and separate-database limits. FR-001 through FR-005, FR-015.
- [ ] T008 [US1] Review US1 against .specify/memory/constitution.md and the new ADR, and record the four scenario outcomes in docs/features/key-113-document-application-owned-policies-and-the-keynes-request/acceptance.md without making runtime claims. SC-001.

## Phase 4: User story 2 - Evaluation examples and optional tooling (P2)

**Goal**: Show equivalent request construction and keep toolkit, configuration and hosted evaluation separate from allocation.

**Independent validation**: Compare the two example outputs and pre-submission rejection cases, then review assessment failure, direct request use and shared hosted evaluation.

- [ ] T009 [P] [US2] Add paired schematic ordinary-code and customer-SQL examples to docs/architecture.md using the documentation contract's identical facts/parameters; show matching requests, pre-submission rejection, customer-owned assessment validation/fallback, a valid but unfunded request, and replay without reevaluation. Label target usage and avoid invented exports or mandatory result types. FR-003, FR-004, FR-007.
- [ ] T010 [P] [US2] Reconcile release commitments in docs/product.md for KEY-116/117/118 required Local tooling, KEY-119/120 Cloud configuration/editor, optional per-workflow use, independent KEY-115 model work and later KEY-125 shared versioned HTTP evaluation. State evaluation-only hosting, no first-release gate and deferred mandatory evaluation-and-submission. FR-008, FR-009, FR-017.
- [ ] T011 [US2] Cross-check the example and tooling prose with .specify/memory/constitution.md and docs/architecture.md; document US2 scenario outcomes, including input validation and hosting ownership, in docs/features/key-113-document-application-owned-policies-and-the-keynes-request/acceptance.md. SC-002, FR-003, FR-017.

## Phase 5: User story 3 - Migration and deployment (P3)

**Goal**: Developers can use current instructions and understand later ownership without unsupported release promises.

**Independent validation**: Review all four US3 scenarios and compare package/workflow claims with implemented commands and the new target.

- [ ] T012 [P] [US3] Reconcile docs/workflow.md transition and CLI guidance with SQLite/native enforcement, Policy retirement, package separation and fresh-install limits. Preserve executable CI commands/check names. Point to Linear for sequencing and require active artifacts to reconcile when resumed; retain historical evidence. FR-005, FR-010, FR-013, FR-014, FR-018.
- [ ] T013 [P] [US3] Label existing managed Policy helpers/examples in packages/sdk/README.md as current implementation, state the adopted target and KEY-114/96 migration ownership, and preserve honest current install/runtime instructions. FR-005, FR-011, FR-013.
- [ ] T014 [P] [US3] Reconcile packages/postgresql/README.md with application evaluation ownership while retaining database validation/grants, direct SQL access, caller-owned transactions and fresh-baseline compatibility limits. FR-001, FR-005, FR-013, FR-015.
- [ ] T015 [P] [US3] Review packages/contracts/README.md and docs/README.md for conflicting ownership or roadmap claims; make only necessary wording corrections and retain one canonical command-contract owner and Linear sequencing ownership. FR-010, FR-014.
- [ ] T016 [US3] Finish deployment and future-work statements in docs/product.md and docs/architecture.md: separate accounting engines outside SDK, first Local exclusions, exact numeric/replay requirements without semantic changes, KEY-122/123/124 scope, one Budget model and no owner-bypass promise. Preserve supported SQL access without another SDK commitment. FR-010 through FR-012, FR-015, FR-016.
- [ ] T017 [US3] Record the four US3 scenario results and review current/target labels across all affected active docs in docs/features/key-113-document-application-owned-policies-and-the-keynes-request/acceptance.md. SC-003, FR-005, FR-014.

## Phase 6: Validation and acceptance

- [ ] T018 Run docs/features/key-113-document-application-owned-policies-and-the-keynes-request/quickstart.md checks: documentation/package formatting, diff and link checks, targeted contradiction review and final requirement coverage. Confirm generated files, runtime behavior and historical evidence are unchanged. Record exact commands, outcomes and source revision in docs/features/key-113-document-application-owned-policies-and-the-keynes-request/acceptance.md; list runtime/qualification as NOT RUN. SC-001 through SC-004, FR-018.
- [ ] T019 Reconcile the completed diff against docs/features/key-113-document-application-owned-policies-and-the-keynes-request/spec.md and this task list. Confirm all 18 requirements and 4 success criteria have acceptance evidence, update only verified task checkboxes, and prepare the single documentation review outcome. Commit/push/PR and Linear artifact publication require their own authorization; do not mark Done before merge and required acceptance. SC-004, FR-018.

## Dependencies and execution order

T001 -> T002 -> T003 -> T004 -> T005. This explicit governance phase blocks the user-story phases. T006/T007 -> T008 -> T009/T010 -> T011 -> T012/T013/T014/T015 -> T016 -> T017 -> T018 -> T019. Shared governing files require sequential integration between stories; each story still has an independent reader acceptance test.

Parallel examples: US1 T006 and T007 edit different files after the amendment. US2 T009 and T010 edit different files after US1. US3 T012 through T015 edit disjoint docs after US2. Do not run T004 or T016 concurrently with changes to governing documents.

## Implementation strategy

First establish explicit governance, then validate US1 as the smallest reviewable slice. Add examples/tooling and migration/deployment in order. All three stories remain required for KEY-113's single acceptance outcome; the first slice alone is not completion. No runtime, package or distributed-protocol implementation is hidden in these tasks.
