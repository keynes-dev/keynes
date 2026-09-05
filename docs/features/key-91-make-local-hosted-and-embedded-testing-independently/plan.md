# Implementation Plan: KEY-91 Make Local, Hosted, and Embedded testing independently runnable

**Branch**: `key-91-make-local-hosted-and-embedded-testing-independently` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: The specification and accepted default-all remote clarification in this directory.

## Summary

The Phase 3 study is complete in [testing-strategy.md](testing-strategy.md). Adopt the measured removal of duplicate contracts execution from `test:pr`. Preserve all fixture and packaging behavior. Keep selected manifest construction with the SDK/PostgreSQL runners and share only neutral mechanics. The remaining phases add independent entrypoints.

Add Local, remote PostgreSQL, Embedded, and Hosted contributor commands under the existing package owners. Reuse native startup/cleanup, canonical Budget scenarios, and installed SDK qualification. Remote runs all supported connection modes by default. Explicit narrower runs start only the dependencies they need and produce evidence that cannot satisfy the complete gate.

Preserve `pnpm test:sqlite-postgres` and its complete native inventory. Embedded initially proves fixture transactions only. Hosted initially returns an explicit unavailable result. Supported Embedded installation and actual Hosted operations remain with their product owners.

## Technical Context

**Language/Version**: Existing TypeScript 7.0.2, Node.js >=24, pnpm 11.21.0.

**Primary Dependencies**: Vitest 4.1.11, existing `pg`, Docker CLI, pinned PostgreSQL 18.6 and PgBouncer images from the native runner. OpenSSL is a test-fixture prerequisite for temporary certificates. No new application dependency or fixture framework.

**Storage**: Private in-memory SQLite for Local; attempt-owned PostgreSQL databases for native checks. Ignored filesystem directories hold archives, sanitized reports, and temporary fixture material. No product schema changes.

**Testing**: Provider-free runner tests first; real Local and native PostgreSQL selected checks; installed consumers; unchanged paired behavior gate. Exact selected inventories, negative-result validation, cancellation, concurrent attempts, and package preparation locking receive direct tests.

**Target Platform**: Current supported contributor environments with Node >=24. Docker-backed native acceptance is required on the existing Ubuntu CI environment. Installed archive OS/Node matrix remains owned by the existing package qualification workflow.

**Project Type**: Contributor CLI orchestration in an existing library monorepo.

**Performance Goals**: Zero dependencies started solely for excluded coverage. Measure a bounded pilot and adopt it only if repeated operations or duplicated test/support code decrease with unchanged acceptance obligations. An evidence-backed rejection completes the pilot. Set no percentage speedup before measurement. Preserve existing bounded readiness and process-cleanup timeouts. No product throughput or production availability claim.

**Constraints**: Default verification remains provider-free. Root commands remain thin. No SDK validation bypass, changed Budget semantics, new public SDK, new installation profile, required-check rename, or Spec Kit customization.

**Scale/Scope**: Three available local deployment selections, one unavailable Hosted entrypoint, three remote connection modes, and the existing full gate. Two simultaneous attempts must preserve independent state and evidence.

## Constitution Check

The original pre-research and post-design checks passed against constitution 8.0.1. The added study requirements remain consistent with those principles. The post-study check below repeats those gates after the measured pilot and ownership revision. The study prerequisite is satisfied; the requested execution scope stops at tasks.md Phase 3.

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
- [testing-strategy.md](testing-strategy.md) contains the completed study, coverage map, measurements, and pilot decision, with [retained observations](evidence/testing-strategy.json).
- [tasks.md](tasks.md) orders the study first, then the initial implementation work behind its design-revision checkpoint.

### Source code

Existing owners remain unchanged. The root-command pilot and repository regression are implemented. The deployment additions below remain proposed paths:

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
packages/testkit/src/                           neutral report/process/snapshot/archive-lock mechanics
scripts/run-sqlite-postgres.ts                   full comparison remains here
package.json                                   thin aliases
packages/sdk/package.json                       SDK-owned commands
packages/postgresql/package.json                PostgreSQL-owned commands
.github/workflows/ci.yml                        existing full required check preserved
.github/workflows/postgresql-system.yml         existing full native workflow preserved
.github/workflows/sdk-package.yml               study repeated builds and tooling tests
docs/workflow.md                               entrypoint and evidence guidance
```

Use existing files where their ownership fits. Add adjacent `*.test.ts` files for new runner behavior. Update testkit exports and declared workspace edges only for extracted helpers actually used by multiple owners. Do not move SQL assertions or contract inventories to testkit.

## Phase 0: research and testing-strategy study

Initial research resolved runner selection, exact inventories, installed-consumer reuse, TLS provisioning, Embedded/Hosted limits, and packaging concurrency in [research.md](research.md). The subsequent strategy assessment found concrete duplication. That assessment is an initial observation, not the completed comparative study now required by FR-013 through FR-017.

### Required study before downstream implementation

Create `testing-strategy.md` in this feature directory with these three deliverables:

1. **Coverage and ownership map.** Inventory root/package commands and CI invocations. Map each suite to its assertion purpose, public or internal boundary, artifact provenance, fixture lifetime, database/role requirements, and full-gate obligation. Identify repeated invocation, repeated setup, shared semantics, boundary-specific assertions, and exported but uninvoked scenario registrars. Explain retention, consolidation, rejection, or deferral for every assessed candidate.
2. **Cost baseline.** Measure provider-free PR checks, complete native checks, and representative SDK package qualification. Separate build/pack, external installation, database/role setup, install/recheck, test import/registration, assertions, and cleanup. Record subprocess/setup counts and test/support lines for the affected owners. Measure three attempts per baseline and pilot condition on the same host, runtime, dependencies, and cache/image state; report individual values and the median. Document warm-up separately. Do not compare local times with CI times as a speedup result.
3. **Bounded pilot.** Choose the smallest demonstrated duplication, starting with contracts running twice in `test:pr` or repeated installation recheck in ordinary native fixtures. Record the baseline regression or invocation-count assertion failing before the change, preserve dedicated installer/recheck proof, and compare coverage and cost afterward. Keep the experimental patch isolated and reviewable. Adopt it only if repeated work or duplicated code falls while affected acceptance and failure detection remain intact; otherwise reject or revise it. The pilot does not authorize broad delivery implementation.

Retain raw timing/result observations under a new ignored `.artifacts/key-91/testing-strategy/<attempt>` directory. The study records revisions or patch digests, environment/cache conditions, commands, artifact digests, outcome, and evidence references. Missing native or package measurements remain NOT RUN and leave the study incomplete. No Hosted environment, paid service, or production benchmark is needed.

### Candidates and limits

| Candidate                          | Study decision needed                                                                                                                                             | Proof that must remain                                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Duplicate root and CI execution    | Remove duplicate contracts execution; separate qualification-tool self-tests from per-platform consumer execution; verify explicit build plus prepack duplication | Each required test runs in its owning acceptance scope; intended build determinism and supported runtime checks remain    |
| Repeated native setup              | First evaluate moving the second installer invocation out of ordinary fixture creation; consider template cloning only after measuring remaining setup            | Fresh installation, exact recheck, privilege drift, independent transactions, committed recovery, contention, and cleanup |
| Shared Policy request/replay cases | Map common inputs and semantic expectations against public SDK and installed procedure boundaries                                                                 | Raw error, identity, ordering, projection, transaction, and replay assertions at each boundary                            |
| Runner/report duplication          | Parse report structure once, then apply separate selected/full/parity coverage policies                                                                           | The strictest existing structural checks plus each owner's completeness and evidence identity rules                       |
| Feedback versus acceptance         | Compose existing scenario registrars with explicit fixture lifetimes and coverage; choose focused invocation conventions after mapping costs                      | Deployment acceptance still runs installed consumers; narrower feedback never qualifies broader coverage                  |

Prefer existing registrars and small target adapters. Do not add a generic plugin framework, arbitrary scenario/target Cartesian product, or runtime discovery that silently removes required coverage. Do not share mutable databases across tests or wrap all cases in rollback as a blanket optimization. Keep actual fixture capabilities and lifetimes explicit.

Broad Policy-corpus migration is assessed here but is not automatically included in KEY-91. Record it as a separately scoped migration if preserving its coverage requires unrelated semantic test changes. Required full scenario names remain unchanged for this feature; any later name migration needs an explicit coverage mapping and its own disposition.

### Study exit and design revision

Execution beyond the study checkpoint requires the coverage map, comparable measurements, and one measured pilot with an adopt or reject decision. An evidence-backed rejection permits downstream implementation with the existing coverage intact; missing measurements do not. Record adopted, rejected, and deferred changes with reasons. Reconcile the design and remaining tasks, then repeat the Constitution Check. The study stays in the existing Spec Kit artifacts and introduces no second task system.

**Current boundary:** The study has three passing baseline samples for each required command, three passing pilot PR samples, and an observed failing contracts assertion through the retained Turbo stage. The pilot removes one repeated 51-test execution. All 37 SQLite and 208 PostgreSQL assertions and installed SDK qualification passed at the intake revision. These are study observations, not acceptance of the unbuilt deployment commands. T012 releases the study gate; execution in this request stops at Phase 3.

## Phase 1: design

This design incorporates the study. Retain deployment defaults and evidence obligations. Extract shared structural report validation and process cleanup only when a second runner uses them. Retain existing owner commands for narrower source feedback. Defer installer recheck removal, packaging CI changes, remote-registrar activation, and broad Policy request/replay migration. T016-T020 must keep full/parity/selected coverage verdicts and manifest schema construction with their runners; testkit stays product-neutral.

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

Extract reusable child termination, structural report parsing, source snapshots, and exclusive archive preparation only where the study demonstrates shared mechanics. The SDK and PostgreSQL runners construct selected manifests, apply schema/coverage policy, and sanitize owner-specific sensitive data. Testkit accepts neutral records and owns no `schemaVersion`, deployment evidence vocabulary, or coverage verdict. Do not add cross-imports between the SDK and PostgreSQL test owners. Parse reports into validated results, then retain separate selected, complete-native, and cross-backend coverage policies. Preserve all existing structural/count/duplicate checks; do not choose a more permissive validator during extraction. Reuse current cancellation behavior, including tracking resource creation that races cancellation. Clean up test children before poolers, database, network, and temporary workspaces. Record all cleanup failures; never overwrite an assertion failure with a cleanup success.

Use a single checkout-local build/pack lock for the entrypoints involved here, including full native package preparation. Lock acquisition has a bounded wait and honors cancellation. A contender never deletes a lock it did not acquire. A stale lock fails with an actionable diagnostic; automatic unsafe lock stealing is excluded. Once archives are immutable, release the lock and allow attempts to execute concurrently. Supplied archives are read-only inputs and are never deleted by attempt cleanup.

Write the selected manifest and sanitized reports under a newly created output directory. Bind expected coverage before tests run and validate observed coverage afterward. Hash archives and reports. Capture source before/after identity, including dirty-input digests for diagnostics. A source change during execution fails the attempt. Clean source is required for retained feature acceptance and full qualification.

### Preserve the full gate

Do not redefine full execution as the union of deployment selections. Retain all 171 named native assertions and the canonical Budget aggregate. Retain the complete validator, full evidence schema names, paired comparison, artifact paths, CI job name, and upload receipt enforcement. New installed remote checks have their own selected evidence; they do not rewrite prior full records.

Reuse existing provider-free negative tests for report structure and full coverage. Add only missing selected/full boundary cases, including rejection of selected reports by the complete validator. Verify the complete real-database gate on the implementation revision. Read back the existing required-check policy during authorized publication; changing its configuration is not part of this plan.

## Verification strategy

Order failing behavioral tests before the corresponding implementation in the later task list. The study pilot must also observe the expected regression before its experimental change. The completed study retains the expected red regression, restored negative experiment, and passing baseline/pilot samples. Later behavioral tasks still require their own expected failures before implementation.

Before downstream implementation, require the study evidence defined in Phase 0. After implementation, compare adopted optimizations with that baseline under equivalent conditions, retain the coverage mapping, and report any regression. A lower line count or cached run alone cannot qualify the change.

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
| Repository             | `pnpm test:pr` covers repository tests, type checks, and dependency boundaries; run `pnpm format` separately                                                            |

Use [quickstart.md](quickstart.md) for study prerequisites and implementation validation examples. Retain current-revision evidence under this feature only after execution. The initial provider-free timing remains historical in research; the completed comparison is in testing-strategy.md. New deployment entrypoints, selected evidence, concurrency, installed remote TLS, Embedded product acceptance, and actual Hosted operations remain NOT RUN. Earlier CI timings do not establish acceptance of this revision.

## Complexity Tracking

No exceptions. The separate selected manifest prevents partial/full evidence confusion. The package lock addresses an observed shared-directory race. Both additions serve existing test owners and introduce no new lifecycle or product abstraction.

## Post-study Constitution Check

All eight gates in the Constitution Check remain Pass after the study. The
adopted command change leaves Budget authorities, application effects, Policy
semantics, security and native coverage unchanged. A failing regression preceded
the edit, the retained Turbo stage detected an injected contracts failure, and
three native/package baseline attempts passed with exact identities and cleanup.
No external target was used. The revised T018 keeps selected schema construction
in the runners and neutral snapshot/serialization mechanics in testkit, preserving
the existing ownership test. No constitutional exception is required.

T012's design reconciliation does not complete KEY-91. Phases 4-9 retain all
selected/full report negatives, package locking, independent deployment commands,
TLS consumer, cancellation and final exact-revision acceptance obligations.
