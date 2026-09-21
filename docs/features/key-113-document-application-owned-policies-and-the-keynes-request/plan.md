# Implementation plan: Application-owned policies and the Keynes request boundary

**Branch**: `key-113-document-application-owned-policies-and-the-keynes-request` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-113-document-application-owned-policies-and-the-keynes-request/spec.md`

## Summary

Plan one documentation change that adopts customer-computed requests and SQLite Local while preserving database accounting. Begin implementation with a superseding ADR and an explicit major constitution amendment, then reconcile product, architecture, workflow and package docs. Keep implemented managed Policy behavior labeled until KEY-114 replaces it. Planning completed in `f496701`. The user has now authorized documentation implementation through speckit-implement; runtime changes remain excluded.

The base is `a203a26d20ed1ecc940d9bca1f05c9d9b81b80b4`, which includes KEY-121 maintenance via PR #62. The previous KEY-113 worktree was removed at the user's request; this branch starts from that main revision. No earlier KEY-113 implementation or acceptance is reused.

## Technical context

**Language/version**: Markdown; stock Spec Kit 1.0.4 Codex integration.

**Primary dependencies**: Existing Spec Kit shell scripts and repository oxfmt. No new dependency.

**Storage**: No data/schema change. Documentation target is private in-memory Node SQLite for Local and PostgreSQL for Hosted/Embedded; each Budget remains in one authority.

**Testing**: Focused formatting, diff/link checks, requirement coverage and manual contradiction review. Runtime tests and qualification NOT RUN because no executable behavior changes.

**Target platform**: Repository documentation read by developers and maintainers.

**Project type**: Documentation and governance amendment within the existing SDK/database monorepo.

**Performance goals**: N/A; no runtime or measured operating-envelope change.

**Constraints**: Documentation-only implementation; preserve generated tooling and historical evidence; no invented executable API signatures, migration promises or published package names.

**Scale/scope**: One new ADR, three governing documents, workflow and affected package READMEs, plus minimal historical ADR forward references. Linear owns the active roadmap; no repository roadmap file exists.

## Constitution check

### Before research

| Gate                                                               | Assessment                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| One Budget authority, atomic commands, conservation, exact replay  | Preserved; no runtime changes or distributed protocol design.                                                                  |
| Customer-owned external effects and transactions                   | Preserved; broaden documentation to evaluation ownership.                                                                      |
| Principles I/III/IV: managed Policies and PostgreSQL/PGlite        | Conflict identified at planning intake; resolved explicitly by constitution 12.0.0 and ADR-0013. See the post-amendment check. |
| Thin SDK, canonical contracts, permissions and native verification | Preserve one command-contract owner; allow separate engine implementations outside the SDK after the amendment.                |
| Evidence-first delivery                                            | Documentation-only exception applies; focused checks instead of behavioral tests. No qualification claim.                      |
| One issue and independently accepted PR                            | KEY-113 only; no phase issues or runtime prerequisites. KEY-121 is landed.                                                     |
| Historical evidence and upstream tooling                           | Immutable historical bodies/evidence; only supersession notices on relevant ADRs. No generated file changes.                   |

Planning correctly reported a CRITICAL conflict while constitution 11.0.0 remained in force. The subsequent speckit-implement request authorized an explicit amendment outside analysis, with its Sync Impact Report and governing guidance. The post-amendment check below supersedes that planning blocker.

### After the explicit amendment

PASS against constitution 12.0.0 and ADR-0013. The authorized amendment removes the managed Policy/PGlite conflict while preserving one Budget authority, database enforcement, exact accounting, fixed funding, caller transaction ownership and native verification. Read-only analysis found no remaining constitutional conflict in the specification or task plan. Workflow/package reconciliation and examples are complete. [Acceptance](acceptance.md) records the documentation checks; runtime qualification remains NOT RUN.

## Project structure

### Documentation for this feature

```text
docs/features/key-113-document-application-owned-policies-and-the-keynes-request/
  spec.md
  checklists/requirements.md
  plan.md
  research.md
  data-model.md
  contracts/documentation.md
  quickstart.md
  tasks.md
```

[Research](research.md) records decisions and conflicts. [Data model](data-model.md) names conceptual ownership without introducing a schema. [Documentation contract](contracts/documentation.md) defines required statements and example acceptance. [Quickstart](quickstart.md) provides the validation procedure. Implementation tasks are generated separately.

### Planned repository changes

```text
docs/adr/0013-application-owned-policies.md   # new, confirm next number at implementation
.specify/memory/constitution.md              # explicit major amendment
docs/product.md
docs/architecture.md
docs/workflow.md
packages/sdk/README.md
packages/postgresql/README.md
packages/contracts/README.md                 # review; edit only if boundary wording conflicts
docs/adr/0003-sqlite-and-postgresql.md        # supersession notice only
docs/adr/0006-idiomatic-monorepo.md           # supersession notice only
docs/adr/0007-direct-postgresql-remote-access.md # supersession notice only
docs/adr/0012-postgresql-and-pglite.md         # supersession notice only
```

No production source, contract JSON, SQL baseline, generated outputs, dependencies or CI changes. `docs/README.md` already establishes Linear ownership and requires no edit unless review exposes a contradiction. Other feature artifacts are reconciled when their owning work resumes.

Follow the [implementation tasks](tasks.md) for delivery order.

## Verification lanes

The planning pass runs stock setup/prerequisite checks, targeted feature formatting, link and task-format checks, and read-only analysis. Documentation implementation ran `pnpm format:docs`, targeted formatting of changed package READMEs, `git diff --check`, link checks and the scenario review in quickstart. Existing SQLite/native commands and required check names remain unchanged. Native permissions, concurrency, caller transactions, Local operating envelope, archives, Hosted, durable recovery and providers remain NOT RUN here.

## Complexity tracking

| Conflicting rule                                                                            | Why the plan must describe a change                                      | Rejected alternative and resolution                                                                                                                                   |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constitution I/IV mandate PGlite and one PostgreSQL implementation                          | KEY-113 explicitly adopts SQLite Local and separate engines outside SDK. | Keeping PGlite contradicts the selected issue. Plan the major amendment; retain existing rules until it occurs and analysis passes.                                   |
| Constitution III and Policy constraints mandate registration/compiler/in-command evaluation | KEY-113 explicitly transfers policy evaluation to customers.             | Calling customer decisions trusted Policy results preserves the wrong trust boundary. Amend governance explicitly; KEY-114 later changes runtime contracts and tests. |

These entries retain the rationale for the explicit amendment. Constitution 12.0.0 and ADR-0013 resolve both conflicts; they are not standing exceptions.
