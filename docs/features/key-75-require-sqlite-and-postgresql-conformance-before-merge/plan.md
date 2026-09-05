# Implementation Plan: Require SQLite and PostgreSQL conformance before merge

**Branch**: `key-75-require-sqlite-and-postgresql-conformance-before-merge` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/spec.md`

## Summary

Add a required PR job named `SQLite and PostgreSQL conformance`. Run the shared Budget corpus on real private SQLite and through the existing native PostgreSQL Docker runner. Pass only after both authorities, complete coverage, cleanup, and artifact retention succeed. Preserve `Repository and tests` and the full native suite.

Both authorities will call `registerBudgetContractTests`. Inspection found 37 shared scenarios on SQLite but only 32 registered natively. The five existing Resource-bound root scenarios must join native execution without weakening assertions. This qualifies existing behavior; it does not implement the product documents' future Budget semantics.

Final acceptance includes protected-branch enforcement. After the owner upgraded keynes-dev, live readback confirms the Team plan. The earlier HTTP 403 restriction is resolved. The protection endpoint now returns HTTP 404, Branch not protected, and effective branch rules return an empty array. FR-004 and SC-006 require configuring and demonstrating enforcement; no policy was changed during planning.

## Technical Context

**Language/Version**: TypeScript 7.0.2 and GitHub Actions YAML. Use Node.js 24 for the new conformance job. Planning host reports Node.js 26.5.0 and pnpm 11.21.0.

**Primary Dependencies**: Existing Vitest 4.1.11, pnpm 11.21.0, `node:sqlite`, `pg`, Docker, digest-pinned PostgreSQL 18.6 and PgBouncer images, and pinned GitHub actions. No new production dependencies or test framework.

**Storage**: Private in-memory SQLite, disposable PostgreSQL fixtures, local evidence under `.artifacts/conformance/`, and GitHub Actions artifacts. No persistent application schema changes.

**Testing**: Provider-free runner/report regression tests before implementation, existing `pnpm test:pr`, SQLite execution, full native system execution, and hosted acceptance demonstrations. See [quickstart.md](quickstart.md).

**Target Platform**: GitHub-hosted `ubuntu-24.04` with Docker. Local reproduction uses a clean supported Node.js checkout and Docker. Existing package engine ranges remain unchanged.

**Project Type**: Verification tooling in a TypeScript library monorepo.

**Performance Goals**: Bounded execution and cleanup. Start with a 30-minute conformance job timeout for both authorities and cold setup; record observed duration during acceptance. No benchmark claim.

**Constraints**: Reuse hosts, runner, shared assertions, and native-only coverage. Reject unavailable, skipped, stale, canceled, or unretained execution. No fallback authority, Testcontainers migration, runtime redesign, paid provider, or package qualification campaign.

**Scale/Scope**: Two authorities, one shared aggregate with 37 current scenarios, the complete native suite, one required check, and one feature PR. The observed count is not a permanent limit.

## Constitution Check

The initial design gate passes against constitution 8.0.0. The post-design gate passes with the obligations below. The plan restriction is resolved; configuring and proving merge enforcement remains required at acceptance.

| Gate                                            | Design and verification obligation                                                                                                                                                                    | Result                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| I. One authority per Budget                     | Existing SQLite and PostgreSQL hosts own separate fixtures. Tooling does not implement Budget transitions.                                                                                            | PASS                                                  |
| II. Application-owned effects                   | No new application effects. Preserve caller-owned transaction/outbox tests.                                                                                                                           | PASS; new effects N/A                                 |
| III. Policy boundary                            | No Policy semantics change. Preserve existing Policy tests.                                                                                                                                           | PASS; new Policy design N/A                           |
| IV. Shared behavior                             | Same aggregate on both authorities, exact scenario comparison, and full native lifecycle, transaction, contention, security, and replay coverage.                                                     | PASS by design; execution NOT RUN                     |
| V. Evidence and tests first                     | Observe failing qualification regressions before runner/workflow changes. Require revision, digests, versions, host, attempt, and retained results.                                                   | PASS by design; implementation NOT RUN                |
| Security                                        | Random runner-owned credentials, loopback endpoints, isolated fixtures, sanitized diagnostics, and no secret-bearing context or files in retained output.                                             | PASS by design                                        |
| Recovery, migration, compatibility, performance | Preserve applicable existing tests. No new runtime migration, recovery behavior, public API, benchmark, hosted readiness, or archive qualification claim. Version the changed native evidence format. | New runtime behavior N/A                              |
| Delivery ownership                              | Live KEY-75 confirms exact branch and no prerequisites. Resume the spec, keep one acceptance outcome, and put future phases in tasks.md.                                                              | PASS                                                  |
| Merge enforcement                               | Require successful conformance, preserve existing required checks, read effective policy, and prove native failure blocks merging.                                                                    | Required at acceptance; main is currently unprotected |

## Project Structure

### Documentation for this feature

```text
docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/
  spec.md
  checklists/requirements.md
  plan.md
  research.md
  data-model.md
  contracts/conformance-check.md
  quickstart.md
  tasks.md                  # Future speckit-tasks output
  evidence/                 # Future acceptance records and links
```

### Source code at repository root

```text
.github/workflows/ci.yml
.github/workflows/postgresql-system.yml
package.json
scripts/run-conformance.ts                     # New orchestration entrypoint
scripts/run-conformance.test.ts                # New qualification tests
packages/contracts/conformance/scenarios/index.ts
packages/sdk/test/conformance/budget.test.ts
packages/sdk/test/conformance/test-host.ts
packages/postgresql/test/system/budget.test.ts # New aggregate entrypoint
packages/postgresql/test/system/rollback.test.ts
packages/postgresql/test/system/required-scenarios.ts
packages/postgresql/test/system/run.ts
packages/postgresql/test/system/run.test.ts
packages/postgresql/test/system/support/test-keynes.ts
docs/workflow.md
```

**Structure Decision**: Orchestration belongs in `scripts/`; Docker and native evidence stay with the PostgreSQL runner. Shared assertions stay with contracts. Remove redundant shared-only native entrypoints after aggregate registration replaces them, while preserving native-only rollback tests. Keep native-only expected coverage in the existing inventory. Do not add a generic reporting package or Keynes-specific evidence to `packages/testkit`.

## Phase 0 research outcome

[research.md](research.md) resolves workflow shape, corpus identity, failure evidence, isolation, and policy design. No technical clarification remains. GitHub Team now enables enforcement configuration. Effective policy and blocked-merge demonstrations remain acceptance requirements.

## Phase 1 design

1. Add `pnpm test:conformance -- --output <new-attempt-directory>`. The small entrypoint runs the SQLite aggregate and full native runner sequentially, attempting the second authority after an ordinary first-authority failure. Cancellation stops new work and initiates bounded cleanup. It validates both process outcomes and evidence before returning.
2. Add native aggregate registration and remove duplicate shared registrations from split native files. Shared coverage comes from complete SQLite aggregate execution JSON and must equal the native aggregate by unique full scenario name. Both sets must be nonempty and every assertion must pass. Preserve a separate exact inventory for native-only tests. No test filters, `.only`, or skipped discovery define coverage.
3. Extend native `--output` to emit `keynes.system-test.postgresql/v2` for success and failure. Retain sanitized available results before temporary reports disappear. Keep nonzero failure exits, clean-revision checks, exclusive writes, package digests, and cleanup checks. Historical v1 artifacts remain historical.
4. Add attempt/environment metadata and contract, shared source, scenario-set, lockfile, distribution, and retained file digests. Missing required observations prevent success. Startup failures explicitly identify unobserved versions and nonexecuted tests.
5. Add the independent conformance job to `ci.yml` with `contents: read`, pinned actions, no branch/path/job skip condition, clean checkout, and frozen dependencies. Keep `Repository and tests` independent. Retain artifacts under `always()` with explicit paths and `if-no-files-found: error`. Require runtime verification and upload success; uploading diagnostics cannot rescue failed tests. Keep the manual native workflow and make its retention failure-aware.
6. During authorized acceptance, preserve existing policy requirements and require the exact observed conformance context from GitHub Actions. Require an up-to-date candidate and read back admin/bypass behavior. Demonstrate a native failure blocking qualification and merging. Workflow YAML is not enforcement evidence.

The operational contract is in [contracts/conformance-check.md](contracts/conformance-check.md). No SDK or PostgreSQL procedure interface changes.

## Verification and implementation ordering

The next `speckit-tasks` run must order failing qualification regressions before their implementation. Cover native failure with SQLite passing, missing runtime, skipped/empty/duplicate/malformed/mismatched reports, stale revision or attempt, digest mismatch, retention failure, and cleanup failure. Controlled process/report fixtures prove gate logic only.

Then wire shared native registration, preserve native-only coverage, implement failure-safe evidence, connect CI, and update contributor guidance. Acceptance runs both real authorities on an exact clean revision, failure demonstrations on attributable revisions, overlapping attempts in separate clean checkouts, and effective-policy/blocked-merge readback. See [quickstart.md](quickstart.md).

Planning changes documentation only. Runtime tests, hosted demonstrations, cancellation cleanup, overlapping execution, and merge enforcement remain `NOT RUN`. Implementation has not started. This command does not generate tasks.md.

## Complexity Tracking

No constitutional exceptions are requested. Plan availability alone does not establish merge enforcement.
