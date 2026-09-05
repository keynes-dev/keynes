# Implementation Plan: KEY-91 Make Local, Hosted, and Embedded testing independently runnable

**Branch**: `key-91-make-local-hosted-and-embedded-testing-independently` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: The specification and accepted default-all remote clarification in this directory.

## Summary

Add Local, remote PostgreSQL, Embedded, and Hosted contributor commands under the existing package owners. Reuse native startup/cleanup, canonical Budget scenarios, and installed SDK qualification. Remote runs all supported connection modes by default. Explicit narrower runs start only the dependencies they need and produce evidence that cannot satisfy the complete gate.

Preserve `pnpm test:sqlite-postgres` and its complete native inventory. Embedded initially proves fixture transactions only. Hosted initially returns an explicit unavailable result. Supported Embedded installation and actual Hosted operations remain with their product owners.

## Technical Context

**Language/Version**: Existing TypeScript 7.0.2, Node.js >=24, pnpm 11.21.0.

**Primary Dependencies**: Vitest 4.1.11, existing `pg`, Docker CLI, pinned PostgreSQL 18.6 and PgBouncer images from the native runner. OpenSSL is a test-fixture prerequisite for temporary certificates. No new application dependency or fixture framework.

**Storage**: Private in-memory SQLite for Local; attempt-owned PostgreSQL databases for native checks. Ignored filesystem directories hold archives, sanitized reports, and temporary fixture material. No product schema changes.

**Testing**: Provider-free runner tests first; real Local and native PostgreSQL selected checks; installed consumers; unchanged paired behavior gate. Exact selected inventories, negative-result validation, cancellation, concurrent attempts, and package preparation locking receive direct tests.

**Target Platform**: Current supported contributor environments with Node >=24. Docker-backed native acceptance is required on the existing Ubuntu CI environment. Installed archive OS/Node matrix remains owned by the existing package qualification workflow.

**Project Type**: Contributor CLI orchestration in an existing library monorepo.

**Performance Goals**: Zero dependencies started solely for excluded coverage. Preserve existing bounded readiness and process-cleanup timeouts. No throughput, benchmark, or production availability claim.

**Constraints**: Default verification remains provider-free. Root commands remain thin. No SDK validation bypass, changed Budget semantics, new public SDK, new installation profile, required-check rename, or Spec Kit customization.

**Scale/Scope**: Three available local deployment selections, one unavailable Hosted entrypoint, three remote connection modes, and the existing full gate. Two simultaneous attempts must preserve independent state and evidence.

## Constitution Check

The pre-research check passed against constitution 8.0.1. The post-design check also passes at the design level; execution evidence remains NOT RUN.

| Gate                      | Design and verification obligation                                                                                                                                              | Pre-research | Post-design |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| One Budget authority      | Existing SQLite and PostgreSQL implementations retain all state transitions. Runner changes only select and observe tests.                                                      | Pass         | Pass        |
| Application-owned effects | Embedded fixtures verify atomic application/Keynes transactions. No provider work, refunds, or workflow orchestration is introduced.                                            | Pass         | Pass        |
| Restricted Policies       | Reuse canonical scenarios; retain all native Policy assertions in full execution. No parser, evaluator, context, or replay contract change.                                     | Pass         | Pass        |
| Consistent behavior       | Keep full SQLite/native comparison and native-only inventory. Selected manifests cannot qualify full acceptance.                                                                | Pass         | Pass        |
| Evidence-first delivery   | Observe failing runner behaviors before implementation. Retain exact revision, artifact, environment, attempt, coverage, and cleanup results.                                   | Pass         | Pass        |
| External authorization    | Hosted is unavailable with zero external effects here. Any later live run needs its product contract and separately authorized inputs and limits.                               | Pass         | Pass        |
| Ownership and scope       | Contracts owns shared scenarios; SDK and PostgreSQL own tests; testkit owns reusable mechanics. One feature branch and PR.                                                      | Pass         | Pass        |
| Prerequisites             | Existing full gate is present. KEY-10/KEY-11 are prerequisites for installed Embedded acceptance only; that unavailable result is explicit and does not block fixture delivery. | Pass         | Pass        |

No constitutional exception is required. Product security, recovery, migration, performance, and managed operations are not newly implemented. Their existing assertions remain required where selected; their broader qualification is not inferred.

## Project Structure

### Documentation for this feature

- [research.md](research.md) records source findings, decisions, and rejected alternatives.
- [data-model.md](data-model.md) defines selection and evidence states.
- [contracts/deployment-checks.md](contracts/deployment-checks.md) defines contributor commands, inventories, and exit behavior.
- [quickstart.md](quickstart.md) defines implementation validation scenarios.
- `tasks.md` will be generated by `$speckit-tasks`; it is not part of this command.

### Source code

Existing owners remain unchanged. These additions are proposed paths, not implemented files:

```text
packages/contracts/contract-tests/              canonical shared Budget registration, preserved
packages/sdk/test/system/run-local.ts            new Local entrypoint
packages/sdk/test/system/run-hosted.ts           new unavailable Hosted entrypoint
packages/sdk/test/system/required-scenarios.ts   new Local inventories
packages/sdk/test/package/remote-consumer.ts     new installed remote assertions
packages/sdk/test/package/qualify.ts             reuse installed Local qualification
packages/postgresql/test/system/run.ts           reuse full runner; explicit selected execution
packages/postgresql/test/system/run-deployment.ts new selected CLI
packages/postgresql/test/system/required-scenarios.ts preserve full inventory; declare selections
packages/postgresql/test/system/support/         selected context and TLS fixtures
packages/testkit/src/                           shared report/process/snapshot/archive-lock helpers
scripts/run-sqlite-postgres.ts                   full comparison remains here
package.json                                   thin aliases
packages/sdk/package.json                       SDK-owned commands
packages/postgresql/package.json                PostgreSQL-owned commands
.github/workflows/ci.yml                        existing full required check preserved
.github/workflows/postgresql-system.yml         existing full native workflow preserved
docs/workflow.md                               entrypoint and evidence guidance
```

Use existing files where their ownership fits. Add adjacent `*.test.ts` files for new runner behavior. Update testkit exports and declared workspace edges only for extracted helpers actually used by multiple owners. Do not move SQL assertions or contract inventories to testkit.

## Phase 0: research outcome

The unknowns are resolved in [research.md](research.md): runner selection, exact inventories, installed-consumer reuse, TLS provisioning, Embedded/Hosted limits, and packaging concurrency. Existing images and SDK certificate validation remain in use. Product environments are deliberately unavailable, not unresolved design choices.

## Phase 1: design

### Selection and execution

Implement the command contract before changing execution. Use a discriminated selection type so full execution, remote modes, Embedded fixture execution, and unavailable product acceptance cannot share an ambiguous optional-field configuration. Parse once at the CLI boundary. Reject invalid arguments before creating fixtures.

Keep `runPostgresqlSystemTests` default behavior full. Its complete validator remains callable without a selection argument. A selected execution uses a separately named result writer and explicit expected inventory. Both paths always validate their report, including runs without a requested durable output file. Direct invocation of a native suite without runner context fails with the documented entrypoint; ordinary provider-free commands continue to exclude native suites.

Materialize test files and parameterized assertion names before execution. Preserve existing full/default-all connection names, including the combined pooler-mode assertion. Narrower runs register only applicable profile checks and individually named pooler assertions. An omitted mode is an exclusion, not a skipped test.

### Local and installed consumers

The Local entrypoint runs the canonical Budget registration and the declared Local/public/Policy inventory. Reuse `qualifyArchive` without authorized-database mode for installed consumer checks. Its package export/configuration checks remain provider-free even where their names mention remote access.

The remote selection runs its native fixture inventory, cleans up that fixture phase, then runs installed SDK assertions against a fresh TLS fixture. Provision the target using the installed PostgreSQL CLI. Use supported administration to create bounded fixture identities; consumer execution receives only ordinary scoped credentials. SDK assertions remain under the SDK owner and import only the installed package. Verify identity/isolation, Budget operations, replay/conflict recovery after reconnect, unavailable connection failure, wrong CA, and wrong hostname for each selected mode.

Keep the existing plaintext negative fixture unchanged. Generate temporary certificates with SANs for `127.0.0.1`, `localhost`, and the backend name `postgres`. PostgreSQL requires TLS 1.2 or later and correct private-key permissions. PgBouncer requires client encryption and verifies its backend using the fixture CA; the SDK verifies the pooler's certificate with `sslmode=verify-full` and `sslrootcert`. Retain only non-secret certificate fingerprints and observed connection modes.

### Embedded and Hosted boundaries

Embedded fixture execution runs the canonical native Budget aggregate and all 14 existing Embedded transaction assertions. It requires no pooler. Its manifest explicitly labels the application grants as fixture-provided and installed Embedded acceptance as NOT RUN. `--installed` reports the missing supported product implementation before fixture mutation. Do not add installation grants or a profile flag to the product CLI here.

Hosted accepts an output destination, writes NOT RUN with the unavailable product-runner reason, and exits nonzero. It does not inspect ambient database credentials or invoke the existing authorized-database walkthrough. The command contract specifies what Hosted delivery must establish before enabling live execution. Do not introduce a plugin registry or generic provisioning adapter for an absent product.

### Resource and evidence ownership

Extract reusable child termination, report validation/sanitization, source snapshot, and exclusive archive preparation only where more than one owner needs them. Reuse current cancellation behavior, including tracking resource creation that races cancellation. Clean up test children before poolers, database, network, and temporary workspaces. Record all cleanup failures; never overwrite an assertion failure with a cleanup success.

Use a single checkout-local build/pack lock for the entrypoints involved here, including full native package preparation. Lock acquisition has a bounded wait and honors cancellation. A contender never deletes a lock it did not acquire. A stale lock fails with an actionable diagnostic; automatic unsafe lock stealing is excluded. Once archives are immutable, release the lock and allow attempts to execute concurrently. Supplied archives are read-only inputs and are never deleted by attempt cleanup.

Write the selected manifest and sanitized reports under a newly created output directory. Bind expected coverage before tests run and validate observed coverage afterward. Hash archives and reports. Capture source before/after identity, including dirty-input digests for diagnostics. A source change during execution fails the attempt. Clean source is required for retained feature acceptance and full qualification.

### Preserve the full gate

Do not redefine full execution as the union of deployment selections. Retain all 171 named native assertions and the canonical Budget aggregate. Retain the complete validator, full evidence schema names, paired comparison, artifact paths, CI job name, and upload receipt enforcement. New installed remote checks have their own selected evidence; they do not rewrite prior full records.

Add provider-free negative tests proving that a selected report cannot satisfy the complete validator, that missing or extra scenarios fail, and that all full files remain registered. Verify the complete real-database gate on the implementation revision. Read back the existing required-check policy during authorized publication; changing its configuration is not part of this plan.

## Verification strategy

Order failing behavioral tests before the corresponding implementation in the later task list. Planning itself changes documents only and does not require runtime tests.

| Scope                  | Required proof after implementation                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider-free behavior | Argument rejection, exact selection, missing context, failure/skip/empty reports, wrong digests, cancellation, redaction, and lock ownership tests; then `pnpm test:pr` |
| Local                  | Selected source suite plus installed archive qualification, without service credentials or service startup                                                              |
| Remote                 | Default all modes and each explicit mode; installed SDK through verified TLS; zero unselected poolers                                                                   |
| Embedded               | Native canonical and 14 transaction scenarios with zero poolers; unavailable installed acceptance returns non-success                                                   |
| Hosted boundary        | No product runner returns NOT RUN and non-success with zero external calls, including when ambient credentials exist                                                    |
| Concurrent attempts    | Two runs preserve separate archives/evidence/resources; cancellation of one leaves the other intact                                                                     |
| Full gate              | `pnpm test:sqlite-postgres` retains complete matching shared names and every native-only assertion                                                                      |
| Negative acceptance    | Inject missing/duplicate/skipped scenarios, shared mismatch, stale evidence, startup failure, and cleanup failure in separate controlled attempts; no attempt qualifies |
| Repository             | `pnpm test:repository`, `pnpm format`, type checks and dependency boundaries through `pnpm test:pr`                                                                     |

Use [quickstart.md](quickstart.md) for exact command examples and expected results. Retain current-revision evidence under this feature only after execution. Native, installed-consumer, CI, Hosted, package-matrix, and runtime acceptance are NOT RUN during planning.

## Complexity Tracking

No exceptions. The separate selected manifest prevents partial/full evidence confusion. The package lock addresses an observed shared-directory race. Both additions serve existing test owners and introduce no new lifecycle or product abstraction.
