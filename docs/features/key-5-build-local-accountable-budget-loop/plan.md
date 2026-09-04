# Implementation plan: Build local accountable Budget loop

**Linear issue**: [KEY-5](https://linear.app/keynes/issue/KEY-5/build-local-accountable-budget-loop) | **Branch**: `key-5-build-local-accountable-budget-loop` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)
**Input**: `docs/features/key-5-build-local-accountable-budget-loop/spec.md`
**Inspected source revision**: `18bf0f149f51067806a9e041d9ff50c4a7bbbee8`

## Summary

Deliver one asynchronous Local Budget API backed by private in-memory SQLite. Implement the same logical commands in native PostgreSQL and require one common conformance suite to agree on results, errors, replay, history, and final accounting. PostgreSQL is a conformance implementation here; no PostgreSQL deployment product is delivered.

Resource definition becomes independent and quantity-free. Binding-only creation establishes immutable membership and controls. A movement journal owns quantity, settlement records monotonic usage and permanent deficits, and the final descendant atomically finalizes ready ancestors. Local users neither manage command IDs nor perform database setup.

The user approved this scope clarification. Constitution 6.0.0 is unchanged. Research and design are complete; implementation and runtime verification have not started.

## Technical Context

- **Language/Version**: TypeScript 7.0.2, pnpm 11.21.0, target Node.js `>=24`. Planning host: Node.js 26.5.0.
- **Primary Dependencies**: Built-in `node:sqlite`, existing `pg` 8.23.0, generated contract validators, Vitest 4.1.11. No new production dependency.
- **Storage**: Private SQLite `:memory:` per Local authority; native PostgreSQL 18.6 in a disposable test fixture. Each independently owns its commands, transitions, and evidence. No shared live state or copying between authorities.
- **Testing**: One shared registrar and normalized transcript comparison on both real backends, PostgreSQL rollback/concurrency checks, Local lifecycle/API tests, and clean SDK consumers.
- **Target Platform**: Ubuntu 24.04 x64, macOS 15 arm64, Windows 2025 x64. SDK archive qualification uses Node.js 24 and the latest release resolved for the attempt on each, plus one Node.js 25 transition consumer.
- **Project Type**: TypeScript SDK and native PostgreSQL conformance implementation in the existing pnpm monorepo.
- **Performance Goals**: No throughput, latency, memory-performance, or benchmark acceptance claim. Tree-level PostgreSQL serialization is deliberate.
- **Constraints**: Exact safe-integer public quantities; atomic mutations; immutable membership/controls; no public SQL, identity administration, Policy, remote options, persistence, or recovery in Local mode.
- **Scale/Scope**: Six user stories, FR-001 through FR-032, SC-001 through SC-009. PostgreSQL deployment packaging, remote security, durable recovery, Hosted, Embedded, managed operations, and production readiness are deferred.

## Constitution Check

Both the pre-research check after the approved clarification and the post-design check **PASS at the design level**. This is not runtime qualification.

| Gate                                   | Design and required evidence                                                                                                                                                                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One source of truth per Budget         | Each backend owns the complete mutation in its transaction. The journal is the only quantity authority. Clients project data and own no ledger. Tests prove rollback, conservation, permanent deficits, and replay.                                                                      |
| Application-owned effects              | The API performs accounting only. Applications own provider requests, retries, observations, refunds, outcomes, and fallback behavior. The examples call no providers.                                                                                                                   |
| Policy and security                    | Policy is N/A because KEY-5 is ungoverned. Public inputs cannot select identities, query tables, attach Policy, or select a remote backend. Private PostgreSQL fixtures use restricted procedure access and private tables; cross-tenant/remote security qualification remains deferred. |
| Consistent behavior across deployments | FR-031/032 and SC-009 require the identical shared suite on real SQLite and PostgreSQL plus normalized transcript comparison. Both implementations change together. A missing PostgreSQL result blocks acceptance.                                                                       |
| Evidence-first delivery                | Every behavior starts with an observed failing automated case in its owning suite. Provider-free shared semantics, Local lifecycle, PostgreSQL concurrency, and archive consumers are separate results. Broad fault, benchmark, provider, and operational claims remain NOT RUN.         |

The earlier scope conflict is resolved by requiring PostgreSQL semantics now while deferring deployment delivery. No constitutional amendment or exception is needed. Shared tests do not prove shutdown, and Local tests do not prove PostgreSQL behavior.

## Project Structure

### Documentation

```text
docs/features/key-5-build-local-accountable-budget-loop/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/
    local-api.md
    shared-commands.md
  quickstart.md
  checklists/requirements.md
```

The next command, speckit-tasks, owns `tasks.md`. This plan creates no phase issue, branch, mutable status mirror, or implementation checklist. Later exact phase branches come from Linear publication; never derive them here.

### Source Code

| Owner                        | Existing paths and planned changes                                                                                                                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared schema and generation | `packages/contracts/contract.json`, `schema.json`, `src/generation/`, SDK and PostgreSQL generation scripts. Add atomic batch definition, additions, controls, movement/history/state fields, canonical defaults, and missing errors. Regenerate outputs; do not hand-edit them. |
| Shared scenarios             | `packages/contracts/conformance/host.ts`, `scenarios/index.ts`, scenario files. Extend registerBudgetContractTests and private command/fault seams; add transcript comparison with consistent identity mapping.                                                                  |
| Public Local calls           | `packages/sdk/src/keynes.ts`, `resources.ts`, `resource-binding.ts`, `budget.ts`, `budget-projection.ts`, `sdk-errors.ts`, `index.ts`. Expose binding-only ungoverned calls and asynchronous input failures. Keep deferred Policy/remote source private.                         |
| SQLite authority             | `packages/sdk/src/local/runtime.ts`, `sqlite-store.ts`, `sqlite-command-executor.ts`. Retain queue/replay/transaction mechanisms; replace allocation arithmetic with journal-driven state and stored finalization.                                                               |
| PostgreSQL authority         | `packages/postgresql/migrations/`, `scripts/generate.ts`, `generated/installation-record.json`, `src/installer/`. Select one clean baseline and generate matching procedures, hashes, inventories, and fixture installation checks.                                              |
| Backend adapters             | `packages/sdk/test/conformance/test-host.ts`, `packages/postgresql/test/system/support/`. Reuse real authorities; no SQLite-backed PostgreSQL substitute.                                                                                                                        |
| PostgreSQL runner            | New `packages/postgresql/test/conformance/` runner and package script. Factor existing Docker/installation/cleanup helpers from the broad system runner; execute the common registrar and bounded native cases without PgBouncer or remote/Policy inventories.                   |
| Local/package evidence       | `packages/sdk/test/unit/`, `test/package/`, `scripts/production-modules.ts`, `.github/workflows/ci.yml`, `.github/workflows/sdk-package.yml`. New API/type fixtures, exact-archive consumers, required PostgreSQL conformance CI, resolved Node matrix, per-attempt records.     |

**Structure Decision**: Reuse the existing contract and authority packages. The single logical base is a schema, command semantics, and executable scenarios; backend-specific transition code remains inside its authority. Do not add a generic storage adapter or an application-owned reducer.

## Design and compatibility

[research.md](research.md) records decisions and rejected alternatives. [data-model.md](data-model.md) owns accounting and lifecycle formulas. [contracts/local-api.md](contracts/local-api.md) owns caller signatures and failure behavior. [contracts/shared-commands.md](contracts/shared-commands.md) owns canonicalization, transactions, and comparison. [quickstart.md](quickstart.md) gives the target clean-consumer journey and expected quantities.

The package root intentionally replaces the old private `0.0.0` schema-first API. It exposes Local creation, bindings, Budgets, inspection, and errors. It does not expose Policy, remote configuration, public operation keys, or recovery. Retained deferred code must compile privately without determining the new Local interface. Legacy public calls reject; there is no compatibility shim or silent fallback.

The PostgreSQL fixture uses the architecture's clean `0001-baseline`, replacing the active six-migration development graph. Update generator hash guards, baseline assets, installer inventories, and fixture tests together. No deployed database upgrade or public migration promise is included. Prior source/evidence remains in Git history. Old installation metadata rejects; fixture databases are recreated explicitly.

Every mutation in a PostgreSQL tree locks its root row after replay resolution. Inspection uses one statement snapshot. This limits within-tree concurrency but makes sibling finalization and chronological evidence reviewable. Different trees remain independent. Finer-grained locking is not necessary for this feature's acceptance.

## Delivery sequence for task generation

These are proposed review boundaries, not published Linear phases. Each boundary requires its focused tests to be observed failing before implementation, then passing on both affected backends. The parent issue/branch owns the first phase; later phases need published Linear sub-issues and exact recorded branches.

1. **Definitions and parentless funding:** Shared schema/test seams, baseline selection, minimal PostgreSQL fixture and focused shared-suite runner, independent atomic definition, scoped binding, initial funding, immutable membership/controls. Checkpoint: focused definition/creation cases pass on both real authorities; generation and type checks pass.
2. **Additions and exact child requests:** Journal transitions, member checks, independent child controls, denial/replay behavior, zero membership, safe-integer boundaries. Checkpoint: shared funding/delegation scenarios reconcile both backends, including failed commands.
3. **Usage and terminal settlement:** Monotonic evidence, consumable/reusable deficits, returns/releases, stored lifecycle, ready-ancestor walk. Checkpoint: full settlement scenarios and deterministic rollback checkpoints pass on both authorities with zero live quantity after finalization.
4. **Public Local loop and lifecycle:** New package entry point, typed binding/child membership, projection/history, asynchronous failures, isolation, close/drain, public negative API cases. Checkpoint: public Local journey and lifecycle/type tests pass without private imports.
5. **Integrated backend conformance:** Complete shared inventory, transcript equality, native blocking/races, coherent inspection, complete runner inventory, and required CI lane. Checkpoint: shared and PostgreSQL-specific records identify one source/contract/baseline with no skipped required scenario.
6. **Exact archive acceptance:** Adapt build roots/module allowlist and clean consumers, engine ranges, Node matrix, evidence aggregation, docs. Checkpoint: all source gates plus the same SDK archive on all required lanes; final FR/SC coverage and explicit NOT RUN boundaries retained.

Generate concrete tasks and published phase bindings only after plan review. Do not leave old semantic tests silently skipped to make the new suite pass. Replace obsolete expectations with the new contract; preserve applicable private regression tests without calling them KEY-5 deployment qualification.

## Verification strategy

| Requirements             | Required tests                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001..006; SC-001      | Atomic definition/reuse/conflict, foreign binding, complete membership, zero creation, initial funding despite false addition control                                   |
| FR-007..011; SC-002      | Root/child additions, exact affordable/denied requests, zero and omitted keys, unknown zero member, controls, no partial effects                                        |
| FR-012..019; SC-004      | Missing/zero/increasing/equal/decreasing usage, reusable/consumable overage, permanent deficits, ancestor finalization, all movement reasons, conservation and overflow |
| FR-020..022; SC-003      | Every command replay, changed input and changed operation conflicts, denied replay, concurrent matching ID, rollback, response loss                                     |
| FR-023..024              | Selected state plus entire tree history, sibling Resource names, event order, automatic ancestors, single-snapshot reads                                                |
| FR-025..028; SC-005..006 | Promise-before-failure, caller mutation after admission, queue after failure, concurrent serial outcomes, separate authorities, close/drain and repeated close          |
| FR-029; SC-007           | One SDK archive, isolated install, complete public loop, absent old exports, deep-import rejection, all required OS/Node lanes                                          |
| FR-030                   | Policy/context/options unavailable in types and rejected at runtime                                                                                                     |
| FR-031..032; SC-009      | Identical shared inventory/transcripts on real SQLite and PostgreSQL; controlled native concurrency and rollback; required CI gate                                      |
| SC-008                   | Evidence aggregation validates source/contract/archive/baseline identity, scenario completeness, exact versions, outcomes, and deferred lanes                           |

### Commands and evidence ownership

Existing commands to use after implementing their KEY-5 cases:

```sh
pnpm --filter @keynes/sdk test:unit
pnpm --filter @keynes/sdk test:conformance
pnpm --filter @keynes/sdk test:package:unit
pnpm check:repo
pnpm test:unit
pnpm test:pr
pnpm pack:sdk
pnpm test:package:sdk -- --archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz --output .artifacts/package-tests/sdk/attempts/key-5-local.json
```

New command to implement, **not available at planning time**:

```sh
pnpm --filter @keynes/postgresql test:conformance
```

The focused runner must also compare SQLite transcripts from the same source and contract; matching backend unit assertions alone are not sufficient. It must retain deterministic required scenario IDs and fail on absent execution. Add its invocation as a required CI job with disposable PostgreSQL and no external credentials. Keep generic `test:pr` usable without Docker; KEY-5 acceptance requires both results.

Local package records remain under ignored `.artifacts/package-tests/`. Conformance records remain under ignored `.artifacts/system-tests/`, with a unique attempt directory. Retain an accepted aggregate beside this feature only after executing the candidate revision. Include source revision and dirty-state information, contract digest, baseline digest, PostgreSQL version/image digest, SQLite version, Node/pnpm versions, host, commands, scenario inventory/results, transcript digests, and SDK archive SHA-256. Separate PostgreSQL test fixture identity from SDK archive identity. Qualification results from a dirty candidate cannot be presented as a clean committed revision.

Build the SDK archive once, then distribute that digest to the minimum/latest Node consumers on all three OS lanes and one Node.js 25 transition lane. Resolve exact Node versions before the matrix and record them. Do not repack per lane or infer future-version compatibility from the engine range. Update related workspace engine ceilings where they would prevent the declared target gate from running. Every production dependency/runtime asset must be declared; no database server, sidecar, file-backed Local store, or undeclared workspace fallback may enter the archive.

Runtime, package, shared-conformance, PostgreSQL concurrency, CI, and matrix results are **NOT RUN in this planning invocation**. Policy, remote, provider, broad fault campaign, benchmark, durable recovery, PostgreSQL operational qualification, Hosted, Embedded, self-hosted, managed, and production evidence remains outside KEY-5. Deterministic rollback and response-loss cases are included semantic checks, not a broad operational fault campaign.

## Planning validation

Feature identity, Spec Kit prerequisite discovery, Markdown formatting, local feature links, requirement/criterion ordering, and the complete artifact set pass. The AGENTS.md marker points to this plan. Read-only consistency checks corrected the initial PostgreSQL runner sequencing and explicit-null replay normalization. Runtime and archive checks remain NOT RUN.

## Complexity Tracking

No constitutional violations or exceptions. Two authority implementations are required by the approved scope and Constitution IV. Tree-level serialization avoids a finer locking design until an evidenced need justifies it. Generated contracts and a shared scenario inventory prevent a second logical specification.
